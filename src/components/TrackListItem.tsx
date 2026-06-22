import { Track } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistStore } from '../store/usePlaylistStore';
import { MoreVertical, Play, Heart } from 'lucide-react';
import { cn } from '../utils/cn';
import { useState, useRef, useEffect } from 'react';

interface TrackListItemProps {
  track: Track;
  contextQueue?: Track[];
}

export function TrackListItem({ track, contextQueue }: TrackListItemProps) {
  const { playTrack, currentTrack, isPlaying } = usePlayerStore();
  const { isLiked, toggleLikeSong } = usePlaylistStore();
  
  const isCurrent = currentTrack?.id === track.id;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    playTrack(track, contextQueue);
  };

  return (
    <div 
      className={cn(
        "group flex items-center gap-3 p-2 rounded-xl transition-all active:scale-[0.98] cursor-pointer",
        isCurrent ? "bg-white/10" : "hover:bg-white/5"
      )}
      onClick={handlePlay}
    >
      <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
        <img 
          src={track.thumbnail} 
          alt={track.title} 
          className="w-full h-full object-cover transition-transform group-hover:scale-110"
        />
        <div className={cn(
          "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity",
          isCurrent && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
           {isCurrent && isPlaying ? (
              <div className="flex items-end gap-0.5 h-4">
                <div className="w-1 h-full bg-tunewave-accent animate-[pulse_1s_ease-in-out_infinite]" />
                <div className="w-1 h-3/4 bg-tunewave-accent animate-[pulse_1.2s_ease-in-out_infinite_0.2s]" />
                <div className="w-1 h-1/2 bg-tunewave-accent animate-[pulse_0.8s_ease-in-out_infinite_0.4s]" />
              </div>
           ) : (
            <Play className="w-6 h-6 text-white ml-0.5 fill-current" />
           )}
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <h4 className={cn(
          "text-sm font-semibold truncate",
          isCurrent ? "text-tunewave-accent" : "text-white"
        )}>
          {track.title}
        </h4>
        <p className="text-xs text-white/50 truncate mt-0.5">
          {track.artist}
        </p>
      </div>
      
      <button 
        onClick={(e) => { e.stopPropagation(); toggleLikeSong(track); }}
        className="p-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity md:hidden:opacity-100"
      >
        <Heart 
          className="w-5 h-5 transition-colors" 
          fill={isLiked(track.id) ? "var(--color-tunewave-accent)" : "none"} 
          color={isLiked(track.id) ? "var(--color-tunewave-accent)" : "rgba(255,255,255,0.5)"} 
        />
      </button>
    </div>
  );
}
