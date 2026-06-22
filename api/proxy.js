import { streamCache } from './services/cacheService.js';
import { ytDlpService } from './services/ytDlpService.js';
import { y2mateService } from './services/y2mateService.js';
import { cobaltService } from './services/cobaltService.js';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

// Track active background downloads to prevent overlapping writes/downloads
const activeDownloads = new Map();

export default async function handler(req, res) {
  const { id, title, artist, spotifyPreview } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid VIDEO_ID is required' });
  }

  const cacheDir = path.join(process.cwd(), 'audio_cache');
  if (!fs.existsSync(cacheDir)) {
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) {}
  }
  const filePath = path.join(cacheDir, `${id}.mp3`);
  const tempFilePath = path.join(cacheDir, `${id}.tmp`);

  // 1. If cached, serve directly (Express sendFile handles Range requests natively)
  if (fs.existsSync(filePath)) {
    console.log(`[Proxy] 💾 Serving song from local file cache: ${id}.mp3`);
    return res.sendFile(filePath);
  }

  // 2. Determine if this file is currently being downloaded in the background
  const isDownloading = activeDownloads.has(id);

  try {
    // 3. Resolve the stream URL (Check local cache first)
    let streamUrl = streamCache.get(id);
    
    if (streamUrl) {
      console.log(`[Proxy] ✅ Cache HIT: Using cached stream URL for ${id}`);
    } else {
      console.log(`[Proxy] 🔄 Cache MISS: Fetching fresh stream URL for ${id}`);

      // Fallback 1: Try Spotify Preview (30-second preview, highly reliable, no blocking)
      if (spotifyPreview) {
        console.log(`[Proxy] Falling back to Spotify Preview URL`);
        streamUrl = spotifyPreview;
      }

      // Fallback 2: Try standard YouTube extraction
      if (!streamUrl) {
        try {
          streamUrl = await ytDlpService.extractStreamUrl(id);
        } catch (ytErr) {
          console.warn(`[Proxy] YouTube extraction failed: ${ytErr.message}`);
        }
      }

      // Fallback 3: Try Cobalt
      if (!streamUrl) {
        try {
          streamUrl = await cobaltService.extractStreamUrl(id);
        } catch (cobaltErr) {
          console.warn(`[Proxy] Cobalt fallback failed: ${cobaltErr.message}`);
        }
      }

      // Fallback 4: Try Y2Mate
      if (!streamUrl) {
        try {
          streamUrl = await y2mateService.extractStreamUrl(id);
        } catch (y2mateErr) {
          console.warn(`[Proxy] Y2Mate fallback failed: ${y2mateErr.message}`);
        }
      }
      
      if (!streamUrl) {
        throw new Error('No stream URL returned from extraction service or fallbacks');
      }

      // Cache the URL (TTL: 24 hours)
      streamCache.set(id, streamUrl, 86400);
      console.log(`[Proxy] 💾 Cached stream URL for ${id}`);
    }

    // 4. Prepare request headers
    const headers = {
      'Connection': 'keep-alive',
      'Keep-Alive': 'timeout=30, max=1000'
    };
    
    // Only send the client's Range headers if the file is already being downloaded in the background.
    // If NOT downloading, we want to request the full file from upstream to create a clean, full local cache.
    if (isDownloading && req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    // 5. Fetch the audio stream from upstream
    console.log(`[Proxy] 🎵 Fetching audio stream (isDownloading/Seeking: ${isDownloading})...`);
    let response = await fetch(streamUrl, { 
      headers,
      timeout: 30000
    });

    // Handle expired links
    if (!response.ok && response.status !== 206) {
      console.warn(`[Proxy] ⚠️  Stream URL error: ${response.status}`);

      if (response.status === 403 || response.status === 404) {
        console.log(`[Proxy] 🔄 Link expired, clearing cache and retrying...`);
        streamCache.del(id);
        
        try {
          let freshUrl = null;
          
          if (spotifyPreview) {
            freshUrl = spotifyPreview;
          }

          if (!freshUrl) {
            try { freshUrl = await ytDlpService.extractStreamUrl(id); } catch (e) {}
          }

          if (!freshUrl) {
            try { freshUrl = await cobaltService.extractStreamUrl(id); } catch (e) {}
          }

          if (!freshUrl) {
            try { freshUrl = await y2mateService.extractStreamUrl(id); } catch (e) {}
          }

          if (!freshUrl) {
            throw new Error('All extraction methods failed on link renewal retry');
          }

          streamUrl = freshUrl;
          streamCache.set(id, streamUrl, 86400);

          response = await fetch(streamUrl, { headers });
          
          if (!response.ok && response.status !== 206) {
            throw new Error(`Upstream returned ${response.status} on retry`);
          }
        } catch (retryError) {
          console.error(`[Proxy] ❌ Retry failed:`, retryError.message);
          throw retryError;
        }
      } else {
        throw new Error(`Stream returned ${response.status}`);
      }
    }

    // 6. Handle streaming to client and cache writing
    if (isDownloading) {
      // If a background download is already active, we don't start a second write.
      // We just stream this response (which might be partial/Range) directly to the client.
      console.log(`[Proxy] 🔀 Active background download exists. Proxying request directly to client...`);
      return pipeResponse(response, res);
    } else {
      // Start background download/cache task
      console.log(`[Proxy] 📥 Starting atomic background download of complete audio file...`);
      activeDownloads.set(id, true);

      // Split the stream so we can pipe to client and write to file concurrently
      const [clientStream, fileStream] = response.body.tee();
      
      const fileWriter = fs.createWriteStream(tempFilePath);
      Readable.fromWeb(fileStream).pipe(fileWriter);
      
      fileWriter.on('finish', () => {
        try {
          fs.renameSync(tempFilePath, filePath);
          console.log(`[Proxy] 💾 Audio file successfully cached atomically: ${id}.mp3`);
        } catch (err) {
          console.error(`[Proxy] ❌ Failed to rename temp cache file:`, err.message);
        } finally {
          activeDownloads.delete(id);
        }
      });
      
      fileWriter.on('error', (err) => {
        console.error(`[Proxy] ❌ Cache file write error:`, err.message);
        activeDownloads.delete(id);
        try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
      });

      const newResponse = {
        status: response.status,
        headers: response.headers,
        body: clientStream
      };

      // Since we requested the full stream from upstream, we serve it as 200 OK to the client, ignoring their range header for this miss request.
      // Subsequent requests will be range-supported cache hits.
      return pipeResponse(newResponse, res, true);
    }

  } catch (error) {
    console.error(`[Proxy Error] ❌ ${id}:`, error.message);
    activeDownloads.delete(id);
    try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
    
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to stream audio',
        details: error.message,
        videoId: id
      });
    }
  }
}

function pipeResponse(response, res, forceOkStatus = false) {
  // Forward HTTP status (or force 200 OK if we are streaming the full file to client on cache miss)
  res.statusCode = forceOkStatus ? 200 : response.status;

  // Forward critical headers
  const headersToForward = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'content-disposition'
  ];

  for (const headerName of headersToForward) {
    // If forcing 200 OK, do not forward partial content range headers
    if (forceOkStatus && (headerName === 'content-range' || headerName === 'accept-ranges')) {
      continue;
    }
    
    if (response.headers) {
      if (typeof response.headers.has === 'function' && response.headers.has(headerName)) {
        res.setHeader(headerName, response.headers.get(headerName));
      } else if (response.headers[headerName]) {
        res.setHeader(headerName, response.headers[headerName]);
      }
    }
  }

  // Add CORS and keepalive headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Keep-Alive', 'timeout=30, max=1000');

  // Pipe the audio body
  if (response.body) {
    try {
      const readable = Readable.fromWeb(response.body);
      
      readable.on('error', (err) => {
        console.error('[Proxy] Stream pipe error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream interrupted' });
        }
      });

      readable.pipe(res);
      console.log('[Proxy] 🎵 Audio streaming to client...');
    } catch (error) {
      console.error('[Proxy] Failed to pipe stream:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to pipe stream' });
      }
    }
  } else {
    console.warn('[Proxy] No response body to stream');
    res.end();
  }
}
