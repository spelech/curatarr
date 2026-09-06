import React from 'react';
import { Trash2 } from 'lucide-react';
import { Season } from '../types/api';

interface SeasonDrawerProps {
  seasons: Season[];
  onPruneSeason: (seasonNumber: number) => void;
}

export const SeasonDrawer: React.FC<SeasonDrawerProps> = ({ seasons, onPruneSeason }) => {
  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  if (seasons.length === 0) {
    return <div className="p-3 text-xs text-slate-500 text-center">No seasons found.</div>;
  }

  return (
    <div className="bg-slate-950/80 border-t border-slate-800/80 p-3 space-y-2 rounded-b-xl">
      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
        Seasons on Disk ({seasons.length})
      </div>
      <div className="space-y-1.5">
        {seasons.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between bg-slate-900/60 border border-slate-800 px-2.5 py-1.5 rounded-md text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">
                {s.seasonNumber === 0 ? 'Specials' : `Season ${s.seasonNumber}`}
              </span>
              <span className="text-[11px] text-slate-500">
                {s.episodeFileCount} / {s.episodeCount} eps
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-slate-400">{formatSize(s.sizeBytes)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPruneSeason(s.seasonNumber);
                }}
                className="p-1 rounded text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
                title={`Prune Season ${s.seasonNumber}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
