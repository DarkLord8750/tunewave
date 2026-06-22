import { Track } from '../types';
import { mockTracks } from './mockData';



const searchCache = new Map<string, Track[]>();

export function cleanMetadata(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[.*?\]|\(.*?\)|\{.*?\}/g, '') // remove brackets and their contents
    .replace(/official|video|audio|lyric|lyrics|remastered|hd|4k|slowed|reverb|bass boosted|live|visualizer/gi, '')
    .replace(/feat\.|ft\.|featuring/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, '') // remove special chars
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export const musicService = {
  async search(query: string, signal?: AbortSignal): Promise<Track[]> {
    try {
      const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
      if (!searchRes.ok) throw new Error('Search failed');
      const searchData = await searchRes.json();
      
      return searchData.map((item: any) => ({
        ...item,
        duration: item.duration || '0:00'
      }));
    } catch (error: any) {
      if (error.name === 'AbortError') throw error;
      console.error(error);
      return mockTracks.filter(t => t.title.toLowerCase().includes(query.toLowerCase()) || t.artist.toLowerCase().includes(query.toLowerCase()));
    }
  },

  async getTrending(): Promise<Track[]> {
    try {
      const res = await fetch(`/api/trending`);
      if (!res.ok) throw new Error('Trending failed');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch trending tracks", error);
      return mockTracks;
    }
  },

  async getRelatedTracks(currentTrack: Track, recentlyPlayed: Track[] = []): Promise<Track[]> {
    try {
      const cacheKey = `related_${currentTrack.youtubeId}`;
      
      let tracks: Track[] = [];
      if (searchCache.has(cacheKey)) {
        tracks = searchCache.get(cacheKey)!;
      } else {
        const res = await fetch(`/api/related?id=${currentTrack.youtubeId}`);
        if (!res.ok) throw new Error('Related failed');
        tracks = await res.json();
        searchCache.set(cacheKey, tracks);
      }
      
      return this._scoreAndFilterTracks(tracks, recentlyPlayed);
    } catch (error) {
      console.error("Failed to fetch related tracks", error);
      return [];
    }
  },

  _scoreAndFilterTracks(tracks: Track[], recentlyPlayed: Track[]): Track[] {
    const recentCleanTitles = new Set(recentlyPlayed.map(t => cleanMetadata(t.title)));
    const recentArtists = recentlyPlayed.map(t => cleanMetadata(t.artist));
    
    return tracks
      .map(t => {
        let score = 50; // base score
        const tCleanTitle = cleanMetadata(t.title);
        const tCleanArtist = cleanMetadata(t.artist);
        
        // 1. Duplicate Prevention
        if (recentCleanTitles.has(tCleanTitle)) {
          score -= 100; // Reject recently played songs
        }
        
        // 2. Artist Cooldown (Spotify-like artist rotation)
        const last5Artists = recentArtists.slice(0, 5);
        if (last5Artists.includes(tCleanArtist)) {
          score -= 30; // Heavy penalty if played very recently
        } else if (recentArtists.includes(tCleanArtist)) {
          score -= 10; // Light penalty if played in the session
        }

        // 3. Official Content Priority
        const channelName = t.artist.toLowerCase();
        if (channelName.includes('vevo') || channelName.includes('official') || channelName.includes('topic')) {
          score += 20;
        }

        // 4. Duration Optimization
        const parts = t.duration.split(':');
        if (parts.length > 2) {
          score -= 100; // Reject hour-long compilations
        } else {
          const mins = parseInt(parts[0]);
          if (mins < 2 || mins > 6) score -= 20; // Penalize very short or long songs
          if (mins > 8) score -= 100; // Reject strictly > 8 mins
        }
        
        // 5. Metadata Cleaning Penalties
        const rawLower = t.title.toLowerCase();
        if (rawLower.includes('cover') || rawLower.includes('karaoke') || rawLower.includes('slowed') || rawLower.includes('reverb') || rawLower.includes('8d') || rawLower.includes('live')) {
          score -= 50;
        }

        // 6. Advanced Discovery Randomization (Studio Feature)
        // Add a random variance between -5 and +5 so that tracks with the same base score shuffle dynamically!
        score += Math.floor(Math.random() * 10) - 5;

        return { track: t, score };
      })
      .filter(item => item.score > 0) // Drop anything with a negative score
      .sort((a, b) => b.score - a.score) // Sort by highest recommendation score
      .map(item => item.track);
  }
};
