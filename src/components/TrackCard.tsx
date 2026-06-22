import { useState, useRef, useEffect } from 'react';
import { Track } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistStore } from '../store/usePlaylistStore';
import { Play, MoreVertical, Plus, ListPlus } from 'lucide-react';
import { cn } from '../utils/cn';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface TrackCardProps {
  track: Track;
  contextQueue?: Track[];
  className?: string;
}

export function TrackCard({ track, contextQueue, className }: TrackCardProps) {
  const { playTrack, currentTrack, isPlaying, addToQueue } = usePlayerStore();
  const { playlists, addTrackToPlaylist } = usePlaylistStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const isCurrent = currentTrack?.id === track.id;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    playTrack(track, contextQueue);
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track);
    setShowMenu(false);
    toast.success('Added to queue');
  };

  const handleAddToPlaylist = (e: React.MouseEvent, plId: string) => {
    e.stopPropagation();
    addTrackToPlaylist(plId, track);
    setShowMenu(false);
    toast.success('Added to playlist');
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={itemVariants}
      className={cn("group relative glass-panel track-card-hover rounded-2xl p-4 cursor-pointer isolate flex flex-col gap-3", className)}
      onClick={handlePlay}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl shadow-2xl">
        <img 
          src={track.thumbnail} 
          alt={track.title} 
          className="object-cover w-full h-full transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all duration-500 flex-col gap-1",
          isCurrent && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
           {isCurrent && isPlaying ? (
              <div className="flex items-end gap-1 h-6">
                <div className="w-1.5 h-full bg-tunewave-accent animate-[pulse_1s_ease-in-out_infinite]" />
                <div className="w-1.5 h-3/4 bg-tunewave-accent animate-[pulse_1.2s_ease-in-out_infinite_0.2s]" />
                <div className="w-1.5 h-1/2 bg-tunewave-accent animate-[pulse_0.8s_ease-in-out_infinite_0.4s]" />
              </div>
           ) : (
            <button className="w-14 h-14 rounded-full btn-primary text-white flex items-center justify-center shadow-[0_0_30px_rgba(177,77,255,0.6)] transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 ease-out">
              <Play className="w-7 h-7 fill-current ml-1" />
            </button>
           )}
        </div>
        
        {/* Context Menu Toggle */}
        <button 
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {showMenu && (
          <div 
            ref={menuRef}
            onClick={e => e.stopPropagation()}
            className="absolute top-10 right-2 w-48 bg-[#181818] border border-white/10 shadow-2xl rounded-lg py-1 z-50 text-sm overflow-hidden"
          >
            <button 
              onClick={handleAddToQueue}
              className="w-full px-4 py-2 text-left hover:bg-white/10 flex items-center gap-2"
            >
              <ListPlus className="w-4 h-4" /> Add to Queue
            </button>
            <div className="border-t border-white/10 my-1"></div>
            <div className="px-3 py-1 text-xs text-white/50 uppercase font-semibold">Add to Playlist</div>
            <div className="max-h-32 overflow-y-auto hide-scrollbar">
              {playlists.length === 0 ? (
                <div className="px-4 py-2 text-white/40 text-xs">No playlists</div>
              ) : (
                playlists.map(pl => (
                  <button 
                    key={pl.id}
                    onClick={(e) => handleAddToPlaylist(e, pl.id)}
                    className="w-full px-4 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 truncate"
                  >
                    <Plus className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{pl.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <div>
        <h3 className={cn(
          "font-display font-bold text-base truncate tracking-tight",
          isCurrent ? "text-gradient" : "text-white/90 group-hover:text-tunewave-accent-soft transition-colors"
        )}>
          {track.title}
        </h3>
        <p className="text-white/50 text-sm truncate mt-1">
          {track.artist}
        </p>
      </div>
    </motion.div>
  );
}
