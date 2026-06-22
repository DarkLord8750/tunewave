import fetch from 'node-fetch';

export const y2mateService = {
  async extractStreamUrl(videoId) {
    if (!videoId) return null;
    
    const domains = [
      'www.y2mate.com',
      'y2mate.tools',
      'y2mate.bz',
      'y2mate.me'
    ];
    
    for (const domain of domains) {
      console.log(`[Y2Mate API] Attempting extraction using domain: ${domain} for ${videoId}...`);
      
      try {
        // Step 1: Analyze the video
        const analyzeUrl = `https://${domain}/mates/analyzeV2/ajax`;
        const analyzeParams = new URLSearchParams({
          k_query: `https://www.youtube.com/watch?v=${videoId}`,
          k_page: 'home',
          hl: 'en',
          q_auto: '0'
        });
        
        const analyzeRes = await fetch(analyzeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Origin': `https://${domain}`,
            'Referer': `https://${domain}/en`,
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: analyzeParams.toString(),
          timeout: 6000
        });
        
        if (!analyzeRes.ok) {
          throw new Error(`Analyze HTTP ${analyzeRes.status}`);
        }
        
        const analyzeData = await analyzeRes.json();
        if (analyzeData.status !== 'success' || !analyzeData.links || !analyzeData.links.mp3) {
          throw new Error(analyzeData.mess || 'No MP3 links found in response');
        }
        
        // Find the best quality MP3 key
        const mp3Links = analyzeData.links.mp3;
        const keyObj = mp3Links.mp3320 || mp3Links.mp3256 || mp3Links.mp3192 || mp3Links.mp3128 || Object.values(mp3Links)[0];
        
        if (!keyObj || !keyObj.k) {
          throw new Error('Could not extract conversion key k');
        }
        
        const k = keyObj.k;
        console.log(`[Y2Mate API] Got conversion key from ${domain}, starting conversion...`);
        
        // Step 2: Convert to get download URL
        const convertUrl = `https://${domain}/mates/convertV2/ajax`;
        const convertParams = new URLSearchParams({
          vid: videoId,
          k: k
        });
        
        const convertRes = await fetch(convertUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Origin': `https://${domain}`,
            'Referer': `https://${domain}/en`,
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: convertParams.toString(),
          timeout: 6000
        });
        
        if (!convertRes.ok) {
          throw new Error(`Convert HTTP ${convertRes.status}`);
        }
        
        const convertData = await convertRes.json();
        if (convertData.status !== 'success' || (!convertData.dlink && !convertData.result)) {
          throw new Error(convertData.mess || 'Conversion failed or download link not found');
        }
        
        // If direct link is provided
        if (convertData.dlink) {
          console.log(`[Y2Mate API] ✅ SUCCESS: Got stream URL directly from ${domain}`);
          return convertData.dlink;
        }
        
        // If returned inside HTML result field
        if (convertData.result) {
          const hrefMatch = convertData.result.match(/href="([^"]+)"/);
          if (hrefMatch && hrefMatch[1]) {
            console.log(`[Y2Mate API] ✅ SUCCESS: Got stream URL from result HTML on ${domain}`);
            return hrefMatch[1];
          }
        }
        
        throw new Error('No downloadable URL found in conversion response');
      } catch (err) {
        console.error(`[Y2Mate API Error] ❌ Domain ${domain} failed for ${videoId}:`, err.message);
        // Continue to next domain in loop
      }
    }
    
    console.error(`[Y2Mate API Error] ❌ All Y2Mate domains failed to extract MP3 for ${videoId}`);
    return null;
  }
};
