import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { MobileNav } from '../components/MobileNav';
import { Player } from '../components/Player';
import { usePlayerStore } from '../store/usePlayerStore';

export function RootLayout() {
  const { currentTrack } = usePlayerStore();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative z-10 pb-24 md:pb-28">
        <div className="px-4 py-8 md:px-8 max-w-[1600px] mx-auto min-h-full">
          <Outlet />
        </div>
      </main>
      <MobileNav />
      {currentTrack && <Player />}
    </div>
  );
}
