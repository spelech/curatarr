import React, { useState, useRef, useEffect } from 'react';
import { Film, Tv, Shield, Trash2, ChevronDown, ChevronUp, Eye, History, ArrowUpCircle } from 'lucide-react';
import { MediaItem } from '../types/api';
import { SeasonDrawer } from './SeasonDrawer';
import { getItemBadges, itemPredatesWatchHistory, getBadgeStyle } from '../utils/badgeUtils';
import { useAuthStore } from '../stores/useAuthStore';
import { useConnectionStore } from '../stores/useConnectionStore';

interface MediaCardProps {
  item: MediaItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleProtect: (id: string, isProtected: boolean) => void;
  onPrune: (item: MediaItem, seasonNumber?: number, targetConnectionIds?: string[]) => void;
  onOpenDetail: (item: MediaItem) => void;
  onUpgradeQuality?: (item: MediaItem) => void;
}

const MediaCardComponent: React.FC<MediaCardProps> = ({
  item,
  isSelected,
  onToggleSelect,
  onToggleProtect,
  onPrune,
  onOpenDetail,
  onUpgradeQuality,
}) => {
  const user = useAuthStore((s) => s.user);
  const isPreviewingAsGuest = useAuthStore((s) => s.isPreviewingAsGuest);
  const isGuest = user?.role === 'Guest' || isPreviewingAsGuest;
  const [isExpanded, setIsExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const connections = useConnectionStore((s) => s.connections);
  const [showPruneMenu, setShowPruneMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPruneMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPruneMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPruneMenu]);

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
  const predatesTracking = itemPredatesWatchHistory(item);

  return (
    <div
      className={`group bg-slate-900/60 border rounded-xl overflow-hidden transition flex flex-col justify-between ${
        isSelected ? 'border-sky-500 ring-1 ring-sky-500/50 shadow-md' : 'border-slate-800 hover:border-slate-700'
      } ${item.isProtected ? 'ring-1 ring-emerald-500/40' : ''}`}
    >
      <div>
        {/* Poster Header */}
        <div
          onClick={() => onOpenDetail(item)}
          className="relative aspect-[2/3] w-full bg-slate-950 overflow-hidden cursor-pointer border-b border-slate-800/80"
        >
          {item.posterUrl && !imgError ? (
            <img
              src={item.posterUrl}
              alt={item.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              loading="lazy"
              decoding="async"
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
              {!isGuest && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950/90 text-sky-600 focus:ring-sky-500 cursor-pointer shadow"
                />
              )}
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
              {predatesTracking && (
                <span
                  data-testid="predates-tracking-badge"
                  className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm flex items-center gap-0.5"
                  title="Added before watch history tracking began (July 2017). May have been watched previously."
                >
                  <History className="w-2.5 h-2.5" />
                  Pre-2017
                </span>
              )}
              {(item.protectionRequestCount ?? 0) > 0 && (
                <span
                  data-testid="protection-request-count-badge"
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm flex items-center gap-0.5"
                  title={`${item.protectionRequestCount} user${(item.protectionRequestCount ?? 0) > 1 ? 's' : ''} asked to protect this item`}
                >
                  <Shield className="w-2.5 h-2.5 text-violet-400" />
                  <span>{item.protectionRequestCount}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isGuest) {
                    onOpenDetail(item);
                  } else {
                    onToggleProtect(item.id, !item.isProtected);
                  }
                }}
                title={
                  item.isProtected
                    ? `Protected: ${item.protectionReason || 'Whitelist'}`
                    : isGuest
                    ? 'View protection requests / Ask to protect'
                    : 'Protect from deletion'
                }
                className={`p-1 rounded backdrop-blur-sm shadow transition ${
                  item.isProtected
                    ? 'bg-emerald-500/90 text-white hover:bg-emerald-600'
                    : (item.protectionRequestCount ?? 0) > 0
                    ? 'bg-violet-600/80 text-white hover:bg-violet-500'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Shield className="w-3 h-3" />
              </button>
              {!isGuest && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpgradeQuality?.(item);
                  }}
                  title="Upgrade quality profile & search"
                  aria-label="Upgrade quality"
                  className="p-1 rounded backdrop-blur-sm shadow bg-slate-900/80 text-slate-400 hover:text-sky-400 hover:bg-sky-500/20 transition flex items-center"
                >
                  <ArrowUpCircle className="w-3 h-3" />
                </button>
              )}
              {!isGuest && (
                <div className="relative pointer-events-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.instances && item.instances.length > 1) {
                        setShowPruneMenu((prev) => !prev);
                      } else {
                        onPrune(item);
                      }
                    }}
                    disabled={item.isProtected}
                    title={
                      item.isProtected
                        ? 'Item is protected'
                        : item.instances && item.instances.length > 1
                        ? 'Choose copy to prune (4K / HD)'
                        : 'Prune item'
                    }
                    className="p-1 rounded backdrop-blur-sm shadow bg-slate-900/80 text-slate-400 hover:text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  {/* Multi-instance quick prune dropdown */}
                  {showPruneMenu && (
                    <div
                      ref={menuRef}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30 text-left space-y-1 animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Select Copy to Prune
                      </div>
                      <button
                        onClick={() => {
                          setShowPruneMenu(false);
                          onPrune(item);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg text-xs hover:bg-red-500/20 text-red-300 flex items-center justify-between transition"
                      >
                        <span>Prune All Copies</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {formatSize(item.totalSizeBytes)}
                        </span>
                      </button>
                      <div className="h-px bg-slate-800 my-0.5" />
                      {item.instances.map((inst) => {
                        const conn = connections.find((c) => c.id === inst.connectionId);
                        const name = conn?.name || inst.qualityProfileName || inst.resolution || 'Arr';
                        return (
                          <button
                            key={inst.id}
                            onClick={() => {
                              setShowPruneMenu(false);
                              onPrune(item, undefined, [inst.connectionId]);
                            }}
                            className="w-full px-2 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-200 flex items-center justify-between transition"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate">{name}</span>
                              {inst.resolution && (
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${getBadgeStyle(inst.resolution, false)}`}>
                                  {inst.resolution}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0 ml-1.5">
                              {formatSize(inst.sizeBytes)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Gradient Overlay on Poster */}
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none" />
        </div>

        {/* Card Body Info */}
        <div className="p-2.5 space-y-1.5">
          <div onClick={() => onOpenDetail(item)} className="cursor-pointer group/title">
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
            onClick={() => onOpenDetail(item)}
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
          {isExpanded && <SeasonDrawer seasons={item.seasons} onPruneSeason={(seasonNum) => onPrune(item, seasonNum)} />}
        </div>
      )}
    </div>
  );
};

export const MediaCard = React.memo<MediaCardProps>(
  MediaCardComponent,
  (prev, next) => prev.item === next.item && prev.isSelected === next.isSelected
);
