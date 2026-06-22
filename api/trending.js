import { getTrendingMusic } from './services/ytmusicService.js';

export default async function handler(req, res) {
  try {
    const results = await getTrendingMusic();
    res.json(results);
  } catch (error) {
    console.error('Error in trending:', error);
    res.status(500).json({ success: false, error: 'Failed to get trending music' });
  }
}
