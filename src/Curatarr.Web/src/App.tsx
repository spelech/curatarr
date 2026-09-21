import { useEffect, useState, useCallback } from 'react';
import { Film } from 'lucide-react';
import { useCatalogStore } from './stores/useCatalogStore';
import { useConnectionStore } from './stores/useConnectionStore';
import { useToastStore } from './stores/useToastStore';
import { Header } from './components/Header';
import { CategoryTabs } from './components/CategoryTabs';
import { ControlBar } from './components/ControlBar';
import { GridView } from './components/GridView';
import { TableView } from './components/TableView';
import { BatchActionBar } from './components/BatchActionBar';
import { PruneConfirmModal } from './components/PruneConfirmModal';
import { SettingsModal } from './components/SettingsModal';
import { AuditLogModal } from './components/AuditLogModal';
import { MediaDetailModal } from './components/MediaDetailModal';
import { ToastContainer } from './components/ToastContainer';
import { MediaItem } from './types/api';

const formatSize = (bytes: number) => {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1000 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
};

export default function App() {
  const items = useCatalogStore((state) => state.items);
  const selectedIds = useCatalogStore((state) => state.selectedIds);
  const toggleSelect = useCatalogStore((state) => state.toggleSelect);
  const toggleProtect = useCatalogStore((state) => state.toggleProtect);
  const viewMode = useCatalogStore((state) => state.viewMode);
  const isLoading = useCatalogStore((state) => state.isLoading);
  const isLoadingMore = useCatalogStore((state) => state.isLoadingMore);
  const hasMore = useCatalogStore((state) => state.hasMore);
  const fetchCategories = useCatalogStore((state) => state.fetchCategories);
  const fetchUsers = useCatalogStore((state) => state.fetchUsers);
  const fetchItems = useCatalogStore((state) => state.fetchItems);
  const loadMore = useCatalogStore((state) => state.loadMore);
  const clearSelection = useCatalogStore((state) => state.clearSelection);
  const executePrune = useCatalogStore((state) => state.executePrune);
  const refreshPlex = useCatalogStore((state) => state.refreshPlex);

  const connections = useConnectionStore((state) => state.connections);
  const fetchConnections = useConnectionStore((state) => state.fetchConnections);

  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null);
  const [pruneModalState, setPruneModalState] = useState<{
    isOpen: boolean;
    items: MediaItem[];
    seasonNumber?: number;
  }>({
    isOpen: false,
    items: [],
  });

  useEffect(() => {
    fetchCategories();
    fetchUsers();
    fetchItems();
    fetchConnections();
  }, [fetchCategories, fetchUsers, fetchItems, fetchConnections]);

  const selectedItems = items.filter((i) => selectedIds.has(i.id));

  // Single Item Prune Trigger
  const handleOpenSinglePrune = useCallback((item: MediaItem, seasonNumber?: number) => {
    setPruneModalState({
      isOpen: true,
      items: [item],
      seasonNumber,
    });
  }, []);

  // Batch Prune Trigger
  const handleOpenBatchPrune = () => {
    setPruneModalState({
      isOpen: true,
      items: selectedItems,
    });
  };

  // Execute Prune Confirmation
  const handleConfirmPrune = async (targetConnectionIds: string[], addImportExclusion: boolean) => {
    let allSucceeded = true;

    for (const item of pruneModalState.items) {
      const inProgressToastId = addToast({
        type: 'info',
        title: `Pruning ${item.title}...`,
        duration: null,
      });

      try {
        const res = await executePrune({
          mediaItemId: item.id,
          seasonNumber: pruneModalState.seasonNumber,
          targetConnectionIds,
          addImportExclusion,
        });

        removeToast(inProgressToastId);

        if (res.success) {
          const connNames = targetConnectionIds
            .map((id) => {
              const c = connections.find((conn) => conn.id === id);
              if (c?.name) return c.name;
              const inst = item.instances?.find((i) => i.connectionId === id);
              return inst?.qualityProfileName || 'Arr';
            })
            .filter(Boolean);
          const targetConnectionsStr =
            connNames.length > 0 ? Array.from(new Set(connNames)).join(', ') : 'Arr';

          addToast({
            type: 'success',
            title: `Deleted from ${targetConnectionsStr} & Disk`,
            message: `${formatSize(res.bytesFreed)} reclaimed`,
            duration: 5000,
          });
        } else {
          allSucceeded = false;
          addToast({
            type: 'error',
            title: `Failed to prune ${item.title}`,
            message: res.message || 'Prune operation failed',
            duration: 5000,
          });
        }
      } catch (err: unknown) {
        removeToast(inProgressToastId);
        allSucceeded = false;
        addToast({
          type: 'error',
          title: `Failed to prune ${item.title}`,
          message: (err as Error).message || 'Unexpected error occurred',
          duration: 5000,
        });
      }
    }

    if (allSucceeded && pruneModalState.items.length > 0) {
      addToast({
        type: 'warning',
        title: 'Prune Complete: Manual Steps',
        message: 'Arr instances and disk files have been deleted. Complete these follow-up actions:',
        manualSteps: [
          'Plex: Empty Trash in your Plex library if automatic emptying is disabled.',
          "Overseerr / Seerr: Media will show as 'Available' until the next scheduled library sync.",
          'Download Client: Verify hardlinked or seeded downloads in your torrent/usenet client.',
        ],
        duration: null,
        action: {
          label: 'Scan Plex Libraries',
          onClick: async () => {
            await refreshPlex();
          },
        },
      });
    }
  };

  // Batch Protect Action
  const handleBatchProtect = async () => {
    for (const item of selectedItems) {
      await toggleProtect(item.id, true, 'Batch Whitelist');
    }
    clearSelection();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAudit={() => setIsAuditOpen(true)}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Category Tabs */}
        <CategoryTabs />

        {/* Filters & Control Bar */}
        <ControlBar />

        {/* Content View: Grid or Table */}
        {isLoading ? (
          <div className="border border-dashed border-slate-800 rounded-2xl p-16 text-center text-slate-400 text-xs">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading catalog candidates...
          </div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-2xl p-16 text-center">
            <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No Candidates Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              No media items matched the active category or filter. Your library is clean, or you can trigger a "Sync Now" to update.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView
            items={items}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleProtect={toggleProtect}
            onPrune={handleOpenSinglePrune}
            onOpenDetail={setDetailItem}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
        ) : (
          <TableView
            items={items}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleProtect={toggleProtect}
            onPrune={handleOpenSinglePrune}
            onOpenDetail={setDetailItem}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
        )}
      </main>

      {/* Sticky Batch Action Bar */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        selectedItems={selectedItems}
        onBatchProtect={handleBatchProtect}
        onBatchPrune={handleOpenBatchPrune}
        onClear={clearSelection}
      />

      {/* Media Detail Modal */}
      <MediaDetailModal
        item={detailItem}
        isOpen={detailItem !== null}
        onClose={() => setDetailItem(null)}
        onToggleProtect={async (id, isProtected, reason) => {
          await toggleProtect(id, isProtected, reason);
          if (detailItem && detailItem.id === id) {
            setDetailItem({ ...detailItem, isProtected, protectionReason: reason });
          }
        }}
        onPrune={(item, seasonNum) => {
          setDetailItem(null);
          handleOpenSinglePrune(item, seasonNum);
        }}
      />

      {/* Prune Confirmation Modal */}
      <PruneConfirmModal
        items={pruneModalState.items}
        seasonNumber={pruneModalState.seasonNumber}
        isOpen={pruneModalState.isOpen}
        onClose={() => setPruneModalState({ isOpen: false, items: [] })}
        onConfirm={handleConfirmPrune}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Forensic Audit Log Modal */}
      <AuditLogModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
