import { streamCache } from './services/cacheService.js';
import { ytDlpService } from './services/ytDlpService.js';
import { y2mateService } from './services/y2mateService.js';
import { saavnService } from './services/saavnService.js';
import { cobaltService } from './services/cobaltService.js';

export default async function handler(req, res) {
  const { id, title, artist, spotifyPreview } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ 
      success: false, 
      error: 'Valid VIDEO_ID is required' 
    });
  }

  try {
    // Check cache first
    const cachedStream = streamCache.get(id);
    if (cachedStream) {
      console.log(`[Stream] ✅ Cache HIT: Serving cached stream for ${id}`);
      return res.json({
        success: true,
        streamUrl: cachedStream.url || cachedStream, // Support compatibility with object cache if modified
        source: 'cache',
        videoId: id
      });
    }

    console.log(`[Stream] 🔄 Cache MISS: Fetching stream for ${id}`);
    
    let streamUrl = null;
    let source = 'extracted';
    
    // Fallback 1: Try JioSaavn CDN first (high quality, bypasses blocks)
    if (title) {
      try {
        streamUrl = await saavnService.getStreamUrl(title, artist);
        if (streamUrl) {
          source = 'jiosaavn';
        }
      } catch (saavnErr) {
        console.warn(`[Stream] JioSaavn fallback failed: ${saavnErr.message}`);
      }
    }

    // Fallback 2: Try Spotify Preview (30-second preview, highly reliable, no blocking)
    if (!streamUrl && spotifyPreview) {
      console.log(`[Stream] JioSaavn failed, falling back to Spotify Preview URL`);
      streamUrl = spotifyPreview;
      source = 'spotify';
    }

    // Fallback 3: Try standard YouTube extraction services
    if (!streamUrl) {
      try {
        streamUrl = await ytDlpService.extractStreamUrl(id);
        if (streamUrl) {
          source = 'extracted';
        }
      } catch (ytErr) {
        console.warn(`[Stream] YouTube extraction failed: ${ytErr.message}`);
      }
    }

    // Fallback 3: Try Cobalt extraction
    if (!streamUrl) {
      try {
        streamUrl = await cobaltService.extractStreamUrl(id);
        if (streamUrl) {
          source = 'cobalt';
        }
      } catch (cobaltErr) {
        console.warn(`[Stream] Cobalt fallback failed: ${cobaltErr.message}`);
      }
    }

    // Fallback 4: Try Y2Mate conversion
    if (!streamUrl) {
      try {
        streamUrl = await y2mateService.extractStreamUrl(id);
        if (streamUrl) {
          source = 'y2mate';
        }
      } catch (y2mateErr) {
        console.warn(`[Stream] Y2Mate fallback failed: ${y2mateErr.message}`);
      }
    }

    if (!streamUrl) {
      throw new Error('Failed to extract stream URL - all methods failed');
    }

    // Save to cache with 12 hour TTL
    streamCache.set(id, streamUrl, 43200);
    console.log(`[Stream] 💾 Cached stream for ${id} (source: ${source})`);

    return res.json({
      success: true,
      streamUrl: streamUrl,
      source: source,
      videoId: id,
      quality: 'best-audio'
    });

  } catch (error) {
    console.error(`[Stream Error] ❌ ${id}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to extract audio stream',
      details: error.message,
      videoId: id
    });
  }
}
