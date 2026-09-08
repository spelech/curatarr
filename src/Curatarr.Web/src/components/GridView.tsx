import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MediaItem } from '../types/api';
import { MediaCard } from './MediaCard';

interface GridViewProps {
  items: MediaItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleProtect: (id: string, isProtected: boolean) => void;
  onPrune: (item: MediaItem, seasonNum?: number) => void;
  onOpenDetail: (item: MediaItem) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

export const GridView: React.FC<GridViewProps> = ({
  items,
  selectedIds,
  onToggleSelect,
  onToggleProtect,
  onPrune,
  onOpenDetail,
  hasMore,
  isLoadingMore,
  onLoadMore,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columnsCount, setColumnsCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      if (width >= 1536) return 7;
      if (width >= 1280) return 6;
      if (width >= 1024) return 5;
      if (width >= 768) return 4;
      if (width >= 640) return 3;
      return 2;
    }
    return 4;
  });

  // Dynamically calculate column count based on parent width
  useEffect(() => {
    if (!parentRef.current) return;

    const updateColumns = () => {
      if (!parentRef.current) return;
      const width = parentRef.current.clientWidth;
      if (width >= 1536) setColumnsCount(7);
      else if (width >= 1280) setColumnsCount(6);
      else if (width >= 1024) setColumnsCount(5);
      else if (width >= 768) setColumnsCount(4);
      else if (width >= 640) setColumnsCount(3);
      else setColumnsCount(2);
    };

    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(items.length / columnsCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 380, // Approximate row height with gap
    overscan: 3,
  });

  // Re-measure when column layout changes
  useEffect(() => {
    rowVirtualizer.measure();
  }, [columnsCount, rowVirtualizer]);

  // Infinite scroll trigger when reaching near the bottom virtual items
  const virtualRows = rowVirtualizer.getVirtualItems();
  const lastVirtualRow = virtualRows[virtualRows.length - 1];

  useEffect(() => {
    if (!lastVirtualRow) return;
    if (lastVirtualRow.index >= rowCount - 2 && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [lastVirtualRow, rowCount, hasMore, isLoadingMore, onLoadMore]);

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto max-h-[calc(100vh-230px)] pr-1 scrollbar-thin rounded-xl"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columnsCount;
          const rowItems = items.slice(startIndex, startIndex + columnsCount);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))`,
                gap: '0.875rem',
                paddingBottom: '0.875rem',
              }}
            >
              {rowItems.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.has(item.id)}
                  onToggleSelect={() => onToggleSelect(item.id)}
                  onToggleProtect={() => onToggleProtect(item.id, !item.isProtected)}
                  onPrune={(seasonNum) => onPrune(item, seasonNum)}
                  onOpenDetail={() => onOpenDetail(item)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {isLoadingMore && (
        <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading more candidates...</span>
        </div>
      )}
    </div>
  );
};
