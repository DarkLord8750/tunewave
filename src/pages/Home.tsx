import { useEffect, useState } from 'react';
import { musicService } from '../services/musicService';
import { TrackCard } from '../components/TrackCard';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types';
import { motion } from 'framer-motion';

type HomeSection = {
  id: string;
  title: string;
  tracks: Track[];
};

export function Home() {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { recentlyPlayed } = usePlayerStore();
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    // Dynamic greeting based on local time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      const newSections: HomeSection[] = [];
      
      // 1. Time-of-Day Contextual Mix (Studio level feature)
      const hour = new Date().getHours();
      let contextQuery = "Top Global Tracks Chart Official";
      let contextTitle = "Global Trending Hits";
      
      if (hour >= 5 && hour < 12) {
        contextQuery = "Morning Coffee Acoustic Mix";
        contextTitle = "Morning Acoustic Mix";
      } else if (hour >= 12 && hour < 17) {
        contextQuery = "High Energy Pop Hits";
        contextTitle = "Afternoon Energy Mix";
      } else if (hour >= 17 && hour < 22) {
        contextQuery = "Evening Chill R&B Mix";
        contextTitle = "Evening Chill Mix";
      } else {
        contextQuery = "Late Night Lofi Beats";
        contextTitle = "Late Night Lofi";
      }

      try {
        const timeMix = await musicService.search(contextQuery);
        if (timeMix.length > 0) {
          newSections.push({
            id: 'time-mix',
            title: `Made For You: ${contextTitle}`,
            tracks: timeMix.slice(0, 6)
          });
        }
      } catch (e) {
        console.error("Context mix failed:", e);
      }

      // 2. Spotify-Style Algorithm: Personalized Recommendations
      if (recentlyPlayed.length > 0) {
        // Find unique songs to use as seeds (max 2 to avoid huge load times)
        const uniqueSeeds = Array.from(new Set(recentlyPlayed.map(t => t.id)))
          .map(id => recentlyPlayed.find(t => t.id === id)!)
          .slice(0, 2);

        // Fetch related tracks for each seed
        const relatedPromises = uniqueSeeds.map(async (seed) => {
          try {
            const related = await musicService.getRelatedTracks(seed, recentlyPlayed);
            // Filter out tracks already in recently played
            const filtered = related.filter(t => !recentlyPlayed.some(rp => rp.id === t.id));
            if (filtered.length > 0) {
              return {
                id: `seed-${seed.id}`,
                title: `More like ${seed.title}`,
                tracks: filtered.slice(0, 10)
              };
            }
          } catch (e) {
            console.error("Failed to fetch related for seed:", seed.title, e);
          }
          return null;
        });

        const results = await Promise.all(relatedPromises);
        results.forEach(res => {
          if (res) newSections.push(res);
        });
      }

      // 2. Random Discovery (Always show at the bottom)
      try {
        const discoveryQueries = [
          "Bollywood Love Songs",
          "Bollywood Party Anthems",
          "Top Hindi Romantic Hits",
          "Desi Hip Hop Hits",
          "Chill Lofi Bollywood",
          "Punjabi Party Mix",
          "Arijit Singh Best of"
        ];
        // Pick a random query on every refresh
        const randomQuery = discoveryQueries[Math.floor(Math.random() * discoveryQueries.length)];
        
        const tr = await musicService.search(randomQuery);
        newSections.push({
          id: 'discovery',
          title: randomQuery,
          tracks: tr.slice(0, 12)
        });
      } catch (e) {
        console.error("Failed to fetch discovery:", e);
      }

      if (isMounted) {
        setSections(newSections);
        setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
    // Re-run when recentlyPlayed changes so homepage updates dynamically!
  }, [recentlyPlayed]); 

  // Loading skeleton UI component
  const SkeletonRow = () => (
    <div className="flex overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar gap-4 md:grid md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 md:gap-6 md:pb-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex-none w-[150px] snap-start md:w-auto glass-panel rounded-2xl p-4 aspect-square flex flex-col gap-3">
          <div className="bg-white/5 animate-[pulse_2s_ease-in-out_infinite] rounded-xl w-full aspect-square shadow-inner"></div>
          <div className="bg-white/5 animate-[pulse_2s_ease-in-out_infinite] rounded w-3/4 h-5 mt-2"></div>
          <div className="bg-white/5 animate-[pulse_2s_ease-in-out_infinite] rounded w-1/2 h-4"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">

      {/* Dynamic Hero / Greeting */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-8 md:p-16">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-tunewave-accent/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel mb-6 border border-tunewave-accent/30">
            <span className="w-2 h-2 rounded-full bg-tunewave-accent animate-pulse"></span>
            <span className="text-xs font-medium tracking-widest uppercase text-tunewave-accent-soft">Premium Experience</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6">
            {greeting}, <span className="text-gradient">TuneWave</span>
          </h1>
          <p className="text-xl text-white/70 font-light leading-relaxed">
            Your personalized, ad-free music sanctuary. Discover new tracks tailored specifically to your taste.
          </p>
          <div className="flex items-center gap-4 mt-8 w-fit px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-white/10 transition-colors cursor-default">
            <img
              src="https://i.ibb.co/DfSmyk6v/profile.jpg"
              alt="Uvesh Malik"
              className="w-14 h-14 rounded-full object-cover object-center border border-white/20 shadow-lg ring-2 ring-white/10 overflow-hidden shrink-0"
              style={{ imageRendering: "auto" }}
            />
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/40">
                Crafted By
              </p>
              <h3 className="text-white font-semibold text-lg">
                Uvesh Malik
              </h3>
            </div>
          </div>
        </div>
      </section>

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <section className="relative">
          <h2 className="text-3xl font-bold font-display mb-8 tracking-tight flex items-center gap-3">
            <span className="w-8 h-1 bg-gradient-to-r from-tunewave-accent to-transparent rounded-full"></span>
            Recent Waves
          </h2>
          <div className="flex overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar gap-4 md:grid md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 md:gap-6 md:pb-0">
            {recentlyPlayed.slice(0, 6).map(track => (
              <TrackCard key={`recent-${track.id}`} track={track} className="flex-none w-[150px] snap-start md:w-auto" />
            ))}
          </div>
        </section>
      )}

      {/* Dynamic Recommendation Sections */}
      {loading ? (
        <section className="space-y-12">
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold font-display tracking-tight flex items-center gap-3">
                <span className="w-8 h-1 bg-gradient-to-r from-tunewave-accent to-transparent rounded-full"></span>
                Curating your feed...
              </h2>
            </div>
            <SkeletonRow />
          </div>
          <div>
            <SkeletonRow />
          </div>
        </section>
      ) : (
        <div className="space-y-12">
          {sections.map(section => (
            <motion.section 
              key={section.id} 
              className="relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold font-display tracking-tight flex items-center gap-3">
                  <span className="w-8 h-1 bg-gradient-to-r from-tunewave-accent to-transparent rounded-full"></span>
                  {section.title}
                </h2>
              </div>
              <motion.div 
                className="flex overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar gap-4 md:grid md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 md:gap-6 md:pb-0"
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
                }}
                initial="hidden"
                animate="show"
              >
                {section.tracks.map(track => (
                  <TrackCard key={`${section.id}-${track.id}`} track={track} contextQueue={section.tracks} className="flex-none w-[150px] snap-start md:w-auto" />
                ))}
              </motion.div>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
}
