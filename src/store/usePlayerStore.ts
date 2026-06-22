import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Track } from '../types';
import { musicService } from '../services/musicService';
import { toast } from 'sonner';

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  progress: number;
  recentlyPlayed: Track[];
  isShuffle: boolean;
  isRepeat: boolean;
  isAutoplay: boolean;

  playTrack: (track: Track, newQueue?: Track[]) => void;
  playNext: () => Promise<void> | void;
  playPrevious: () => void;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setProgress: (progress: number) => void;
  addToQueue: (track: Track) => void;
  addMultipleToQueue: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  jumpToQueueIndex: (index: number) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleAutoplay: () => void;
  setIsPlaying: (playing: boolean) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      volume: 80,
      isMuted: false,
      progress: 0,
      recentlyPlayed: [],
      isShuffle: false,
      isRepeat: false,
      isAutoplay: true,

      playTrack: (track: Track, newQueue?: Track[]) => {
        set((state) => {
          const updatedRecentlyPlayed = [
            track,
            ...state.recentlyPlayed.filter((t) => t.id !== track.id),
          ].slice(0, 50); // Keep last 50 for deep Spotify-like memory

          let queue = newQueue ? newQueue : [track];
          let queueIndex = newQueue ? newQueue.findIndex((t) => t.id === track.id) : 0;

          if (queueIndex === -1 && newQueue) {
            queue = [track, ...newQueue];
            queueIndex = 0;
          }

          return {
            currentTrack: track,
            isPlaying: true, // Auto-play when explicitly chosen
            recentlyPlayed: updatedRecentlyPlayed,
            queue,
            queueIndex,
            progress: 0,
          };
        });
      },

      playNext: async () => {
        const { queue, queueIndex, isRepeat, isShuffle, isAutoplay, currentTrack, recentlyPlayed } = get();
        if (queue.length === 0) return;

        let nextIndex = queueIndex + 1;

        if (isShuffle) {
          nextIndex = Math.floor(Math.random() * queue.length);
        } else if (nextIndex >= queue.length) {
          if (isRepeat) {
            nextIndex = 0;
          } else if (isAutoplay && currentTrack) {
            // Intelligent Autoplay Engine: Fallback if background batching didn't finish
            const toastId = toast.loading("Generating radio...");
            try {
              // The musicService now fully handles duplicate scoring and artist cooldowns
              const newTracks = await musicService.getRelatedTracks(currentTrack, recentlyPlayed);

              if (newTracks.length > 0) {
                toast.dismiss(toastId);
                set((state) => ({
                  queue: [...state.queue, ...newTracks],
                  queueIndex: state.queue.length,
                  currentTrack: newTracks[0],
                  isPlaying: true,
                  progress: 0
                }));
                return;
              }
            } catch (error) {
              console.error("Autoplay failed", error);
            }
            toast.dismiss(toastId);
            // Fallback if autoplay fails
            set({ isPlaying: false, progress: 0 });
            return;
          } else {
            // End of queue, stop playing
            set({ isPlaying: false, progress: 0 });
            return;
          }
        }

        const track = queue[nextIndex];
        set({ currentTrack: track, queueIndex: nextIndex, isPlaying: true, progress: 0 });
      },

      playPrevious: () => {
        const { queue, queueIndex, progress } = get();
        if (queue.length === 0) return;

        // If played more than 3 seconds, restart current track
        if (progress > 3) {
          set({ progress: 0 });
          return;
        }

        let prevIndex = queueIndex - 1;
        if (prevIndex < 0) prevIndex = queue.length - 1; // cycle back to end if we want, or just 0

        const track = queue[prevIndex];
        set({ currentTrack: track, queueIndex: prevIndex, isPlaying: true, progress: 0 });
      },

      togglePlayPause: () => {
        set((state) => ({ isPlaying: !state.isPlaying }));
      },
      setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),

      setVolume: (volume: number) => set({ volume, isMuted: volume === 0 }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      setProgress: (progress: number) => set({ progress }),

      addToQueue: (track: Track) =>
        set((state) => ({ queue: [...state.queue, track] })),
        
      addMultipleToQueue: (tracks: Track[]) =>
        set((state) => ({ queue: [...state.queue, ...tracks] })),
      
      removeFromQueue: (index: number) =>
        set((state) => {
          const newQueue = [...state.queue];
          newQueue.splice(index, 1);
          // adjust queueIndex if needed
          let newIdx = state.queueIndex;
          if (index < newIdx) newIdx--;
          else if (index === newIdx) {
            // removed current track?
            // handled manually or just play next in UI
          }
          return { queue: newQueue, queueIndex: newIdx };
        }),
      
      jumpToQueueIndex: (index: number) => set((state) => {
        if (index >= 0 && index < state.queue.length) {
          return { currentTrack: state.queue[index], queueIndex: index, isPlaying: true, progress: 0 };
        }
        return state;
      }),
      
      clearQueue: () => set({ queue: [], queueIndex: -1, currentTrack: null, isPlaying: false }),
      toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),
      toggleRepeat: () => set((state) => ({ isRepeat: !state.isRepeat })),
      toggleAutoplay: () => set((state) => ({ isAutoplay: !state.isAutoplay })),
    }),
    {
      name: 'tunewave-player-storage',
      // only persist some fields
      partialize: (state) => ({
        volume: state.volume,
        recentlyPlayed: state.recentlyPlayed,
        queue: state.queue,
        queueIndex: state.queueIndex,
        currentTrack: state.currentTrack,
        isShuffle: state.isShuffle,
        isRepeat: state.isRepeat,
        isAutoplay: state.isAutoplay
      }),
    }
  )
);
