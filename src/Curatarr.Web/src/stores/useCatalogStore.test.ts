import { describe, it, expect, beforeEach } from 'vitest';
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
});
