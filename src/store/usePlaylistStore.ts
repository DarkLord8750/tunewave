import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Playlist, Track } from '../types';

interface PlaylistState {
  playlists: Playlist[];
  likedSongs: Track[];
  
  createPlaylist: (title: string, description?: string) => void;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  
  toggleLikeSong: (track: Track) => void;
  isLiked: (trackId: string) => boolean;
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],
      likedSongs: [],
      
      createPlaylist: (title, description) => {
        set((state) => ({
          playlists: [
            ...state.playlists,
            {
              id: `pl-${Date.now()}`,
              title,
              description,
              tracks: [],
              createdAt: Date.now()
            }
          ]
        }));
      },
      
      deletePlaylist: (id) => {
        set((state) => ({
          playlists: state.playlists.filter(p => p.id !== id)
        }));
      },
      
      addTrackToPlaylist: (playlistId, track) => {
        set((state) => ({
          playlists: state.playlists.map(p => {
            if (p.id === playlistId) {
              if (p.tracks.find(t => t.id === track.id)) return p; // prevent duplicates
              return {
                ...p,
                tracks: [...p.tracks, track],
                thumbnail: p.tracks.length === 0 ? track.thumbnail : p.thumbnail
              };
            }
            return p;
          })
        }));
      },
      
      removeTrackFromPlaylist: (playlistId, trackId) => {
        set((state) => ({
          playlists: state.playlists.map(p => {
            if (p.id === playlistId) {
              return { ...p, tracks: p.tracks.filter(t => t.id !== trackId) };
            }
            return p;
          })
        }));
      },
      
      toggleLikeSong: (track) => {
        set((state) => {
          const exists = state.likedSongs.find(t => t.id === track.id);
          if (exists) {
            return { likedSongs: state.likedSongs.filter(t => t.id !== track.id) };
          }
          return { likedSongs: [track, ...state.likedSongs] };
        });
      },
      
      isLiked: (trackId) => {
        return !!get().likedSongs.find(t => t.id === trackId);
      }
    }),
    {
      name: 'tunewave-playlists'
    }
  )
);
