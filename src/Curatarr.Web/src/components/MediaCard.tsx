import React, { useState } from 'react';
import { Film, Tv, Shield, Trash2, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { MediaItem } from '../types/api';
import { SeasonDrawer } from './SeasonDrawer';
import { getItemBadges } from '../utils/badgeUtils';

interface MediaCardProps {
  item: MediaItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleProtect: () => void;
  onPrune: (seasonNumber?: number) => void;
  onOpenDetail: () => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  isSelected,
  onToggleSelect,
  onToggleProtect,
  onPrune,
  onOpenDetail,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

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
    if (lastPlayed === 0) return totalPlays > 0 ? 'Watched' : 'Never Watched';
    const daysAgo = Math.floor((Date.now() - lastPlayed) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return 'Watched today';
    if (daysAgo === 1) return 'Watched yesterday';
    if (daysAgo < 30) return `${daysAgo}d ago`;
    if (daysAgo < 365) return `${Math.floor(daysAgo / 30)}mo ago`;
    return `${Math.floor(daysAgo / 365)}y ago`;
  };

  const badges = getItemBadges(item);
  const hasCutoffUnmet = item.instances.some((i) => i.cutoffUnmet);

  return (
    <div
      className={`group bg-slate-900/60 border rounded-xl overflow-hidden transition flex flex-col justify-between ${
        isSelected ? 'border-sky-500 ring-1 ring-sky-500/50 shadow-md' : 'border-slate-800 hover:border-slate-700'
      } ${item.isProtected ? 'ring-1 ring-emerald-500/40' : ''}`}
    >
      <div>
        {/* Poster Header */}
        <div
          onClick={onOpenDetail}
          className="relative aspect-[2/3] w-full bg-slate-950 overflow-hidden cursor-pointer border-b border-slate-800/80"
        >
          {item.posterUrl && !imgError ? (
            <img
              src={item.posterUrl}
              alt={item.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-700 p-3">
              {isSeries ? <Tv className="w-8 h-8 mb-1.5 text-slate-700" /> : <Film className="w-8 h-8 mb-1.5 text-slate-700" />}
              <span className="text-[10px] text-slate-600 text-center line-clamp-2 px-1">{item.title}</span>
            </div>
          )}

          {/* Top Overlay: Checkbox & Badges (Left), Protect & Prune (Right) */}
          <div className="absolute inset-x-0 top-0 p-2 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-transparent flex items-start justify-between gap-1.5 z-10 pointer-events-none">
            <div className="flex items-center gap-1 flex-wrap pointer-events-auto">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                onClick={(e) => e.stopPropagation()}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950/90 text-sky-600 focus:ring-sky-500 cursor-pointer shadow"
              />
              {badges.map((b) => (
                <span
                  key={b.id}
                  className={`text-[9px] font-bold px-1 py-0.5 rounded shadow-sm backdrop-blur-sm ${b.style}`}
                >
                  {b.label}
                </span>
              ))}
              {hasCutoffUnmet && (
                <span
                  className="text-[9px] font-bold px-1 py-0.5 rounded bg-rose-500/80 text-white shadow-sm"
                  title="Quality cutoff unmet in Arr"
                >
                  Cutoff
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleProtect();
                }}
                title={item.isProtected ? `Protected: ${item.protectionReason || 'Whitelist'}` : 'Protect from deletion'}
                className={`p-1 rounded backdrop-blur-sm shadow transition ${
                  item.isProtected
                    ? 'bg-emerald-500/90 text-white hover:bg-emerald-600'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Shield className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPrune();
                }}
                disabled={item.isProtected}
                title={item.isProtected ? 'Item is protected' : 'Prune item'}
                className="p-1 rounded backdrop-blur-sm shadow bg-slate-900/80 text-slate-400 hover:text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Bottom Gradient Overlay on Poster */}
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none" />
        </div>

        {/* Card Body Info */}
        <div className="p-2.5 space-y-1.5">
          <div onClick={onOpenDetail} className="cursor-pointer group/title">
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-0.5">
              {isSeries ? <Tv className="w-3 h-3 text-sky-400" /> : <Film className="w-3 h-3 text-amber-400" />}
              <span>{isSeries ? 'Series' : 'Movie'}</span>
              {item.year && <span>• {item.year}</span>}
            </div>
            <h3 className="text-xs font-semibold text-white tracking-tight line-clamp-1 group-hover/title:text-sky-300 transition" title={item.title}>
              {item.title}
            </h3>
          </div>

          {/* Storage & Plays */}
          <div
            onClick={onOpenDetail}
            className="bg-slate-950/60 border border-slate-800/60 hover:border-slate-700/80 rounded-md p-1.5 flex items-center justify-between text-[11px] cursor-pointer transition"
          >
            <div>
              <div className="text-[9px] text-slate-500">Storage</div>
              <div className="font-mono text-[11px] font-medium text-slate-200">{formatSize(item.totalSizeBytes)}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-slate-500 flex items-center justify-end gap-0.5">
                <Eye className="w-2 h-2" />
                {totalPlays} {totalPlays === 1 ? 'play' : 'plays'}
              </div>
              <div className={`text-[11px] font-medium ${lastPlayed === 0 ? 'text-amber-400/90' : 'text-slate-300'}`}>
                {formatLastPlayed()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expand TV Seasons Toggle */}
      {isSeries && item.seasons.length > 0 && (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-2.5 py-1 bg-slate-950/40 hover:bg-slate-900 border-t border-slate-800/60 text-slate-400 hover:text-slate-200 text-[10px] flex items-center justify-between transition"
          >
            <span>{item.seasons.length} Seasons</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {isExpanded && <SeasonDrawer seasons={item.seasons} onPruneSeason={onPrune} />}
        </div>
      )}
    </div>
  );
};
