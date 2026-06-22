import fetch from 'node-fetch';
import { initYTMusic } from './ytmusicService.js';

export const spotifyService = {
  async resolveTrack(trackId) {
    if (!trackId) return null;
    
    const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
    console.log(`[Spotify Service] Resolving Spotify Track ID: ${trackId}`);
    
    try {
      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 6000
      });
      
      if (!response.ok) {
        throw new Error(`Spotify embed returned HTTP ${response.status}`);
      }
      
      const html = await response.text();
      
      // Parse the initial state JSON from the embed page
      const stateMatch = html.match(/<script\s+id="initial-state"\s+type="text\/javascript">([\s\S]*?)<\/script>/i) ||
                         html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/i);
                         
      if (!stateMatch) {
        throw new Error('Could not find initial-state or NEXT_DATA in Spotify page HTML');
      }
      
      const rawText = stateMatch[1].trim();
      const decoded = JSON.parse(rawText);
      
      // Navigate deep into the JSON state to extract entity
      const state = decoded.props?.pageProps?.state;
      if (!state || !state.data || !state.data.entity) {
        throw new Error('Spotify returned 404 or empty track entity');
      }
      
      const entity = state.data.entity;
      const title = entity.name || entity.title;
      const artist = entity.artists && entity.artists.length > 0 
        ? entity.artists.map(a => a.name).join(', ') 
        : 'Unknown Artist';
      
      const thumbnail = entity.coverArt && entity.coverArt.sources && entity.coverArt.sources.length > 0
        ? entity.coverArt.sources[0].url
        : '';
        
      const durationMs = entity.duration || 0;
      const seconds = Math.floor(durationMs / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const duration = `${mins}:${secs.toString().padStart(2, '0')}`;
      
      const spotifyPreview = entity.audioPreview?.url || '';
      
      console.log(`[Spotify Service] Extracted Track: "${title}" by "${artist}" (Duration: ${duration}, Has Preview: ${!!spotifyPreview})`);
      
      // Query YouTube Music to map this track to a playable video ID
      console.log(`[Spotify Service] Searching YouTube Music for: "${title} ${artist}"`);
      const yt = await initYTMusic();
      const ytResults = await yt.search(`${title} ${artist}`, 'SONG');
      
      if (ytResults && ytResults.length > 0) {
        const bestMatch = ytResults[0];
        console.log(`[Spotify Service] Resolved to YouTube Video ID: ${bestMatch.videoId} ("${bestMatch.name}")`);
        
        return {
          id: bestMatch.videoId,
          youtubeId: bestMatch.videoId,
          title: title, // Preserve the clean Spotify title
          artist: artist, // Preserve clean Spotify artist names
          thumbnail: thumbnail || (bestMatch.thumbnails && bestMatch.thumbnails.length > 0 ? bestMatch.thumbnails[bestMatch.thumbnails.length - 1].url : ''),
          duration: duration || '0:00',
          spotifyPreview: spotifyPreview
        };
      } else {
        throw new Error('No matching song found on YouTube Music');
      }
      
    } catch (err) {
      console.error(`[Spotify Service Error] Failed to resolve Spotify link:`, err.message);
      return null;
    }
  }
};
