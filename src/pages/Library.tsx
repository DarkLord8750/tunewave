import { usePlaylistStore } from '../store/usePlaylistStore';
import { TrackCard } from '../components/TrackCard';
import { Library as LibraryIcon, ListMusic } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Library() {
  const { playlists, likedSongs } = usePlaylistStore();

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <section className="relative overflow-hidden rounded-3xl bg-tunewave-surface/50 p-8 md:p-12 border border-white/5">
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4 flex items-center gap-4">
          <LibraryIcon className="w-10 h-10 text-tunewave-accent" />
          Your Library
        </h1>
      </section>

      <section>
        <h2 className="text-2xl font-bold font-display tracking-tight mb-6">Playlists</h2>
        {playlists.length === 0 ? (
          <div className="text-center py-20 text-white/50 border border-white/5 rounded-2xl bg-white/5 border-dashed">
            <ListMusic className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl">You haven't created any playlists yet</p>
            <p className="text-sm mt-2">Create one from the sidebar!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
            {playlists.map(pl => (
              <Link 
                key={pl.id} 
                to={`/playlist/${pl.id}`}
                className="group relative bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg shadow-lg bg-tunewave-ink flex items-center justify-center border border-white/5">
                  {pl.thumbnail ? (
                    <img src={pl.thumbnail} alt={pl.title} className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic className="w-16 h-16 text-white/20" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-base truncate group-hover:text-tunewave-accent transition-colors">{pl.title}</h3>
                  <p className="text-white/50 text-sm truncate mt-1">Playlist • {pl.tracks.length} songs</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {likedSongs.length > 0 && (
        <section>
           <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold font-display tracking-tight">Liked Songs</h2>
            <Link to="/liked" className="text-sm text-tunewave-accent hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
            {likedSongs.slice(0, 5).map(track => (
              <TrackCard key={`liked-${track.id}`} track={track} contextQueue={likedSongs} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
