import { useState, useEffect } from 'react';
import { SearchIcon } from 'lucide-react';
import { musicService } from '../services/musicService';
import { Track } from '../types';
import { TrackCard } from '../components/TrackCard';
import { TrackListItem } from '../components/TrackListItem';

export function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const handler = setTimeout(async () => {
      if (query.trim().length > 2) {
        setLoading(true);
        try {
          const res = await musicService.search(query, controller.signal);
          setResults(res);
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            setResults([]);
          }
        } finally {
          // If aborted, let the new request handle loading state
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      } else {
        setResults([]);
        setLoading(false);
      }
    }, 400); // 400ms debounce

    return () => {
      clearTimeout(handler);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="space-y-4 md:space-y-8 min-h-full pb-[100px]">
      <div className="sticky top-0 z-40 pt-2 pb-6 md:pt-6 md:pb-8 -mx-4 px-4 md:-mx-8 md:px-8 pointer-events-none">
        {/* Full-width fading glass background */}
        <div className="absolute inset-0 bg-transparent backdrop-blur-2xl [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] pointer-events-none -top-8" />
        
        <div className="relative group max-w-3xl mx-auto pointer-events-auto">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-white/50 group-focus-within:text-tunewave-accent transition-colors">
            <SearchIcon className="w-6 h-6" />
          </div>
          <input
            type="text"
            value={query || ''}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to listen to?"
            className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:ring-2 focus:ring-tunewave-accent/50 outline-none rounded-full py-4 pl-16 pr-6 text-xl transition-all shadow-xl placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="pt-4 md:pt-8">
        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6 mt-4">
             {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-white/5 rounded-xl p-4 flex md:flex-col items-center md:items-start gap-4 md:gap-3">
                  <div className="bg-white/10 rounded-lg w-16 h-16 md:w-full md:h-auto md:aspect-square flex-shrink-0"></div>
                  <div className="flex-1 w-full">
                    <div className="bg-white/10 rounded w-3/4 h-4 md:mt-2"></div>
                    <div className="bg-white/10 rounded w-1/2 h-3 mt-2"></div>
                  </div>
                </div>
              ))}
           </div>
        ) : query && results.length === 0 ? (
          <div className="text-center py-20 text-white/50">
            <p className="text-xl">No results found for "{query}"</p>
            <p className="text-sm mt-2">Try searching for artists, songs, or podcasts</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 md:grid md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 md:gap-6 animate-in slide-in-from-bottom-8 duration-500">
            {results.map(track => (
              <div key={`search-${track.id}`}>
                <div className="md:hidden">
                  <TrackListItem track={track} />
                </div>
                <div className="hidden md:block h-full">
                  <TrackCard track={track} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
