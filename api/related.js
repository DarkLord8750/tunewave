import { getRelatedMusic } from './services/ytmusicService.js';

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Query parameter "id" is required' });
    }
    const results = await getRelatedMusic(id);
    res.json(results);
  } catch (error) {
    console.error('Error in related:', error);
    res.status(500).json({ success: false, error: 'Failed to get related music' });
  }
}
