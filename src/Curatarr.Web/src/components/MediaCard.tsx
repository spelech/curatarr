import React, { useState } from 'react';
import { Film, Tv, Shield, Trash2, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { MediaItem } from '../types/api';
import { SeasonDrawer } from './SeasonDrawer';

interface MediaCardProps {
  item: MediaItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleProtect: () => void;
  onPrune: (seasonNumber?: number) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  isSelected,
  onToggleSelect,
  onToggleProtect,
  onPrune,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
  };

  const isSeries = item.mediaType === 1;
  const totalPlays = item.watchStats.reduce((sum, w) => sum + w.playCount, 0);
  const lastPlayed = item.watchStats
    .map((w) => (w.lastPlayedAt ? new Date(w.lastPlayedAt).getTime() : 0))
    .reduce((max, t) => Math.max(max, t), 0);

  const formatLastPlayed = () => {
    if (lastPlayed === 0) return 'Never Watched';
    const daysAgo = Math.floor((Date.now() - lastPlayed) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return 'Watched today';
    if (daysAgo === 1) return 'Watched yesterday';
    if (daysAgo < 30) return `${daysAgo}d ago`;
    if (daysAgo < 365) return `${Math.floor(daysAgo / 30)}mo ago`;
    return `${Math.floor(daysAgo / 365)}y ago`;
  };

  // Distinct tier tags across instances
  const tierTags = Array.from(new Set(item.instances.map((i) => i.qualityProfileName || 'Default')));

  return (
    <div
      className={`group bg-slate-900/60 border rounded-xl overflow-hidden transition flex flex-col justify-between ${
        isSelected ? 'border-sky-500 ring-1 ring-sky-500/50 shadow-md' : 'border-slate-800 hover:border-slate-700'
      } ${item.isProtected ? 'ring-1 ring-emerald-500/40' : ''}`}
    >
      <div className="p-3.5 space-y-3">
        {/* Top Header: Checkbox, Badges, Protect & Delete Action */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-600 focus:ring-sky-500 cursor-pointer"
            />
            {/* Instance tier tags (HD / 4K) */}
            <div className="flex items-center gap-1">
              {tierTags.map((tag) => (
                <span
                  key={tag}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    tag.toLowerCase().includes('4k')
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Whitelist Protection Button */}
            <button
              onClick={onToggleProtect}
              title={item.isProtected ? `Protected: ${item.protectionReason || 'Whitelist'}` : 'Protect from deletion'}
              className={`p-1.5 rounded transition ${
                item.isProtected
                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
            </button>

            {/* Quick Prune Button */}
            <button
              onClick={() => onPrune()}
              disabled={item.isProtected}
              title={item.isProtected ? 'Item is protected' : 'Prune item'}
              className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Media Info: Icon, Title, Year */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
            {isSeries ? <Tv className="w-3.5 h-3.5 text-sky-400" /> : <Film className="w-3.5 h-3.5 text-amber-400" />}
            <span>{isSeries ? 'Series' : 'Movie'}</span>
            {item.year && <span>• {item.year}</span>}
          </div>
          <h3 className="text-sm font-semibold text-white tracking-tight line-clamp-1" title={item.title}>
            {item.title}
          </h3>
        </div>

        {/* Stats Row: Size on disk, Watch Info */}
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-2.5 flex items-center justify-between text-xs">
          <div>
            <div className="text-[10px] text-slate-500">Storage</div>
            <div className="font-mono font-medium text-slate-200">{formatSize(item.totalSizeBytes)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
              <Eye className="w-2.5 h-2.5" />
              {totalPlays} {totalPlays === 1 ? 'play' : 'plays'}
            </div>
            <div className={`font-medium ${lastPlayed === 0 ? 'text-amber-400/90' : 'text-slate-300'}`}>
              {formatLastPlayed()}
            </div>
          </div>
        </div>
      </div>

      {/* Expand TV Seasons Toggle */}
      {isSeries && item.seasons.length > 0 && (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-3.5 py-1.5 bg-slate-950/40 hover:bg-slate-900 border-t border-slate-800/60 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-between transition"
          >
            <span>{item.seasons.length} Seasons</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {isExpanded && <SeasonDrawer seasons={item.seasons} onPruneSeason={onPrune} />}
        </div>
      )}
    </div>
  );
};
