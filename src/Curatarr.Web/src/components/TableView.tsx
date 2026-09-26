import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Film, Tv, Shield, Trash2, History, ArrowUpCircle } from 'lucide-react';
import { MediaItem } from '../types/api';
import { getInstanceBadge, itemPredatesWatchHistory, getBadgeStyle } from '../utils/badgeUtils';
import { useAuthStore } from '../stores/useAuthStore';
import { useConnectionStore } from '../stores/useConnectionStore';

interface TableViewProps {
  items: MediaItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleProtect: (id: string, isProtected: boolean) => void;
  onPrune: (item: MediaItem, seasonNumber?: number, targetConnectionIds?: string[]) => void;
  onOpenDetail: (item: MediaItem) => void;
  onUpgradeQuality?: (item: MediaItem) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

interface TableRowProps {
  item: MediaItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleProtect: (id: string, isProtected: boolean) => void;
  onPrune: (item: MediaItem, seasonNumber?: number, targetConnectionIds?: string[]) => void;
  onOpenDetail: (item: MediaItem) => void;
  onUpgradeQuality?: (item: MediaItem) => void;
  formatSize: (bytes: number) => string;
  getLastPlayed: (item: MediaItem) => string;
  formatDate: (dateStr?: string) => string;
}

const TableRow = React.memo<TableRowProps>(
  ({
    item,
    isSelected,
    onToggleSelect,
    onToggleProtect,
    onPrune,
    onOpenDetail,
    onUpgradeQuality,
    formatSize,
    getLastPlayed,
    formatDate,
  }) => {
    const user = useAuthStore((s) => s.user);
    const isPreviewingAsGuest = useAuthStore((s) => s.isPreviewingAsGuest);
    const isGuest = user?.role === 'Guest' || isPreviewingAsGuest;
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

    const totalPlays = item.watchStats.reduce((sum, w) => sum + w.playCount, 0);

    return (
      <tr
        className={`h-16 hover:bg-slate-800/40 transition ${
          isSelected ? 'bg-sky-950/20' : ''
        } ${item.isProtected ? 'bg-emerald-950/10' : ''}`}
      >
        <td className="p-3 overflow-hidden text-center">
          {!isGuest && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(item.id)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-600 cursor-pointer"
            />
          )}
        </td>
        <td className="p-3 font-semibold text-white overflow-hidden">
          <div
            onClick={() => onOpenDetail(item)}
            className="flex items-center gap-2.5 cursor-pointer hover:text-sky-300 transition min-w-0"
          >
            {item.posterUrl ? (
              <img
                src={item.posterUrl}
                alt={item.title}
                className="w-7 h-10 object-cover rounded shadow-sm border border-slate-800 shrink-0"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-7 h-10 bg-slate-800 rounded flex items-center justify-center shrink-0 text-slate-500 border border-slate-800">
                {item.mediaType === 1 ? <Tv className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate block" title={item.title}>{item.title}</span>
                {itemPredatesWatchHistory(item) && (
                  <span
                    data-testid="predates-tracking-badge"
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5 shrink-0"
                    title="Added before watch history tracking began (July 2017). May have been watched previously."
                  >
                    <History className="w-2.5 h-2.5" />
                    Pre-2017
                  </span>
                )}
                {(item.protectionRequestCount ?? 0) > 0 && (
                  <span
                    data-testid="protection-request-count-badge"
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40 flex items-center gap-0.5 shrink-0"
                    title={`${item.protectionRequestCount} user${(item.protectionRequestCount ?? 0) > 1 ? 's' : ''} asked to protect this item`}
                  >
                    <Shield className="w-2.5 h-2.5 text-violet-400" />
                    <span>{item.protectionRequestCount}</span>
                  </span>
                )}
              </div>
              {item.year && <span className="text-slate-500 font-normal text-[11px] font-mono block">({item.year})</span>}
            </div>
          </div>
        </td>
        <td className="p-3 text-slate-400 overflow-hidden whitespace-nowrap">
          <div className="flex items-center gap-1">
            {item.mediaType === 1 ? <Tv className="w-3 h-3 text-sky-400 shrink-0" /> : <Film className="w-3 h-3 text-amber-400 shrink-0" />}
            <span>{item.mediaType === 1 ? 'Series' : 'Movie'}</span>
          </div>
        </td>
        <td className="p-3 overflow-hidden whitespace-nowrap">
          <div className="flex items-center gap-1 overflow-hidden">
            {item.instances.map((i) => {
              const badge = getInstanceBadge(i);
              return (
                <React.Fragment key={i.id}>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${badge.style}`}
                  >
                    {badge.label}
                  </span>
                  {i.cutoffUnmet && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0"
                      title="Quality cutoff unmet"
                    >
                      Cutoff
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </td>
        <td className="p-3 font-mono text-slate-200 overflow-hidden whitespace-nowrap">{formatSize(item.totalSizeBytes)}</td>
        <td className="p-3 text-slate-300 font-mono overflow-hidden whitespace-nowrap">{totalPlays}</td>
        <td className="p-3 text-slate-400 overflow-hidden whitespace-nowrap">{getLastPlayed(item)}</td>
        <td className="p-3 text-slate-400 font-mono text-[11px] overflow-hidden whitespace-nowrap">{formatDate(item.addedAt)}</td>
        <td className="p-3 text-right overflow-hidden whitespace-nowrap">
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => {
                if (isGuest) {
                  onOpenDetail(item);
                } else {
                  onToggleProtect(item.id, !item.isProtected);
                }
              }}
              className={`p-1.5 rounded transition min-w-[28px] min-h-[28px] flex items-center justify-center ${
                item.isProtected
                  ? 'text-emerald-300 bg-emerald-500/20'
                  : (item.protectionRequestCount ?? 0) > 0
                  ? 'text-violet-300 bg-violet-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title={
                item.isProtected
                  ? 'Protected'
                  : isGuest
                  ? 'View protection requests / Ask to protect'
                  : 'Protect'
              }
              aria-label={item.isProtected ? 'Protected' : 'Protect'}
            >
              <Shield className="w-3.5 h-3.5" />
            </button>
            {!isGuest && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpgradeQuality?.(item);
                }}
                className="p-1.5 rounded text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition min-w-[28px] min-h-[28px] flex items-center justify-center"
                title="Upgrade quality profile & search"
                aria-label="Upgrade quality"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {!isGuest && (
              <div className="relative inline-block">
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
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 disabled:opacity-25 transition min-w-[28px] min-h-[28px] flex items-center justify-center"
                  title="Prune"
                  aria-label="Prune"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

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
        </td>
      </tr>
    );
  },
  (prev, next) => prev.item === next.item && prev.isSelected === next.isSelected
);

export const TableView: React.FC<TableViewProps> = ({
  items,
  selectedIds,
  onToggleSelect,
  onToggleProtect,
  onPrune,
  onOpenDetail,
  onUpgradeQuality,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Stable dataset-derived column widths computed on load to prevent virtual layout shifts
  const columnWidths = React.useMemo(() => {
    const CELL_PADDING_PX = 24; // p-3 is 12px horizontal padding on each side
    const CHAR_WIDTH_SANS = 7.5; // ~7.5px per character at text-xs (12px font)
    const CHAR_WIDTH_MONO = 7.2; // ~7.2px per character in font-mono at text-xs

    // 1. Select checkbox: 16px checkbox + 24px padding + 4px breathing room
    const select = 44;

    // 2. Type: 12px icon + 4px gap + "Series" text (6 chars * 7.5px = 45px) + 24px padding = ~85px
    const type = Math.max(84, Math.ceil(6 * CHAR_WIDTH_SANS + 16 + CELL_PADDING_PX));

    // 3. Tier / Instances: Calculate based on max instance badges + cutoff across the whole dataset
    let maxInstances = 1;
    let hasCutoff = false;
    let maxBadgeCharLen = 4;

    for (const item of items) {
      if (item.instances.length > maxInstances) {
        maxInstances = item.instances.length;
      }
      for (const inst of item.instances) {
        const badge = getInstanceBadge(inst);
        if (badge.label.length > maxBadgeCharLen) {
          maxBadgeCharLen = badge.label.length;
        }
        if (inst.cutoffUnmet) {
          hasCutoff = true;
        }
      }
    }

    // Badge width: chars * 6.2px (text-[10px]) + px-1.5 (12px) + 2px border
    const badgeWidth = Math.ceil(maxBadgeCharLen * 6.2 + 14);
    const cutoffWidth = hasCutoff ? Math.ceil(6 * 6.2 + 14) : 0;
    const instancesContentWidth = (maxInstances * badgeWidth) + (maxInstances > 1 ? (maxInstances - 1) * 4 : 0) + (hasCutoff ? 4 + cutoffWidth : 0);
    const instances = Math.max(140, Math.min(260, instancesContentWidth + CELL_PADDING_PX));

    // 4. Size: Max format "999.9 GB" or "12.4 TB" (~8 chars mono) + 24px padding = ~82px -> 88px
    const size = Math.max(88, Math.ceil(8 * CHAR_WIDTH_MONO + CELL_PADDING_PX));

    // 5. Plays: Max plays across dataset
    let maxPlayDigits = 1;
    for (const item of items) {
      const plays = item.watchStats.reduce((sum, w) => sum + w.playCount, 0);
      const digits = plays.toString().length;
      if (digits > maxPlayDigits) maxPlayDigits = digits;
    }
    const plays = Math.max(64, Math.ceil(Math.max(4, maxPlayDigits) * CHAR_WIDTH_MONO + CELL_PADDING_PX));

    // 6. Last Watched: "11mo ago", "Watched", "Never" (~10 chars) + 24px padding = ~99px -> 104px
    const lastWatched = Math.max(104, Math.ceil(10 * CHAR_WIDTH_SANS + CELL_PADDING_PX));

    // 7. Added: Monospace date "Sep 15, 2024" (12 chars @ text-[11px] ~6.6px) + 24px padding = ~103px -> 112px
    const added = Math.max(112, Math.ceil(12 * 6.6 + CELL_PADDING_PX));

    // 8. Actions: Three 28px touch targets + 2x6px gap + 24px padding = ~120px
    const actions = 120;

    // 9. Title minimum width: poster 28px + 10px gap + 15 chars text + pre-2017 badge = ~220px
    const titleMin = 220;

    const totalMinWidth = select + titleMin + type + instances + size + plays + lastWatched + added + actions;

    return {
      select,
      type,
      instances,
      size,
      plays,
      lastWatched,
      added,
      actions,
      titleMin,
      totalMinWidth,
    };
  }, [items]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Exact row height: 40px poster + 24px vertical padding (h-16)
    overscan: 5,
    useFlushSync: false,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const lastVirtualRowIndex = virtualRows.length > 0 ? virtualRows[virtualRows.length - 1].index : -1;

  useEffect(() => {
    if (lastVirtualRowIndex < 0) return;
    if (lastVirtualRowIndex >= items.length - 10 && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [lastVirtualRowIndex, items.length, hasMore, isLoadingMore, onLoadMore]);

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      ref={parentRef}
      className="border border-slate-800 rounded-xl overflow-auto bg-slate-900/40 max-h-[calc(100vh-230px)] scrollbar-thin overscroll-y-contain [WebkitOverflowScrolling:touch]"
    >
      <table
        className="w-full text-left border-collapse text-xs table-fixed"
        style={{ minWidth: `${columnWidths.totalMinWidth}px` }}
      >
        <colgroup>
          <col style={{ width: `${columnWidths.select}px` }} />
          <col style={{ width: 'auto', minWidth: `${columnWidths.titleMin}px` }} />
          <col style={{ width: `${columnWidths.type}px` }} />
          <col style={{ width: `${columnWidths.instances}px` }} />
          <col style={{ width: `${columnWidths.size}px` }} />
          <col style={{ width: `${columnWidths.plays}px` }} />
          <col style={{ width: `${columnWidths.lastWatched}px` }} />
          <col style={{ width: `${columnWidths.added}px` }} />
          <col style={{ width: `${columnWidths.actions}px` }} />
        </colgroup>
        <thead className="sticky top-0 z-20 bg-slate-950/95 border-b border-slate-800 backdrop-blur-sm shadow-sm">
          <tr className="text-slate-400 font-medium h-10">
            <th className="p-3" style={{ width: `${columnWidths.select}px` }}></th>
            <th className="p-3">Title</th>
            <th className="p-3" style={{ width: `${columnWidths.type}px` }}>Type</th>
            <th className="p-3" style={{ width: `${columnWidths.instances}px` }}>Tier / Instances</th>
            <th className="p-3" style={{ width: `${columnWidths.size}px` }}>Size</th>
            <th className="p-3" style={{ width: `${columnWidths.plays}px` }}>Plays</th>
            <th className="p-3" style={{ width: `${columnWidths.lastWatched}px` }}>Last Watched</th>
            <th className="p-3" style={{ width: `${columnWidths.added}px` }}>Added</th>
            <th className="p-3 text-right" style={{ width: `${columnWidths.actions}px` }}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {virtualRows.length > 0 && (
            <>
              {virtualRows[0].start > 0 && (
                <tr>
                  <td colSpan={9} style={{ height: `${virtualRows[0].start}px`, padding: 0, border: 'none' }} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const item = items[virtualRow.index];
                if (!item) return null;

                return (
                  <TableRow
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    onToggleSelect={onToggleSelect}
                    onToggleProtect={onToggleProtect}
                    onPrune={onPrune}
                    onOpenDetail={onOpenDetail}
                    onUpgradeQuality={onUpgradeQuality}
                    formatSize={formatSize}
                    getLastPlayed={getLastPlayed}
                    formatDate={formatDate}
                  />
                );
              })}
              {rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0) > 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      height: `${rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0)}px`,
                      padding: 0,
                      border: 'none',
                    }}
                  />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>

      {isLoadingMore && (
        <div className="py-3 border-t border-slate-800 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading more candidates...</span>
        </div>
      )}
    </div>
  );
};
