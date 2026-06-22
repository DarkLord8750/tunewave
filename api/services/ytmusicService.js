import YTMusic from "ytmusic-api";
import { metadataCache } from "./cacheService.js";

const ytmusic = new YTMusic();
let isInitialized = false;

export const initYTMusic = async () => {
  if (!isInitialized) {
    await ytmusic.initialize();
    isInitialized = true;
  }
  return ytmusic;
};

// Map ytmusic-api track format to TuneWave's Track interface
const mapSearchTrack = (item) => ({
  id: item.videoId,
  youtubeId: item.videoId,
  title: item.name || item.title,
  artist: item.artist ? item.artist.name : (item.artists ? (typeof item.artists === 'string' ? item.artists : item.artists.map(a=>a.name).join(', ')) : "Unknown Artist"),
  thumbnail: item.thumbnails ? (Array.isArray(item.thumbnails) ? item.thumbnails[item.thumbnails.length - 1].url : item.thumbnails) : (item.thumbnail || ""),
  duration: formatDuration(item.duration),
});

const mapRelatedTrack = (item) => ({
  id: item.videoId,
  youtubeId: item.videoId,
  title: item.title || item.name,
  artist: typeof item.artists === 'string' ? item.artists : (item.artist?.name || "Unknown Artist"),
  thumbnail: item.thumbnail || (item.thumbnails ? item.thumbnails[item.thumbnails.length - 1].url : ""),
  duration: item.duration || "0:00", // Usually already formatted in getUpNexts
});

const formatDuration = (val) => {
  if (!val) return "0:00";
  if (typeof val === "string") return val; 
  
  let seconds = val;
  if (seconds > 1000) seconds = Math.floor(seconds / 1000); 

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const searchMusic = async (query) => {
  const cacheKey = `search_${query}`;
  if (metadataCache.has(cacheKey)) return metadataCache.get(cacheKey);

  const yt = await initYTMusic();
  const results = await yt.search(query, "SONG");
  
  const tracks = results.map(mapSearchTrack).filter(t => t.id);
  metadataCache.set(cacheKey, tracks, 3600);
  return tracks;
};

export const getTrendingMusic = async () => {
  const cacheKey = "trending_music";
  if (metadataCache.has(cacheKey)) return metadataCache.get(cacheKey);

  const yt = await initYTMusic();
  // Using a highly specific query to ensure premium, official audio results
  const results = await yt.search("Top Global Tracks Chart Official", "SONG");
  
  const tracks = results.map(mapSearchTrack).filter(t => t.id);
  metadataCache.set(cacheKey, tracks, 3600);
  return tracks;
};

export const getRelatedMusic = async (videoId) => {
  const cacheKey = `related_${videoId}`;
  if (metadataCache.has(cacheKey)) return metadataCache.get(cacheKey);

  try {
    const yt = await initYTMusic();
    const upNext = await yt.getUpNexts(videoId);
    
    const tracks = upNext.map(mapRelatedTrack).filter(t => t.id);
    metadataCache.set(cacheKey, tracks, 3600);
    return tracks;
  } catch (error) {
    console.error("ytmusic-api getUpNexts failed, falling back to trending", error);
    return await getTrendingMusic();
  }
};

