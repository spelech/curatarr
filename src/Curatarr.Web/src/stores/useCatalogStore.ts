import { create } from 'zustand';
import { CategorySummary, MediaItem, TautulliUser } from '../types/api';

interface CatalogState {
  items: MediaItem[];
  categories: CategorySummary[];
  users: TautulliUser[];
  selectedCategory: string;
  selectedUserId: string | null;
  selectedMediaType: 'all' | 'movie' | 'series';
  selectedResolution: string | null;
  selectedCutoffUnmet: boolean | null;
  searchQuery: string;
  sortBy: string;
  sortDesc: boolean;
  viewMode: 'grid' | 'table';
  selectedIds: Set<string>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  pageSize: number;
  isSyncing: boolean;
  prunedNotification: { count: number; bytesFreed: number } | null;

  // Actions
  setSelectedCategory: (cat: string) => void;
  setSelectedUserId: (userId: string | null) => void;
  setSelectedMediaType: (type: 'all' | 'movie' | 'series') => void;
  setSelectedResolution: (resolution: string | null) => void;
  setSelectedCutoffUnmet: (cutoff: boolean | null) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: string) => void;
  toggleSortDesc: () => void;
  setViewMode: (mode: 'grid' | 'table') => void;
  setPageSize: (size: number) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  clearPrunedNotification: () => void;

  fetchCategories: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchItems: () => Promise<void>;
  loadMore: () => Promise<void>;
  toggleProtect: (mediaItemId: string, isProtected: boolean, reason?: string) => Promise<void>;
  triggerSync: () => Promise<void>;
  refreshPlex: () => Promise<{ success: boolean; message: string }>;
  executePrune: (params: { mediaItemId: string; seasonNumber?: number; targetConnectionIds: string[]; addImportExclusion: boolean }) => Promise<{ success: boolean; message: string; bytesFreed: number }>;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  items: [],
  categories: [],
  users: [],
  selectedCategory: 'never_watched',
  selectedUserId: null,
  selectedMediaType: 'all',
  selectedResolution: null,
  selectedCutoffUnmet: null,
  searchQuery: '',
  sortBy: 'size',
  sortDesc: true,
  viewMode: 'grid',
  selectedIds: new Set<string>(),
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  pageSize: 50,
  isSyncing: false,
  prunedNotification: null,

  setSelectedCategory: (cat) => {
    set({ selectedCategory: cat, selectedIds: new Set() });
    get().fetchItems();
  },

  setSelectedUserId: (userId) => {
    set({ selectedUserId: userId });
    get().fetchCategories();
    get().fetchItems();
  },

  setSelectedMediaType: (type) => {
    set({ selectedMediaType: type, selectedIds: new Set() });
    get().fetchItems();
  },

  setSelectedResolution: (resolution) => {
    set({ selectedResolution: resolution, selectedIds: new Set() });
    get().fetchItems();
  },

  setSelectedCutoffUnmet: (cutoff) => {
    set({ selectedCutoffUnmet: cutoff, selectedIds: new Set() });
    get().fetchItems();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().fetchItems();
  },

  setSortBy: (sort) => {
    set({ sortBy: sort });
    get().fetchItems();
  },

  toggleSortDesc: () => {
    set((state) => ({ sortDesc: !state.sortDesc }));
    get().fetchItems();
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setPageSize: (size) => {
    set({ pageSize: size });
    get().fetchItems();
  },

  toggleSelect: (id) => {
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    });
  },

  selectAll: () => {
    set((state) => ({
      selectedIds: new Set(state.items.map((i) => i.id)),
    }));
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  clearPrunedNotification: () => set({ prunedNotification: null }),

  fetchCategories: async () => {
    try {
      const userParam = get().selectedUserId ? `?userId=${encodeURIComponent(get().selectedUserId!)}` : '';
      const res = await fetch(`/api/v1/categories${userParam}`);
      if (res.ok) {
        const data = await res.json();
        set({ categories: data });
      }
    } catch {
      // Ignore in mock/offline
    }
  },

  fetchUsers: async () => {
    try {
      const res = await fetch('/api/v1/users');
      if (res.ok) {
        const data = await res.json();
        set({ users: data });
      }
    } catch {
      // Ignore
    }
  },

  fetchItems: async () => {
    set({ isLoading: true, hasMore: true });
    try {
      const { selectedCategory, selectedUserId, selectedMediaType, selectedResolution, selectedCutoffUnmet, searchQuery, sortBy, sortDesc, pageSize } = get();
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedUserId) params.set('userId', selectedUserId);
      if (selectedMediaType !== 'all') params.set('mediaType', selectedMediaType);
      if (selectedResolution) params.set('resolution', selectedResolution);
      if (selectedCutoffUnmet !== null) params.set('cutoffUnmet', selectedCutoffUnmet.toString());
      if (searchQuery) params.set('search', searchQuery);
      params.set('sortBy', sortBy);
      params.set('sortDesc', sortDesc.toString());
      params.set('limit', pageSize.toString());
      params.set('offset', '0');

      const res = await fetch(`/api/v1/catalog?${params.toString()}`);
      if (res.ok) {
        const data: MediaItem[] = await res.json();
        set({
          items: data,
          hasMore: data.length >= pageSize,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { hasMore, isLoading, isLoadingMore, items, pageSize, selectedCategory, selectedUserId, selectedMediaType, selectedResolution, selectedCutoffUnmet, searchQuery, sortBy, sortDesc } = get();
    if (!hasMore || isLoading || isLoadingMore) return;

    set({ isLoadingMore: true });
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedUserId) params.set('userId', selectedUserId);
      if (selectedMediaType !== 'all') params.set('mediaType', selectedMediaType);
      if (selectedResolution) params.set('resolution', selectedResolution);
      if (selectedCutoffUnmet !== null) params.set('cutoffUnmet', selectedCutoffUnmet.toString());
      if (searchQuery) params.set('search', searchQuery);
      params.set('sortBy', sortBy);
      params.set('sortDesc', sortDesc.toString());
      params.set('limit', pageSize.toString());
      params.set('offset', items.length.toString());

      const res = await fetch(`/api/v1/catalog?${params.toString()}`);
      if (res.ok) {
        const data: MediaItem[] = await res.json();
        const existingIds = new Set(items.map((i) => i.id));
        const newItems = data.filter((i) => !existingIds.has(i.id));

        set((state) => ({
          items: [...state.items, ...newItems],
          hasMore: data.length >= pageSize,
          isLoadingMore: false,
        }));
      } else {
        set({ isLoadingMore: false });
      }
    } catch {
      set({ isLoadingMore: false });
    }
  },

  toggleProtect: async (mediaItemId, isProtected, reason) => {
    try {
      const res = await fetch('/api/v1/protect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId, isProtected, reason }),
      });
      if (res.ok) {
        set((state) => ({
          items: state.items.map((i) =>
            i.id === mediaItemId ? { ...i, isProtected, protectionReason: reason } : i
          ),
        }));
        get().fetchCategories();
      }
    } catch {
      // Ignore
    }
  },

  triggerSync: async () => {
    set({ isSyncing: true });
    try {
      await fetch('/api/v1/sync', { method: 'POST' });
      // Poll briefly
      setTimeout(() => {
        get().fetchCategories();
        get().fetchItems();
        set({ isSyncing: false });
      }, 3000);
    } catch {
      set({ isSyncing: false });
    }
  },

  refreshPlex: async () => {
    try {
      const res = await fetch('/api/v1/plex/refresh', { method: 'POST' });
      const data = await res.json();
      return { success: res.ok, message: data.message || 'Plex refreshed' };
    } catch (e: unknown) {
      return { success: false, message: (e as Error).message || 'Failed to refresh Plex' };
    }
  },

  executePrune: async ({ mediaItemId, seasonNumber, targetConnectionIds, addImportExclusion }) => {
    try {
      const res = await fetch('/api/v1/prune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaItemId,
          seasonNumber,
          targetConnectionIds,
          addImportExclusion,
          actor: 'WebUI',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Remove or update local state
        set((state) => {
          const prevNotif = state.prunedNotification || { count: 0, bytesFreed: 0 };
          return {
            items: state.items.filter((i) => i.id !== mediaItemId || seasonNumber !== undefined),
            selectedIds: new Set([...state.selectedIds].filter((id) => id !== mediaItemId)),
            prunedNotification: {
              count: prevNotif.count + 1,
              bytesFreed: prevNotif.bytesFreed + (data.bytesFreed || 0),
            },
          };
        });

        get().fetchCategories();
        get().fetchItems();
        return { success: true, message: data.message, bytesFreed: data.bytesFreed };
      }

      return { success: false, message: data.message || 'Prune rejected', bytesFreed: 0 };
    } catch (e: unknown) {
      return { success: false, message: (e as Error).message || 'Network error', bytesFreed: 0 };
    }
  },
}));
