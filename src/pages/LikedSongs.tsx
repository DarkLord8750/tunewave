import { usePlaylistStore } from '../store/usePlaylistStore';
import { TrackCard } from '../components/TrackCard';
import { Heart } from 'lucide-react';

export function LikedSongs() {
  const { likedSongs } = usePlaylistStore();

  return (
    <div className="space-y-12 animate-in fade-in duration-500 min-h-full">
      <div className="flex flex-col md:flex-row items-end gap-8 bg-gradient-to-b from-tunewave-surface to-transparent p-8 md:p-12 rounded-3xl border border-white/5">
        <div className="w-48 h-48 md:w-60 md:h-60 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden shrink-0 bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex items-center justify-center">
            <Heart className="w-24 h-24 text-white fill-current" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Playlist</p>
          <h1 className="text-5xl md:text-8xl font-display font-black tracking-tighter truncate">Liked Songs</h1>
          <div className="flex items-center gap-4 mt-4 opacity-70 text-sm font-medium">
            <span>{likedSongs.length} songs</span>
          </div>
        </div>
      </div>

      <div className="pt-8">
        {likedSongs.length === 0 ? (
          <div className="text-center py-20 text-white/50 bg-white/5 rounded-2xl border border-dashed border-white/10">
            <p className="text-xl">You don't have any liked songs.</p>
            <p className="text-sm mt-2">Tap the heart on any track to add it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
            {likedSongs.map(track => (
              <TrackCard key={`liked-page-${track.id}`} track={track} contextQueue={likedSongs} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
