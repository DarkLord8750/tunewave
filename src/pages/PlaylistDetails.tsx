import { useParams } from 'react-router-dom';
import { usePlaylistStore } from '../store/usePlaylistStore';
import { TrackCard } from '../components/TrackCard';
import { ListMusic, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PlaylistDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playlists, deletePlaylist } = usePlaylistStore();
  
  const playlist = playlists.find(p => p.id === id);

  if (!playlist) {
    return <div className="p-8 text-center text-white/50">Playlist not found.</div>;
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this playlist?')) {
      deletePlaylist(playlist.id);
      navigate('/library');
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 min-h-full">
      <div className="flex flex-col md:flex-row items-end gap-8 bg-gradient-to-b from-tunewave-surface to-transparent p-8 md:p-12 rounded-3xl border border-white/5">
        <div className="w-48 h-48 md:w-60 md:h-60 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden shrink-0 bg-tunewave-ink flex items-center justify-center">
          {playlist.thumbnail ? (
             <img src={playlist.thumbnail} alt={playlist.title} className="w-full h-full object-cover" />
          ) : (
            <ListMusic className="w-24 h-24 text-white/20" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Playlist</p>
          <h1 className="text-5xl md:text-8xl font-display font-black tracking-tighter truncate">{playlist.title}</h1>
          {playlist.description && <p className="text-white/60 text-lg mt-2">{playlist.description}</p>}
          <div className="flex items-center gap-4 mt-4 opacity-70 text-sm font-medium">
            <span>{playlist.tracks.length} songs</span>
          </div>
        </div>
        
        <button 
          onClick={handleDelete}
          className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors self-end md:self-center ml-auto flex-shrink-0"
          title="Delete Playlist"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="pt-8">
        {playlist.tracks.length === 0 ? (
          <div className="text-center py-20 text-white/50 bg-white/5 rounded-2xl border border-dashed border-white/10">
            <p className="text-xl">This playlist is empty</p>
            <p className="text-sm mt-2">Go search for songs and add them here!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
            {playlist.tracks.map(track => (
              <TrackCard key={`pl-${track.id}`} track={track} contextQueue={playlist.tracks} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
