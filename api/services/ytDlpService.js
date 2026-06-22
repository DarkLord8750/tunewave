import fetch from 'node-fetch';
import https from 'https';
import ytDlp from 'yt-dlp-exec';
import fs from 'fs';
import path from 'path';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 30000
});

export const ytDlpService = {
  async extractStreamUrl(videoId, retries = 0) {
    console.log(`[Stream API] Fetching stream for ${videoId}`);

    // PRIORITY 1: YouTube Music API (official, no rate limit)
    console.log(`[YouTube Music API] Attempting official API...`);
    const musicUrl = await this.tryYouTubeMusicApi(videoId);
    if (musicUrl) {
      console.log(`[Stream API] ✅ SUCCESS: Got stream from YouTube Music API`);
      return musicUrl;
    }

    // PRIORITY 2: yt-dlp with cookies (most reliable)
    console.log(`[yt-dlp] Attempting with improved settings...`);
    const ytDlpUrl = await this.tryYtDlpWithCookies(videoId, retries);
    if (ytDlpUrl) {
      console.log(`[Stream API] ✅ SUCCESS: Got stream from yt-dlp`);
      return ytDlpUrl;
    }

    // PRIORITY 3: Backend proxy (direct extraction)
    console.log(`[Backend Proxy] Attempting proxy extraction...`);
    const proxyUrl = await this.tryBackendProxy(videoId, retries);
    if (proxyUrl) {
      console.log(`[Stream API] ✅ SUCCESS: Got stream from Backend Proxy`);
      return proxyUrl;
    }

    throw new Error(`❌ FAILED: Could not extract stream using any method`);
  },

  async tryYouTubeMusicApi(videoId) {
    try {
      console.log(`[YouTube Music API] Trying official API for ${videoId}`);

      const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO90d0o_cE5PVLCFlo7lFZ6puyTf1g20w`, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240101.00.00'
            }
          },
          videoId: videoId
        }),
        timeout: 10000,
        agent: httpsAgent
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Extract streaming URL from API response
      if (data.streamingData && data.streamingData.formats) {
        const formats = data.streamingData.formats;
        if (formats.length > 0 && formats[0].url) {
          console.log(`[YouTube Music API] ✅ Found URL`);
          return formats[0].url;
        }
      }

      // Try adaptiveFormats (audio only)
      if (data.streamingData && data.streamingData.adaptiveFormats) {
        const audioFormats = data.streamingData.adaptiveFormats.filter(f => f.mimeType && f.mimeType.includes('audio'));
        if (audioFormats.length > 0 && audioFormats[0].url) {
          console.log(`[YouTube Music API] ✅ Found audio URL`);
          return audioFormats[0].url;
        }
      }

      throw new Error('No streaming data in API response');
    } catch (error) {
      console.log(`[YouTube Music API] ❌ Failed:`, error.message);
      return null;
    }
  },

  async tryYtDlpWithCookies(videoId, retries) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    for (let i = 0; i <= retries; i++) {
      try {
        console.log(`[yt-dlp] Attempt ${i + 1}/${retries + 1} for ${videoId}`);

        const ytDlpOptions = {
          format: 'bestaudio/best',
          getUrl: true,
          noWarnings: true,
          preferFreeFormats: true,
          noPlaylist: true,
          userAgent: USER_AGENT,
          socketTimeout: '30',
          noCheckCertificates: true,
          retries: '5',
          quiet: false,
          noCache: true,
          httpHeaders: {
            'User-Agent': USER_AGENT,
            'Accept': 'audio/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
          }
        };

        // Determine cookies configuration:
        // 1. If a local cookies.txt file exists, use it (works anywhere, including Render)
        // 2. If running locally (not in production / not on Render), try browser cookies
        const cookiesPath = path.join(process.cwd(), 'cookies.txt');
        if (fs.existsSync(cookiesPath)) {
          ytDlpOptions.cookies = cookiesPath;
          console.log(`[yt-dlp] Using local cookies file: ${cookiesPath}`);
        } else if (process.env.RENDER !== 'true' && process.env.NODE_ENV !== 'production') {
          ytDlpOptions.cookiesFromBrowser = 'chrome';
        } else {
          console.log('[yt-dlp] Running in headless environment without cookies.txt - skipping browser cookies to avoid crashes');
        }

        const result = await ytDlp(url, ytDlpOptions);

        const streamUrl = result.trim();

        if (!streamUrl || !streamUrl.startsWith('http')) {
          throw new Error('Invalid URL returned');
        }

        console.log(`[yt-dlp] ✅ SUCCESS on attempt ${i + 1}`);
        return streamUrl;
      } catch (error) {
        console.error(`[yt-dlp] ❌ Attempt ${i + 1} failed:`, error.message);

        const errMsg = error.message || '';
        const isBotCheck = errMsg.includes('confirm you') || errMsg.includes('Sign in') || errMsg.includes('bot');
        if (isBotCheck) {
          console.log(`[yt-dlp] ❌ Permanent block detected. Aborting further attempts.`);
          break;
        }

        if (i < retries) {
          // Longer backoff: 5s, 15s, 30s
          const backoffMs = (5000 * (i + 1)) + (Math.random() * 5000);
          console.log(`[yt-dlp] ⏳ Retrying in ${backoffMs}ms...`);
          await new Promise(res => setTimeout(res, backoffMs));
        }
      }
    }

    return null;
  },

  async tryBackendProxy(videoId, retries) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`[Backend Proxy] Attempt ${attempt + 1}/${retries + 1} for ${videoId}`);

        // Fetch with extended headers and delays
        const pageResponse = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"'
          },
          timeout: 20000,
          agent: httpsAgent
        });

        if (pageResponse.status === 429 || pageResponse.status === 403) {
          console.log(`[Backend Proxy] ❌ Rate limited or blocked (${pageResponse.status}). Aborting.`);
          break;
        }

        if (!pageResponse.ok) {
          throw new Error(`HTTP ${pageResponse.status}`);
        }

        const pageHtml = await pageResponse.text();

        // Extract streaming URL from HTML
        const urlMatch = pageHtml.match(/"url":"(https?:\/\/[^"]*?(?:googlevideo|r\d+\.)[^"]*?)"/);
        if (urlMatch && urlMatch[1]) {
          const streamUrl = urlMatch[1]
            .replace(/\\u0026/g, '&')
            .replace(/\\\//g, '/');
          
          if (streamUrl.startsWith('http')) {
            console.log(`[Backend Proxy] ✅ Found stream URL`);
            return streamUrl;
          }
        }

        throw new Error('No valid stream URL found');
      } catch (error) {
        console.error(`[Backend Proxy] ❌ Attempt ${attempt + 1} failed:`, error.message);

        const errMsg = error.message || '';
        if (errMsg.includes('Rate limited') || errMsg.includes('429') || errMsg.includes('403')) {
          break;
        }

        if (attempt < retries) {
          // Much longer delays: 10s, 20s, 30s + random
          const backoffMs = (10000 * (attempt + 1)) + (Math.random() * 10000);
          console.log(`[Backend Proxy] ⏳ Retrying in ${backoffMs}ms...`);
          await new Promise(res => setTimeout(res, backoffMs));
        }
      }
    }

    return null;
  }
};
