import { searchMusic } from './services/ytmusicService.js';
import { spotifyService } from './services/spotifyService.js';

export default async function handler(req, res) {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }

    // Check if the query is a Spotify track URL
    if (typeof q === 'string' && q.includes('open.spotify.com/track/')) {
      const match = q.match(/track\/([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        const track = await spotifyService.resolveTrack(match[1]);
        if (track) {
          return res.json([track]);
        }
      }
      return res.status(404).json({ success: false, error: 'Failed to resolve Spotify track link' });
    }

    const results = await searchMusic(q);
    res.json(results);
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ success: false, error: 'Failed to search music' });
  }
}
