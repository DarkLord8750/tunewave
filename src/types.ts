export interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string; // e.g. "3:45"
  youtubeId: string;
  spotifyPreview?: string;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  tracks: Track[];
  createdAt: number;
}
