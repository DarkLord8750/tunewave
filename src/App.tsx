/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Routes, Route } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Library } from './pages/Library';
import { PlaylistDetails } from './pages/PlaylistDetails';
import { LikedSongs } from './pages/LikedSongs';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <>
      <div className="atmosphere" />
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="library" element={<Library />} />
          <Route path="playlist/:id" element={<PlaylistDetails />} />
          <Route path="liked" element={<LikedSongs />} />
        </Route>
      </Routes>
      <Toaster theme="dark" position="bottom-right" />
    </>
  );
}
