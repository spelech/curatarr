import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCatalogStore } from './useCatalogStore';
import { MediaItem } from '../types/api';

describe('useCatalogStore', () => {
  beforeEach(() => {
    useCatalogStore.setState({
      items: [],
      selectedIds: new Set<string>(),
      selectedCategory: 'never_watched',
      prunedNotification: null,
    });
  });

  it('should toggle item selection accurately', () => {
    const store = useCatalogStore.getState();
    store.toggleSelect('item-1');

    expect(useCatalogStore.getState().selectedIds.has('item-1')).toBe(true);

    store.toggleSelect('item-1');
    expect(useCatalogStore.getState().selectedIds.has('item-1')).toBe(false);
  });

  it('should select all items and clear selection', () => {
    const mockItems: MediaItem[] = [
      {
        id: '1',
        title: 'Movie A',
        sortTitle: 'Movie A',
        mediaType: 0,
        totalSizeBytes: 1000,
        isProtected: false,
        instances: [],
        seasons: [],
        watchStats: [],
      },
      {
        id: '2',
        title: 'Movie B',
        sortTitle: 'Movie B',
        mediaType: 0,
        totalSizeBytes: 2000,
        isProtected: false,
        instances: [],
        seasons: [],
        watchStats: [],
      },
    ];

    useCatalogStore.setState({ items: mockItems });
    const store = useCatalogStore.getState();

    store.selectAll();
    expect(useCatalogStore.getState().selectedIds.size).toBe(2);

    store.clearSelection();
    expect(useCatalogStore.getState().selectedIds.size).toBe(0);
  });

  it('fetchItems and loadMore handle infinite scrolling batches accurately', async () => {
    const batch1: MediaItem[] = Array.from({ length: 50 }, (_, i) => ({
      id: `item-${i}`,
      title: `Movie ${i}`,
      sortTitle: `Movie ${i}`,
      mediaType: 0,
      totalSizeBytes: 1000 * (i + 1),
      isProtected: false,
      instances: [],
      seasons: [],
      watchStats: [],
    }));

    const batch2: MediaItem[] = Array.from({ length: 25 }, (_, i) => ({
      id: `item-${i + 50}`,
      title: `Movie ${i + 50}`,
      sortTitle: `Movie ${i + 50}`,
      mediaType: 0,
      totalSizeBytes: 1000 * (i + 51),
      isProtected: false,
      instances: [],
      seasons: [],
      watchStats: [],
    }));

    // Mock initial fetchItems returning batch1 (50 items)
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => batch1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => batch2,
      } as Response);

    await useCatalogStore.getState().fetchItems();

    const stateAfterBatch1 = useCatalogStore.getState();
    expect(stateAfterBatch1.items.length).toBe(50);
    expect(stateAfterBatch1.hasMore).toBe(true);

    // Call loadMore
    await useCatalogStore.getState().loadMore();

    const stateAfterBatch2 = useCatalogStore.getState();
    expect(stateAfterBatch2.items.length).toBe(75);
    expect(stateAfterBatch2.hasMore).toBe(false); // batch2 returned 25 (< pageSize 50)
  });
});
