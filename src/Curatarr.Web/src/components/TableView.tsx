import React, { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Film, Tv, Shield, Trash2 } from 'lucide-react';
import { MediaItem } from '../types/api';
import { getInstanceBadge } from '../utils/badgeUtils';

interface TableViewProps {
  items: MediaItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleProtect: (id: string, isProtected: boolean) => void;
  onPrune: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export const TableView: React.FC<TableViewProps> = ({
  items,
  selectedIds,
  onToggleSelect,
  onToggleProtect,
  onPrune,
  onOpenDetail,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const lastVirtualRow = virtualRows[virtualRows.length - 1];

  useEffect(() => {
    if (!lastVirtualRow) return;
    if (lastVirtualRow.index >= items.length - 10 && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [lastVirtualRow, items.length, hasMore, isLoadingMore, onLoadMore]);

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
      className="border border-slate-800 rounded-xl overflow-auto bg-slate-900/40 max-h-[calc(100vh-230px)] scrollbar-thin"
    >
      <table className="w-full text-left border-collapse text-xs">
        <thead className="sticky top-0 z-20 bg-slate-950/95 border-b border-slate-800 backdrop-blur-sm shadow-sm">
          <tr className="text-slate-400 font-medium">
            <th className="p-3 w-8"></th>
            <th className="p-3">Title</th>
            <th className="p-3">Type</th>
            <th className="p-3">Tier / Instances</th>
            <th className="p-3">Size</th>
            <th className="p-3">Plays</th>
            <th className="p-3">Last Watched</th>
            <th className="p-3">Added</th>
            <th className="p-3 text-right">Actions</th>
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
                const isSelected = selectedIds.has(item.id);
                const totalPlays = item.watchStats.reduce((sum, w) => sum + w.playCount, 0);

                return (
                  <tr
                    key={item.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
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
                      <div
                        onClick={() => onOpenDetail(item)}
                        className="flex items-center gap-2.5 cursor-pointer hover:text-sky-300 transition"
                      >
                        {item.posterUrl ? (
                          <img
                            src={item.posterUrl}
                            alt={item.title}
                            className="w-7 h-10 object-cover rounded shadow-sm border border-slate-800 shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-7 h-10 bg-slate-800 rounded flex items-center justify-center shrink-0 text-slate-500 border border-slate-800">
                            {item.mediaType === 1 ? <Tv className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
                          </div>
                        )}
                        <div>
                          <div className="line-clamp-1">{item.title}</div>
                          {item.year && <span className="text-slate-500 font-normal text-[11px] font-mono">({item.year})</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-slate-400">
                      <div className="flex items-center gap-1">
                        {item.mediaType === 1 ? <Tv className="w-3 h-3 text-sky-400" /> : <Film className="w-3 h-3 text-amber-400" />}
                        <span>{item.mediaType === 1 ? 'Series' : 'Movie'}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {item.instances.map((i) => {
                          const badge = getInstanceBadge(i);
                          return (
                            <React.Fragment key={i.id}>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.style}`}
                              >
                                {badge.label}
                              </span>
                              {i.cutoffUnmet && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40"
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
                    <td className="p-3 font-mono text-slate-200">{formatSize(item.totalSizeBytes)}</td>
                    <td className="p-3 text-slate-300 font-mono">{totalPlays}</td>
                    <td className="p-3 text-slate-400">{getLastPlayed(item)}</td>
                    <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">{formatDate(item.addedAt)}</td>
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
