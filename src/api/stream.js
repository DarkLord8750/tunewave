import express from 'express';
import ytDlpService from './services/ytDlpService.js';
import pipedApiService from './services/pipedApiService.js';
import rateLimitMiddleware from './middleware/rateLimitMiddleware.js';

const router = express.Router();

/**
 * GET /api/stream/:videoId
 * Extract and return stream URL for a YouTube video
 * 
 * Strategy:
 * 1. Check cache first
 * 2. Try Piped API (faster, doesn't trigger YouTube bot detection)
 * 3. Fall back to yt-dlp with retry logic
 * 4. Cache result for 24 hours
 */
router.get('/:videoId', rateLimitMiddleware, async (req, res) => {
  const { videoId } = req.params;
  
  if (!videoId || !videoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
    return res.status(400).json({ error: 'Invalid video ID format' });
  }
  
  try {
    console.log(`[Stream Request] Incoming request for ${videoId}`);
    
    // Strategy 1: Try Piped API first (no bot detection issues)
    try {
      console.log(`[Stream] Attempting Piped API for ${videoId}`);
      const streamUrl = await pipedApiService.fetchFromPiped(videoId);
      
      if (streamUrl) {
        return res.json({
          success: true,
          url: streamUrl,
          source: 'piped',
          videoId
        });
      }
    } catch (pipedError) {
      console.log(`[Stream] Piped API failed for ${videoId}:`, pipedError.message);
      // Continue to yt-dlp fallback
    }
    
    // Strategy 2: Fall back to yt-dlp
    try {
      console.log(`[Stream] Attempting yt-dlp for ${videoId}`);
      const streamUrl = await ytDlpService.extractStreamUrl(videoId);
      
      return res.json({
        success: true,
        url: streamUrl,
        source: 'yt-dlp',
        videoId
      });
    } catch (ytDlpError) {
      console.error(`[Stream] yt-dlp failed for ${videoId}:`, ytDlpError.message);
      
      return res.status(503).json({
        error: 'Unable to extract stream from both Piped API and yt-dlp. YouTube may be blocking requests.',
        details: {
          videoId,
          piped_status: 'failed',
          ytdlp_status: 'failed'
        },
        retry: true
      });
    }
    
  } catch (error) {
    console.error(`[Stream Handler Error] ${videoId}:`, error);
    
    res.status(500).json({
      error: 'Internal server error while processing stream',
      videoId
    });
  }
});

/**
 * GET /api/stream/:videoId/info
 * Get video metadata (title, duration, thumbnail)
 */
router.get('/:videoId/info', async (req, res) => {
  const { videoId } = req.params;
  
  if (!videoId || !videoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
    return res.status(400).json({ error: 'Invalid video ID format' });
  }
  
  try {
    // Try Piped API first
    try {
      const info = await pipedApiService.getVideoInfo(videoId);
      return res.json({
        success: true,
        data: {
          title: info.title,
          duration: info.duration,
          thumbnail: info.thumbnailUrl,
          uploader: info.uploader,
          views: info.views
        }
      });
    } catch (pipedError) {
      // Fall back to yt-dlp
      const metadata = await ytDlpService.extractStreamMetadata(videoId);
      return res.json({
        success: true,
        data: metadata
      });
    }
  } catch (error) {
    console.error(`[Info Handler Error] ${videoId}:`, error);
    
    res.status(500).json({
      error: 'Unable to fetch video information',
      videoId
    });
  }
});

export default router;
