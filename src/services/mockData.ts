import { Track, Playlist } from '../types';

export const mockTracks: Track[] = [
  {
    id: 'mock-bolly-1',
    youtubeId: 'jJXMNAA0D9g',
    title: 'O Maahi (Dunki) | Shah Rukh Khan | Arijit Singh',
    artist: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/jJXMNAA0D9g/hqdefault.jpg',
    duration: '3:53'
  },
  {
    id: 'mock-bolly-2',
    youtubeId: 'qN3OzhAobqw',
    title: 'Pehle Bhi Main | Animal | Ranbir Kapoor, Tripti Dimri',
    artist: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/qN3OzhAobqw/hqdefault.jpg',
    duration: '4:10'
  },
  {
    id: 'mock-bolly-3',
    youtubeId: 'wOQ7qN-AUM4',
    title: 'Chaleya (Jawan) | Shah Rukh Khan | Arijit Singh',
    artist: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/wOQ7qN-AUM4/hqdefault.jpg',
    duration: '3:20'
  },
  {
    id: 'mock-bolly-4',
    youtubeId: 'Kz1f5sS2RTM',
    title: 'Satranga (Animal) | Arijit Singh | Shreyas Puranik',
    artist: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/Kz1f5sS2RTM/hqdefault.jpg',
    duration: '4:31'
  },
  {
    id: 'mock-bolly-5',
    youtubeId: '1zpw81e_g58',
    title: 'Heeriye (Official Video) Jasleen Royal ft Arijit Singh',
    artist: 'Jasleen Royal',
    thumbnail: 'https://i.ytimg.com/vi/1zpw81e_g58/hqdefault.jpg',
    duration: '3:14'
  }
];

export const mockPlaylists: Playlist[] = [
  {
    id: 'pl-mock-1',
    title: 'Bollywood Top Hits 2024',
    description: 'The most played Indian songs right now.',
    tracks: mockTracks.slice(0, 3),
    thumbnail: mockTracks[0].thumbnail,
    createdAt: Date.now()
  },
  {
    id: 'pl-mock-2',
    title: 'Arijit Singh Melodies',
    description: 'Relaxing Bollywood beats to study/work to.',
    tracks: mockTracks.slice(2, 5),
    thumbnail: mockTracks[4].thumbnail,
    createdAt: Date.now() - 1000000
  }
];
