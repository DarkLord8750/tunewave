/**
 * CORS Stream Service
 * Handles music streaming through CORS proxies when direct access is blocked
 * Used for educational purposes to bypass firewall restrictions
 */

const CORS_PROXIES = [
  {
    name: 'allorigins.win',
    format: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  },
  {
    name: 'codetabs.com',
    format: (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  }
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks/streams/',
  'https://pipedapi.tokhmi.xyz/streams/',
  'https://pipedapi.smnz.de/streams/',
  'https://piped-api.lunar.icu/streams/',
  'https://api.piped.projectsegfau.lt/streams/'
];
const TIMEOUT = 8000; // 8 seconds timeout per proxy

/**
 * Fetch stream URL with timeout
 */
const fetchWithTimeout = (url: string, timeout: number): Promise<Response> => {
  return Promise.race([
    fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    }),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
};

/**
 * Get audio stream URL using CORS proxy
 * Tries multiple proxies until one works
 */
export const getStreamUrlViaCorsProxy = async (videoId: string): Promise<string | null> => {
  if (!videoId) {
    console.error('[CORS] No video ID provided');
    return null;
  }

  for (const pipedApi of PIPED_INSTANCES) {
    const pipedUrl = `${pipedApi}${videoId}`;

    for (const proxy of CORS_PROXIES) {
      try {
        const proxyUrl = proxy.format(pipedUrl);
        console.log(`[CORS] Attempting: ${proxy.name} for ${pipedApi}`);

      const res = await fetchWithTimeout(proxyUrl, TIMEOUT);

      if (!res.ok) {
        console.warn(`[CORS] ${proxy.name} returned status ${res.status}`);
        continue;
      }

      const data = await res.json();

      // Check if response has audio streams
      if (data?.audioStreams && Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
        // Sort by bitrate descending to get highest quality
        const sortedStreams = data.audioStreams.sort(
          (a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0)
        );

        const bestStream = sortedStreams[0];

        if (bestStream?.url) {
          const bitrate = bestStream.bitrate ? Math.round(bestStream.bitrate / 1000) : 'unknown';
          console.log(`✅ [CORS] Success via ${proxy.name} - ${bitrate}kbps`);
          return bestStream.url;
        }
      }

      console.warn(`[CORS] ${proxy.name} returned no audio streams`);
      } catch (error: any) {
        console.warn(`[CORS] ${proxy.name} failed:`, error.message);
        continue;
      }
    }
  }

  console.error('[CORS] All proxies and Piped instances exhausted - stream unavailable');
  return null;
};

/**
 * Get stream URL (tries direct first, then CORS proxy as fallback)
 */
export const getStreamUrl = async (videoId: string): Promise<string | null> => {
  const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks/',
    'https://pipedapi.tokhmi.xyz/',
    'https://api.piped.projectsegfau.lt/',
    'https://pipedapi.snooguts.net/',
    'https://pipedapi.drgns.space/'
  ];

  const INVIDIOUS_INSTANCES = [
    'https://vid.puffyan.us/api/v1/videos/',
    'https://invidious.jing.rocks/api/v1/videos/',
    'https://inv.tux.pizza/api/v1/videos/'
  ];

  if (!videoId) return null;

  // First try direct API (in case firewall is not blocking it)
  try {
    const pipedPromises = PIPED_INSTANCES.map(async (pipedApi) => {
      const res = await fetchWithTimeout(`${pipedApi}streams/${videoId}`, 4000);
      if (res.ok) {
        const data = await res.json();
        if (data?.audioStreams?.[0]?.url) {
          console.log(`✅ [Stream] Direct Piped API successful via ${pipedApi}`);
          return data.audioStreams[0].url;
        }
      }
      throw new Error(`Failed direct for ${pipedApi}`);
    });

    const invidiousPromises = INVIDIOUS_INSTANCES.map(async (invidiousApi) => {
      const res = await fetchWithTimeout(`${invidiousApi}${videoId}`, 4000);
      if (res.ok) {
        const data = await res.json();
        const audioFormats = data?.adaptiveFormats?.filter((f: any) => f.type && f.type.startsWith('audio'));
        if (audioFormats && audioFormats.length > 0) {
          audioFormats.sort((a: any, b: any) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
          console.log(`✅ [Stream] Direct Invidious API successful via ${invidiousApi}`);
          return audioFormats[0].url;
        }
      }
      throw new Error(`Failed direct for ${invidiousApi}`);
    });
    
    const directUrl = await Promise.any([...pipedPromises, ...invidiousPromises]);
    return directUrl;
  } catch (aggregateError) {
    console.warn(`[Stream] Direct API failed for all instances`);
  }

  // Fallback to CORS proxy
  return await getStreamUrlViaCorsProxy(videoId);
};

/**
 * Health check - test if CORS proxy works
 */
export const testCorsProxy = async (): Promise<boolean> => {
  try {
    const testUrl = `dQw4w9WgXcQ`; // Rick Roll video ID
    const result = await getStreamUrlViaCorsProxy(testUrl);
    return !!result;
  } catch (error) {
    return false;
  }
};
