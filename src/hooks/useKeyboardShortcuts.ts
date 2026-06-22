import { useEffect } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

export function useKeyboardShortcuts() {
  const { togglePlayPause, playNext, playPrevious, toggleMute } = usePlayerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
         activeEl.tagName === 'TEXTAREA' ||
         (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
        case 'MediaTrackNext':
          e.preventDefault();
          playNext();
          break;
        case 'ArrowLeft':
        case 'MediaTrackPrevious':
          e.preventDefault();
          playPrevious();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, playNext, playPrevious, toggleMute]);
}
