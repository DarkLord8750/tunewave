import { searchMusic } from './services/ytmusicService.js';
import { spotifyService } from './services/spotifyService.js';

export default async function handler(req, res) {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }

    // Parse and sanitize limit parameter (default to 20, enforce bounds)
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const requested = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(requested) ? DEFAULT_LIMIT : Math.min(Math.max(requested, 1), MAX_LIMIT);

    // Check if the query is a Spotify track URL
    if (typeof q === 'string' && q.includes('open.spotify.com/track/')) {
      const match = q.match(/track\/([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        const track = await spotifyService.resolveTrack(match[1]);
        if (track) {
          // Return single resolved track (limit doesn't apply here)
          return res.json([track]);
        }
      }
      return res.status(404).json({ success: false, error: 'Failed to resolve Spotify track link' });
    }

    const results = await searchMusic(q);

    // Ensure we return at most `limit` items
    const limited = Array.isArray(results) ? results.slice(0, limit) : results;
    res.json(limited);
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ success: false, error: 'Failed to search music' });
  }
}
