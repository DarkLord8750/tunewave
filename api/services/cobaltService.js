import fetch from 'node-fetch';

export const cobaltService = {
  async extractStreamUrl(videoId) {
    if (!videoId) return null;
    
    const instances = [
      'https://api.cobalt.tools',
      'https://cobalt.k6.tf',
      'https://cobalt-api.lunes.host',
      'https://cobalt.api.ryzetech.live'
    ];
    
    for (const instance of instances) {
      console.log(`[Cobalt API] Attempting extraction on: ${instance} for ${videoId}...`);
      try {
        const response = await fetch(`${instance}/api/json`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            isAudioOnly: true,
            aFormat: 'mp3'
          }),
          timeout: 6000
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'stream' && data.url) {
          console.log(`[Cobalt API] ✅ SUCCESS: Got stream URL from ${instance}`);
          return data.url;
        } else if (data.status === 'error') {
          throw new Error(data.text || 'Unknown error');
        } else {
          throw new Error(`Unexpected status: ${data.status}`);
        }
      } catch (err) {
        console.error(`[Cobalt API Error] ❌ Instance ${instance} failed:`, err.message);
      }
    }
    
    return null;
  }
};
