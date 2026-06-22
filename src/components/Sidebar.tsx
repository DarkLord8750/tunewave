import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Library, Plus } from 'lucide-react';
import { cn } from '../utils/cn';
import { usePlaylistStore } from '../store/usePlaylistStore';

export function Sidebar() {
  const { pathname } = useLocation();
  const { playlists, createPlaylist } = usePlaylistStore();

  const links = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Your Library', href: '/library', icon: Library },
  ];

  return (
    <aside className="w-64 bg-tunewave-ink/50 backdrop-blur-xl border-r border-white/5 flex-col hidden md:flex h-full">
      <div className="p-6">
        <h1 className="text-2xl font-display font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-tunewave-accent to-blue-400">
          <img src="https://i.ibb.co/N613dpGb/tune.png" alt="TuneWave" />
        </h1>
      </div>

      <nav className="px-4 space-y-2 flex-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 font-medium",
                isActive
                  ? "bg-tunewave-accent/10 text-tunewave-accent"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="w-5 h-5" />
              {link.name}
            </Link>
          );
        })}

        <div className="pt-8 pb-4">
          <div className="text-xs uppercase tracking-wider font-semibold text-white/40 mb-4 px-4 flex items-center justify-between">
            <span>Playlists</span>
            <button
              onClick={() => {
                const title = prompt('Enter playlist name:');
                if (title) createPlaylist(title);
              }}
              className="hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[300px] hide-scrollbar">
            {playlists.map(pl => (
              <Link
                key={pl.id}
                to={`/playlist/${pl.id}`}
                className={cn(
                  "block px-4 py-2 rounded-lg truncate text-sm transition-colors",
                  pathname === `/playlist/${pl.id}`
                    ? "text-tunewave-accent"
                    : "text-white/60 hover:text-white"
                )}
              >
                {pl.title}
              </Link>
            ))}
            <Link
              to="/liked"
              className={cn(
                "block px-4 py-2 rounded-lg truncate text-sm transition-colors mt-2",
                pathname === '/liked'
                  ? "text-tunewave-accent bg-tunewave-accent/10"
                  : "text-white/60 hover:text-white"
              )}
            >
              Liked Songs
            </Link>
          </div>
        </div>
      </nav>
    </aside>
  );
}
