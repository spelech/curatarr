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

  it('setSelectedPre2017Filter updates state, resets selection, and passes pre2017Filter param to fetchItems', async () => {
    let capturedUrl = '';
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => [],
      } as Response;
    });

    useCatalogStore.setState({ selectedIds: new Set(['item-1']) });
    await useCatalogStore.getState().setSelectedPre2017Filter('exclude');

    const state = useCatalogStore.getState();
    expect(state.selectedPre2017Filter).toBe('exclude');
    expect(state.selectedIds.size).toBe(0);
    expect(capturedUrl).toContain('pre2017Filter=exclude');

    await useCatalogStore.getState().setSelectedPre2017Filter('only');
    expect(useCatalogStore.getState().selectedPre2017Filter).toBe('only');
    expect(capturedUrl).toContain('pre2017Filter=only');

    await useCatalogStore.getState().setSelectedPre2017Filter('all');
    expect(useCatalogStore.getState().selectedPre2017Filter).toBe('all');
    expect(capturedUrl).not.toContain('pre2017Filter=');
  });

  it('executePrune updates items and notification count on success', async () => {
    const mockItem: MediaItem = {
      id: 'prune-1',
      title: 'Movie to Prune',
      sortTitle: 'Movie to Prune',
      mediaType: 0,
      totalSizeBytes: 5000,
      isProtected: false,
      instances: [],
      seasons: [],
      watchStats: [],
    };

    useCatalogStore.setState({
      items: [mockItem],
      selectedIds: new Set(['prune-1']),
    });

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/v1/prune') {
        return {
          ok: true,
          json: async () => ({ success: true, message: 'Pruned', bytesFreed: 5000 }),
        } as Response;
      }
      return { ok: true, json: async () => [] } as Response;
    });

    const result = await useCatalogStore.getState().executePrune({
      mediaItemId: 'prune-1',
      targetConnectionIds: ['conn-1'],
      addImportExclusion: true,
    });

    expect(result.success).toBe(true);
    expect(result.bytesFreed).toBe(5000);
    expect(useCatalogStore.getState().items.find((i) => i.id === 'prune-1')).toBeUndefined();
    expect(useCatalogStore.getState().selectedIds.has('prune-1')).toBe(false);
    expect(useCatalogStore.getState().prunedNotification?.bytesFreed).toBe(5000);
  });

  it('toggleProtect sends update to API and mutates item protection state', async () => {
    const mockItem: MediaItem = {
      id: 'item-protect',
      title: 'Item to Protect',
      sortTitle: 'Item to Protect',
      mediaType: 0,
      totalSizeBytes: 5000,
      isProtected: false,
      instances: [],
      seasons: [],
      watchStats: [],
    };

    useCatalogStore.setState({ items: [mockItem] });

    let requestBody: Record<string, unknown> | null = null;
    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url === '/api/v1/protect') {
        requestBody = JSON.parse(opts?.body as string);
        return { ok: true } as Response;
      }
      return { ok: true, json: async () => [] } as Response;
    });

    await useCatalogStore.getState().toggleProtect('item-protect', true, 'Favorite Movie');

    expect(requestBody).toEqual({
      mediaItemId: 'item-protect',
      isProtected: true,
      reason: 'Favorite Movie',
    });
    const updated = useCatalogStore.getState().items.find((i) => i.id === 'item-protect');
    expect(updated?.isProtected).toBe(true);
    expect(updated?.protectionReason).toBe('Favorite Movie');
  });

  it('refreshPlex returns success message or handles network failures', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Plex library scanned' }),
    } as Response);

    const successRes = await useCatalogStore.getState().refreshPlex();
    expect(successRes.success).toBe(true);
    expect(successRes.message).toBe('Plex library scanned');

    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'));
    const failRes = await useCatalogStore.getState().refreshPlex();
    expect(failRes.success).toBe(false);
    expect(failRes.message).toBe('Connection refused');
  });
});
