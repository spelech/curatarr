import { useState } from 'react';
import { Film, RefreshCw, Layers } from 'lucide-react';

export default function App() {
  const [activeCategory, setActiveCategory] = useState('never_watched');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Curatarr
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Preview
              </span>
            </h1>
            <p className="text-xs text-slate-400">Intelligent Media Curation & Library Pruning</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Now
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { id: 'never_watched', label: 'Never Watched', count: 0 },
              { id: 'stale', label: 'Stale (>180d)', count: 0 },
              { id: 'abandoned', label: 'Abandoned TV', count: 0 },
              { id: 'cutoff_unmet', label: 'Cutoff Unmet', count: 0 },
              { id: 'space_hogs', label: 'Space Hogs', count: 0 },
              { id: 'protected', label: 'Protected', count: 0 },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat.label}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/30">
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Empty State / Initial Ready state */}
        <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center">
          <Film className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">Ready to Curate</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Connect your Sonarr, Radarr, Tautulli, and Plex instances in Settings or sync your library to begin reviewing candidate titles.
          </p>
        </div>
      </main>
    </div>
  );
}
