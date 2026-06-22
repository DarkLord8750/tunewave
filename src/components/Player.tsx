import { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeEvent, YouTubeProps } from 'react-youtube';
import { Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Volume2, VolumeX, ListMusic, Heart, Radio, ChevronDown, Maximize2 } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistStore } from '../store/usePlaylistStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { musicService } from '../services/musicService';
import { getStreamUrl } from '../services/corsStreamService';
import { QueuePanel } from './QueuePanel';
import { cn } from '../utils/cn';
import { toast } from 'sonner';

export function Player() {
  const { currentTrack, queue, queueIndex, isPlaying, volume, isMuted, isShuffle, isRepeat, isAutoplay, progress, setIsPlaying, setProgress, togglePlayPause, playNext, playPrevious, toggleShuffle, toggleRepeat, toggleAutoplay, setVolume, toggleMute } = usePlayerStore();
  const { isLiked, toggleLikeSong } = usePlaylistStore();
  useKeyboardShortcuts();
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [isTrulyPlaying, setIsTrulyPlaying] = useState(false);

  // Sync isTrulyPlaying with global isPlaying if it was forcefully paused globally
  useEffect(() => {
    if (!isPlaying) setIsTrulyPlaying(false);
  }, [isPlaying]);
  const playerRef = useRef<any>(null); // YouTube player ref
  const audioRef = useRef<HTMLAudioElement>(null); // HTML5 audio ref
  const [duration, setDuration] = useState(0);
  const [localProgress, setLocalProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<'html5' | 'iframe'>('html5');
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const isFetchingAutoplayRef = useRef(false);

  // 1. Fetch stream URL when track changes
  useEffect(() => {
    if (!currentTrack) return;

    let isMounted = true;
    setIsLoadingStream(true);
    setStreamUrl(null); // Reset
    setPlaybackMode('html5'); // Reset to default mode
    
    // Stop previous playbacks
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (playerRef.current && playbackMode === 'iframe') {
      playerRef.current.pauseVideo();
    }

    const fetchStream = async () => {
      try {
        console.log(`[Player] Fetching stream for ${currentTrack.title} (${currentTrack.youtubeId})`);
        
        // Try backend first
        let streamUrlResult = null;
        
        try {
          let streamQuery = `/api/stream?id=${currentTrack.youtubeId}&title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist)}`;
          if (currentTrack.spotifyPreview) {
            streamQuery += `&spotifyPreview=${encodeURIComponent(currentTrack.spotifyPreview)}`;
          }
          const res = await fetch(streamQuery);
          const data = await res.json();
          
          if (data.success && data.streamUrl) {
            // If the source is JioSaavn, play the CDN link directly on the client.
            // This bypasses server proxy overhead and avoids datacenter IP blocks.
            if (data.source === 'jiosaavn' || data.streamUrl.includes('saavncdn.com')) {
              streamUrlResult = data.streamUrl;
              console.log('[Player] Playing direct JioSaavn CDN stream:', streamUrlResult);
            } else {
              // Use the backend proxy instead of raw external URLs to bypass firewalls (e.g. Spotify, YouTube)
              let proxyQuery = `/api/proxy?id=${currentTrack.youtubeId}&title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist)}`;
              if (currentTrack.spotifyPreview) {
                proxyQuery += `&spotifyPreview=${encodeURIComponent(currentTrack.spotifyPreview)}`;
              }
              streamUrlResult = proxyQuery;
              console.log('[Player] Backend stream successful, using proxy');
            }
          }
        } catch (backendErr) {
          console.warn('[Player] Backend stream failed, trying CORS proxy:', backendErr);
        }

        // Fallback to CORS proxy if backend fails
        if (!streamUrlResult) {
          console.log('[Player] Attempting CORS proxy stream...');
          streamUrlResult = await getStreamUrl(currentTrack.youtubeId);
        }
        
        if (!isMounted) return;

        if (streamUrlResult) {
          setStreamUrl(streamUrlResult);
          setPlaybackMode('html5');
          console.log('[Player] Stream URL acquired, ready to play');
        } else {
          throw new Error('Failed to get stream URL from all sources');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('[Player] Stream extraction failed, falling back to YouTube iframe:', err);
        setPlaybackMode('iframe');
        toast.error('Playing via YouTube (stream extraction failed)');
      } finally {
        if (isMounted) setIsLoadingStream(false);
      }
    };

    fetchStream();

    // Media Session API for mobile lock screen
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [{ src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
      });

      navigator.mediaSession.setActionHandler('play', () => { setIsPlaying(true); });
      navigator.mediaSession.setActionHandler('pause', () => { setIsPlaying(false); });
      navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }

    return () => { isMounted = false; };
  }, [currentTrack]);

  // Preload next track OR Autoplay Background Fetch
  useEffect(() => {
    if (!queue || queue.length === 0 || queueIndex < 0) return;
    
    if (!isShuffle && queueIndex + 1 < queue.length) {
      // Preload next track's audio stream into the backend cache
      const nextTrack = queue[queueIndex + 1];
      let preloadQuery = `/api/stream?id=${nextTrack.youtubeId}&title=${encodeURIComponent(nextTrack.title)}&artist=${encodeURIComponent(nextTrack.artist)}`;
      if (nextTrack.spotifyPreview) {
        preloadQuery += `&spotifyPreview=${encodeURIComponent(nextTrack.spotifyPreview)}`;
      }
      fetch(preloadQuery).catch(() => {});
    } else if (isAutoplay && currentTrack && queue.length - queueIndex <= 10 && !isFetchingAutoplayRef.current) {
      // Background Append for Autoplay: Buffer 30 tracks when we drop below 10 upcoming tracks
      const fetchAutoplay = async () => {
        isFetchingAutoplayRef.current = true;
        try {
          const lastTrackInQueue = queue[queue.length - 1] || currentTrack;
          
          // Combine queue and recently played to act as a strict session blacklist
          const sessionHistory = [
            ...usePlayerStore.getState().recentlyPlayed,
            ...usePlayerStore.getState().queue
          ];
          
          // The scoring engine will automatically blacklist duplicates and manage artist cooldowns
          const newTracks = await musicService.getRelatedTracks(lastTrackInQueue, sessionHistory);
          
          if (newTracks.length > 0) {
            usePlayerStore.getState().addMultipleToQueue(newTracks);
          }
        } catch (e) {
          console.error('[Player] Background autoplay fetch failed:', e);
        } finally {
          isFetchingAutoplayRef.current = false;
        }
      };
      fetchAutoplay();
    }
  }, [currentTrack, queue.length, queueIndex, isShuffle, isAutoplay]);

  // 2. Play/Pause state sync
  useEffect(() => {
    if (playbackMode === 'html5' && audioRef.current && streamUrl) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error('[Player] Audio play error:', e));
      } else {
        audioRef.current.pause();
      }
    } else if (playbackMode === 'iframe' && playerRef.current) {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying, streamUrl, playbackMode]);

  // 3. Volume and Mute sync
  useEffect(() => {
    const activeVolume = isMuted ? 0 : volume / 100;
    if (audioRef.current) {
      audioRef.current.volume = activeVolume;
    }
    if (playerRef.current) {
      if (isMuted) playerRef.current.mute();
      else {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
      }
    }
  }, [volume, isMuted]);

  // 4. Time Update Loop for HTML5
  const handleAudioTimeUpdate = () => {
    if (audioRef.current && !isSeeking) {
      setLocalProgress(audioRef.current.currentTime);
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error('[Player] Error:', e));
      }
    }
  };

  const handleAudioEnded = () => {
    playNext();
  };

  const handleAudioError = () => {
    const error = audioRef.current?.error;
    console.error('[Player] HTML5 Audio Error:', error);
    if (playbackMode === 'html5' && streamUrl) {
      console.log('[Player] Audio tag failed to load stream, falling back to YouTube iframe');
      setPlaybackMode('iframe');
      toast.error('Stream failed, falling back to YouTube player');
    }
  };

  // Time Update Loop for IFrame
  useEffect(() => {
    let interval: any;
    if (isPlaying && !isSeeking && playbackMode === 'iframe') {
      interval = setInterval(async () => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const currentTime = await playerRef.current.getCurrentTime();
          setLocalProgress(currentTime);
          setProgress(currentTime);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isSeeking, setProgress, playbackMode]);


  // YouTube IFrame Callbacks
  const onReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    playerRef.current.setVolume(volume);
    if(isMuted) playerRef.current.mute();
    if (isPlaying && playbackMode === 'iframe') playerRef.current.playVideo();
  };

  const onStateChange = (event: YouTubeEvent) => {
    if (playbackMode !== 'iframe') return;
    if (event.data === 0) { // ENDED
      setIsTrulyPlaying(false);
      playNext();
    } else if (event.data === 1) { // PLAYING
      setIsPlaying(true);
      setIsTrulyPlaying(true);
      setDuration(event.target.getDuration());
    } else if (event.data === 2) { // PAUSED
      setIsPlaying(false);
      setIsTrulyPlaying(false);
    } else if (event.data === 3) { // BUFFERING
      setIsTrulyPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setLocalProgress(time);
    
    if (playbackMode === 'html5' && audioRef.current) {
      audioRef.current.currentTime = time;
    } else if (playbackMode === 'iframe' && playerRef.current) {
      playerRef.current.seekTo(time, true);
    }
  };

  const toggleGlobalPlayPause = () => {
    // If it was playing, and we pause, we just update state
    togglePlayPause();
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) return null;

  const opts: YouTubeProps['opts'] = {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: playbackMode === 'iframe' && isPlaying ? 1 : 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
    },
  };

  return (
    <>
      {/* HTML5 Audio Player */}
      {playbackMode === 'html5' && streamUrl && (
        <audio
          ref={audioRef}
          src={streamUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onLoadedMetadata={handleAudioLoadedMetadata}
          onEnded={handleAudioEnded}
          onError={handleAudioError}
          onPlaying={() => setIsTrulyPlaying(true)}
          onPause={() => setIsTrulyPlaying(false)}
          onWaiting={() => setIsTrulyPlaying(false)}
          autoPlay={isPlaying}
          preload="auto"
          className="hidden"
        />
      )}

      {/* Hidden YouTube Player (Fallback) */}
      <div className={playbackMode === 'iframe' ? 'absolute top-[-9999px] left-[-9999px] w-0 h-0 opacity-0 pointer-events-none' : 'hidden'}>
        <YouTube
          videoId={currentTrack.youtubeId}
          opts={opts}
          onReady={onReady}
          onStateChange={onStateChange}
        />
      </div>

      {/* Desktop Player & Mobile Mini Player */}
      <div 
        className={cn(
          "fixed z-40 transition-all duration-300 glass-panel overflow-hidden",
          "md:bottom-0 md:left-0 md:right-0 md:rounded-none md:w-full md:border-t md:border-white/5 md:bg-tunewave-ink/90 md:backdrop-blur-2xl md:p-4",
          "bottom-[72px] left-3 right-3 rounded-xl border border-white/10 bg-tunewave-ink/95 shadow-2xl p-2 pb-2.5 md:opacity-100",
          isMobileExpanded ? "opacity-0 pointer-events-none md:pointer-events-auto" : "opacity-100"
        )}
        onClick={() => {
          if (window.innerWidth < 768) setIsMobileExpanded(true);
        }}
      >
        {/* Mobile Mini Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 md:hidden">
          <div 
            className="h-full bg-tunewave-accent transition-all duration-300 ease-out" 
            style={{ width: `${(localProgress / (duration || 100)) * 100}%` }}
          />
        </div>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 md:gap-4 h-12 md:h-auto cursor-pointer md:cursor-default">
          
          {/* Track Info */}
          <div className="flex items-center gap-3 w-1/2 md:w-1/4 md:min-w-[200px]">
            <div className="relative w-10 h-10 md:w-14 md:h-14 flex-shrink-0">
              <img 
                src={currentTrack.thumbnail} 
                alt={currentTrack.title} 
                className={cn(
                  "w-full h-full rounded-full object-cover shadow-lg shadow-black/50 transition-all duration-700",
                  isLoadingStream ? "animate-pulse rounded-md" : "animate-[spin_8s_linear_infinite]",
                  !isTrulyPlaying && !isLoadingStream ? "[animation-play-state:paused]" : ""
                )}
              />
              <div className="absolute inset-0 rounded-full border border-white/10" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-tunewave-ink rounded-full shadow-inner" />
              </div>
            </div>
            <div className="overflow-hidden flex-1">
              <h4 className="text-sm font-semibold truncate text-white block">{currentTrack.title}</h4>
              <p className="text-xs text-white/50 truncate">{currentTrack.artist}</p>
            </div>
          </div>

          {/* Controls - Mobile Right Side */}
          <div className="flex md:hidden items-center justify-end gap-3 flex-1" onClick={e => e.stopPropagation()}>
             <button onClick={() => toggleLikeSong(currentTrack)} className="p-2 transition-colors">
               <Heart className="w-5 h-5" fill={isLiked(currentTrack.id) ? "currentColor" : "none"} color={isLiked(currentTrack.id) ? "var(--color-tunewave-accent)" : "rgba(255,255,255,0.5)"} />
             </button>
             <button 
                onClick={toggleGlobalPlayPause} 
                disabled={isLoadingStream}
                className={cn("p-2 rounded-full flex items-center justify-center transition-all text-white", isLoadingStream ? "opacity-50" : "")}
              >
                {isLoadingStream ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
             </button>
          </div>

          {/* Controls - Desktop Center */}
          <div className="hidden md:flex flex-col items-center flex-1 max-w-2xl gap-2">
            <div className="flex items-center gap-6">
              <button onClick={toggleShuffle} className={cn("transition-colors", isShuffle ? "text-tunewave-accent" : "text-white/50 hover:text-white")}>
                <Shuffle className="w-4 h-4" />
              </button>
              <button onClick={playPrevious} className="text-white hover:text-tunewave-accent transition-colors">
                <SkipBack className="w-6 h-6 fill-current" />
              </button>
              <button 
                onClick={toggleGlobalPlayPause} 
                disabled={isLoadingStream}
                className={cn(
                  "w-10 h-10 rounded-full bg-white text-black flex items-center justify-center transition-all",
                  isLoadingStream ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
                )}
              >
                {isLoadingStream ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-1" />
                )}
              </button>
              <button onClick={playNext} className="text-white hover:text-tunewave-accent transition-colors">
                <SkipForward className="w-6 h-6 fill-current" />
              </button>
              <button onClick={toggleRepeat} className={cn("transition-colors", isRepeat ? "text-tunewave-accent" : "text-white/50 hover:text-white")}>
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center w-full gap-3 text-xs text-white/50 font-mono">
              <span>{formatTime(localProgress)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={localProgress || 0}
                onMouseDown={() => setIsSeeking(true)}
                onMouseUp={() => setIsSeeking(false)}
                onChange={handleSeek}
                className="flex-1 h-1 bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-tunewave-accent [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all hover:[&::-webkit-slider-thumb]:scale-125"
                style={{
                  background: `linear-gradient(to right, var(--color-tunewave-accent) ${(localProgress / (duration || 100)) * 100}%, rgba(255,255,255,0.2) ${(localProgress / (duration || 100)) * 100}%)`
                }}
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Desktop Extra Controls */}
          <div className="hidden md:flex items-center justify-end gap-4 w-1/4 min-w-[200px]">
            <button 
              onClick={() => toggleLikeSong(currentTrack)}
              className={cn("p-2 transition-colors", isLiked(currentTrack.id) ? "text-tunewave-accent" : "text-white/50 hover:text-white")}
            >
              <Heart className="w-5 h-5" fill={isLiked(currentTrack.id) ? "currentColor" : "none"} />
            </button>
            <button 
              onClick={toggleAutoplay} 
              className={cn("transition-colors", isAutoplay ? "text-tunewave-accent" : "text-white/50 hover:text-white")} 
              title={isAutoplay ? "Autoplay On" : "Autoplay Off"}
            >
              <Radio className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsQueueOpen(!isQueueOpen)} 
              className={cn("transition-colors", isQueueOpen ? "text-tunewave-accent" : "text-white/50 hover:text-white")} 
              title="Queue"
            >
              <ListMusic className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 w-32">
              <button onClick={toggleMute} className="text-white/50 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : (volume || 0)}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer hover:[&::-webkit-slider-thumb]:bg-tunewave-accent"
                style={{
                  background: `linear-gradient(to right, white ${(isMuted ? 0 : volume)}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume)}%)`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Full-Screen Player Modal */}
      <div 
        className={cn(
          "md:hidden fixed inset-0 z-50 flex flex-col transition-transform duration-500 ease-out bg-tunewave-bg overflow-y-auto overflow-x-hidden",
          isMobileExpanded ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Dynamic Background Blur */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img src={currentTrack.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-30 blur-[100px] scale-150 saturate-200" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-tunewave-bg/50 to-tunewave-bg"></div>
        </div>

        <div className="relative z-10 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6">
            <button onClick={() => setIsMobileExpanded(false)} className="p-2 text-white/70 hover:text-white bg-white/5 rounded-full backdrop-blur-md">
              <ChevronDown className="w-6 h-6" />
            </button>
            <span className="text-xs font-semibold tracking-widest uppercase text-white/50">Now Playing</span>
            <button onClick={() => setIsQueueOpen(true)} className="p-2 text-white/70 hover:text-white bg-white/5 rounded-full backdrop-blur-md">
              <ListMusic className="w-5 h-5" />
            </button>
          </div>

          {/* Huge Album Art (Spinning Vinyl) */}
          <div className="flex-1 flex items-center justify-center px-8 py-2 min-h-[40vh]">
            <div className="relative w-full aspect-square max-w-[32vh] mx-auto shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-full">
              <img 
                src={currentTrack.thumbnail} 
                alt={currentTrack.title} 
                className={cn(
                  "w-full h-full object-cover rounded-full shadow-inner border-[6px] border-[#0a0a0a]",
                  isLoadingStream ? "animate-pulse" : "animate-[spin_10s_linear_infinite]",
                  !isTrulyPlaying && !isLoadingStream ? "[animation-play-state:paused]" : ""
                )}
              />
              <div className="absolute inset-0 rounded-full border border-white/10" />
              {/* Record Center Hole */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 bg-[#0a0a0a] rounded-full border border-white/5 shadow-inner flex items-center justify-center">
                  <div className="w-3 h-3 bg-tunewave-bg rounded-full border border-black/50" />
                </div>
              </div>
            </div>
          </div>

          {/* Track Info */}
          <div className="px-8 pb-4 flex items-center justify-between">
            <div className="overflow-hidden flex-1 pr-4">
              <h2 className="text-2xl font-display font-bold text-white truncate mb-1">{currentTrack.title}</h2>
              <p className="text-lg text-tunewave-accent-soft opacity-80 truncate">{currentTrack.artist}</p>
            </div>
            <button onClick={() => toggleLikeSong(currentTrack)} className="p-3">
              <Heart className="w-7 h-7 transition-colors" fill={isLiked(currentTrack.id) ? "var(--color-tunewave-accent)" : "none"} color={isLiked(currentTrack.id) ? "var(--color-tunewave-accent)" : "white"} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="px-8 pb-8">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={localProgress || 0}
              onMouseDown={() => setIsSeeking(true)}
              onMouseUp={() => setIsSeeking(false)}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, white ${(localProgress / (duration || 100)) * 100}%, rgba(255,255,255,0.2) ${(localProgress / (duration || 100)) * 100}%)`
              }}
            />
            <div className="flex items-center justify-between text-xs text-white/50 font-mono mt-2 font-medium">
              <span>{formatTime(localProgress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="px-8 pb-12 flex items-center justify-between">
            <button onClick={toggleShuffle} className={cn("p-2 transition-colors", isShuffle ? "text-tunewave-accent" : "text-white/50 hover:text-white")}>
              <Shuffle className="w-6 h-6" />
            </button>
            <button onClick={playPrevious} className="p-2 text-white hover:text-tunewave-accent transition-colors">
              <SkipBack className="w-10 h-10 fill-current" />
            </button>
            <button 
              onClick={toggleGlobalPlayPause} 
              disabled={isLoadingStream}
              className={cn(
                "w-20 h-20 rounded-full bg-white text-black flex items-center justify-center transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]",
                isLoadingStream ? "opacity-50" : "active:scale-95"
              )}
            >
              {isLoadingStream ? (
                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-2" />
              )}
            </button>
            <button onClick={playNext} className="p-2 text-white hover:text-tunewave-accent transition-colors">
              <SkipForward className="w-10 h-10 fill-current" />
            </button>
            <button onClick={toggleRepeat} className={cn("p-2 transition-colors", isRepeat ? "text-tunewave-accent" : "text-white/50 hover:text-white")}>
              <Repeat className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      <QueuePanel isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
    </>
  );
}
