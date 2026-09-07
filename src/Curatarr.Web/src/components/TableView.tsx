import React from 'react';
import { Film, Tv, Shield, Trash2 } from 'lucide-react';
import { MediaItem } from '../types/api';

interface TableViewProps {
  items: MediaItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleProtect: (id: string, isProtected: boolean) => void;
  onPrune: (item: MediaItem) => void;
}

export const TableView: React.FC<TableViewProps> = ({
  items,
  selectedIds,
  onToggleSelect,
  onToggleProtect,
  onPrune,
}) => {
  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
  };

  const getLastPlayed = (item: MediaItem) => {
    const lastPlayed = item.watchStats
      .map((w) => (w.lastPlayedAt ? new Date(w.lastPlayedAt).getTime() : 0))
      .reduce((max, t) => Math.max(max, t), 0);

    if (lastPlayed === 0) {
      const totalPlays = item.watchStats.reduce((sum, w) => sum + w.playCount, 0);
      return totalPlays > 0 ? 'Watched' : 'Never';
    }
    const daysAgo = Math.floor((Date.now() - lastPlayed) / (1000 * 60 * 60 * 24));
    if (daysAgo < 30) return `${daysAgo}d ago`;
    if (daysAgo < 365) return `${Math.floor(daysAgo / 30)}mo ago`;
    return `${Math.floor(daysAgo / 365)}y ago`;
  };

  return (
    <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-900/40">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium">
            <th className="p-3 w-8"></th>
            <th className="p-3">Title</th>
            <th className="p-3">Type</th>
            <th className="p-3">Tier / Instances</th>
            <th className="p-3">Size</th>
            <th className="p-3">Plays</th>
            <th className="p-3">Last Watched</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const totalPlays = item.watchStats.reduce((sum, w) => sum + w.playCount, 0);

            return (
              <tr
                key={item.id}
                className={`hover:bg-slate-800/40 transition ${
                  isSelected ? 'bg-sky-950/20' : ''
                } ${item.isProtected ? 'bg-emerald-950/10' : ''}`}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(item.id)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-600 cursor-pointer"
                  />
                </td>
                <td className="p-3 font-semibold text-white">
                  <div className="flex items-center gap-2">
                    <span>{item.title}</span>
                    {item.year && <span className="text-slate-500 font-normal">({item.year})</span>}
                  </div>
                </td>
                <td className="p-3 text-slate-400">
                  <div className="flex items-center gap-1">
                    {item.mediaType === 1 ? <Tv className="w-3 h-3 text-sky-400" /> : <Film className="w-3 h-3 text-amber-400" />}
                    <span>{item.mediaType === 1 ? 'Series' : 'Movie'}</span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    {item.instances.map((i) => (
                      <span
                        key={i.id}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        {i.qualityProfileName || 'Default'}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3 font-mono text-slate-200">{formatSize(item.totalSizeBytes)}</td>
                <td className="p-3 text-slate-300 font-mono">{totalPlays}</td>
                <td className="p-3 text-slate-400">{getLastPlayed(item)}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onToggleProtect(item.id, !item.isProtected)}
                      className={`p-1.5 rounded transition ${
                        item.isProtected ? 'text-emerald-300 bg-emerald-500/20' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title={item.isProtected ? 'Protected' : 'Protect'}
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onPrune(item)}
                      disabled={item.isProtected}
                      className="p-1.5 rounded text-slate-500 hover:text-red-400 disabled:opacity-25 transition"
                      title="Prune"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
