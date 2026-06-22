import fetch from 'node-fetch';

function cleanYouTubeNoise(title) {
  if (!title) return '';
  
  const NOISE_KEYWORDS = [
    'official', 'video', 'audio', 'hd', '4k', '8k', '1080p', '720p',
    'lyrics', 'lyrical', 'full', 'clip', 'mv', 'mp3', 'widescreen',
    'version', 'remaster', 'remastered', 'visualizer', 'sub', 'subs',
    'subtitle', 'subtitles', 'hq', 'screen', 'original', 'music'
  ];
  
  return title.replace(/([(\[{])(.*?)([)\]}])/g, (match, open, content) => {
    const cleanContent = content.toLowerCase().trim();
    const hasNoise = NOISE_KEYWORDS.some(keyword => cleanContent.includes(keyword));
    if (hasNoise) {
      return '';
    }
    return ' ' + content + ' ';
  })
  .replace(/["']/g, '')
  .replace(/\s+/g, ' ')
  .trim();
}

function cleanString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)|\{.*?\}/g, '') // remove brackets and content
    .replace(/[^a-z0-9\s]/g, '')            // remove special characters
    .replace(/\s+/g, ' ')                   // normalize spaces
    .trim();
}

function isMetadataMatch(requestedTitle, requestedArtist, saavnResult) {
  const reqTitleClean = cleanString(requestedTitle);
  const resTitleClean = cleanString(saavnResult.name);
  
  // If the base title is not even remotely in the result name and vice versa, reject
  if (!reqTitleClean.includes(resTitleClean) && !resTitleClean.includes(reqTitleClean)) {
    return false;
  }
  
  // 1. Movie Hint Verification
  const movieMatch = requestedTitle.match(/(?:from|ost|theme|movie)\s+["']?([^"')\]}]+)["']?/i);
  if (movieMatch) {
    const requestedMovieClean = cleanString(movieMatch[1]);
    if (requestedMovieClean.length > 1) {
      const saavnAlbumClean = saavnResult.album && saavnResult.album.name ? cleanString(saavnResult.album.name) : '';
      const saavnTitleClean = cleanString(saavnResult.name);
      
      const albumContainsMovie = saavnAlbumClean.includes(requestedMovieClean) || requestedMovieClean.includes(saavnAlbumClean);
      const titleContainsMovie = saavnTitleClean.includes(requestedMovieClean);
      
      if (!albumContainsMovie && !titleContainsMovie) {
        console.log(`[Saavn Verification] Rejecting: Movie hint "${requestedMovieClean}" does not match Saavn album "${saavnAlbumClean}"`);
        return false;
      }
    }
  }

  // 2. Artist Verification
  const reqArtistClean = cleanString(requestedArtist);
  const resArtistsClean = (saavnResult.artists?.primary || [])
    .map(a => cleanString(a.name))
    .filter(a => a.length > 0);
  
  let artistMatch = false;
  if (!reqArtistClean || resArtistsClean.length === 0 || reqArtistClean === 'various artists') {
    artistMatch = true; // Skip artist validation if missing or generic
  } else {
    // Check direct matches
    for (const artist of resArtistsClean) {
      if (artist.length > 2 && (reqArtistClean.includes(artist) || artist.includes(reqArtistClean))) {
        artistMatch = true;
        break;
      }
    }
    
    // Check keyword overlaps
    if (!artistMatch) {
      const reqWords = reqArtistClean.split(' ').filter(w => w.length > 3);
      for (const word of reqWords) {
        for (const artist of resArtistsClean) {
          if (artist.includes(word)) {
            artistMatch = true;
            break;
          }
        }
        if (artistMatch) break;
      }
    }
  }
  
  // 3. Album / Subtitle Verification
  let albumMatch = false;
  if (saavnResult.album && saavnResult.album.name) {
    const resAlbumClean = cleanString(saavnResult.album.name);
    const originalTitleClean = cleanString(requestedTitle.replace(/[^a-zA-Z0-9\s]/g, ''));
    if (resAlbumClean.length > 2 && (reqTitleClean.includes(resAlbumClean) || originalTitleClean.includes(resAlbumClean))) {
      albumMatch = true;
    }
  }
  
  if (albumMatch) {
    return true;
  }
  
  return artistMatch;
}

export const saavnService = {
  async getStreamUrl(title, artist) {
    if (!title) return null;
    
    const cleanTitle = cleanYouTubeNoise(title);
    const cleanArtist = artist ? cleanYouTubeNoise(artist) : '';
    const query = cleanArtist ? `${cleanTitle} ${cleanArtist}` : cleanTitle;
    
    const url = `https://saavn.sumit.co/api/search/songs?query=${encodeURIComponent(query)}`;
    
    try {
      console.log(`[Saavn API] Searching for: "${query}"`);
      const response = await fetch(url, { 
        timeout: 6000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const resData = await response.json();
      if (!resData.success || !resData.data || !resData.data.results || resData.data.results.length === 0) {
        console.log(`[Saavn API] No results found for "${query}"`);
        return null;
      }
      
      // Select the first result that passes metadata verification
      let bestMatch = null;
      for (const result of resData.data.results) {
        if (isMetadataMatch(title, artist, result)) {
          bestMatch = result;
          break;
        }
      }
      
      if (!bestMatch) {
        console.log(`[Saavn API] ❌ Rejecting all JioSaavn search results for "${query}" due to metadata mismatch.`);
        return null;
      }
      
      console.log(`[Saavn API] Found verified match: "${bestMatch.name}" by ${bestMatch.artists?.primary?.[0]?.name || 'Unknown'} (Album: ${bestMatch.album?.name || 'N/A'})`);
      
      const downloadUrls = bestMatch.downloadUrl;
      if (!downloadUrls || downloadUrls.length === 0) {
        return null;
      }
      
      // Prefer highest quality links
      const preferredQualities = ['320kbps', '160kbps', '96kbps'];
      for (const q of preferredQualities) {
        const found = downloadUrls.find(u => u.quality === q);
        if (found && found.url) {
          console.log(`[Saavn API] Selected quality: ${q}`);
          return found.url;
        }
      }
      
      // Fallback to highest quality available
      const fallbackUrl = downloadUrls[downloadUrls.length - 1].url;
      console.log(`[Saavn API] Selected quality: ${downloadUrls[downloadUrls.length - 1].quality}`);
      return fallbackUrl;
    } catch (err) {
      console.error(`[Saavn API Error] Failed to search JioSaavn:`, err.message);
      return null;
    }
  }
};
