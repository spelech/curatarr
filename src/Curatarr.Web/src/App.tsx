import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { useCatalogStore } from './stores/useCatalogStore';
import { Header } from './components/Header';
import { CategoryTabs } from './components/CategoryTabs';
import { ControlBar } from './components/ControlBar';
import { MediaCard } from './components/MediaCard';
import { TableView } from './components/TableView';
import { BatchActionBar } from './components/BatchActionBar';
import { PruneConfirmModal } from './components/PruneConfirmModal';
import { SettingsModal } from './components/SettingsModal';
import { AuditLogModal } from './components/AuditLogModal';
import { MediaItem } from './types/api';

export default function App() {
  const {
    items,
    selectedIds,
    toggleSelect,
    toggleProtect,
    viewMode,
    isLoading,
    fetchCategories,
    fetchUsers,
    fetchItems,
    clearSelection,
    executePrune,
  } = useCatalogStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
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
  }, [fetchCategories, fetchUsers, fetchItems]);

  const selectedItems = items.filter((i) => selectedIds.has(i.id));

  // Single Item Prune Trigger
  const handleOpenSinglePrune = (item: MediaItem, seasonNumber?: number) => {
    setPruneModalState({
      isOpen: true,
      items: [item],
      seasonNumber,
    });
  };

  // Batch Prune Trigger
  const handleOpenBatchPrune = () => {
    setPruneModalState({
      isOpen: true,
      items: selectedItems,
    });
  };

  // Execute Prune Confirmation
  const handleConfirmPrune = async (targetConnectionIds: string[], addImportExclusion: boolean) => {
    for (const item of pruneModalState.items) {
      await executePrune({
        mediaItemId: item.id,
        seasonNumber: pruneModalState.seasonNumber,
        targetConnectionIds,
        addImportExclusion,
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-5">
        {/* Category Tabs */}
        <CategoryTabs />

        {/* Filters & Control Bar */}
        <ControlBar />

        {/* Content View: Grid or Table */}
        {isLoading ? (
          <div className="border border-dashed border-slate-800 rounded-2xl p-16 text-center text-slate-500 text-xs">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading catalog candidates...
          </div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-2xl p-16 text-center">
            <Film className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No Candidates Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              No media items matched the active category or filter. Your library is clean, or you can trigger a "Sync Now" to update.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={() => toggleSelect(item.id)}
                onToggleProtect={() => toggleProtect(item.id, !item.isProtected)}
                onPrune={(seasonNum) => handleOpenSinglePrune(item, seasonNum)}
              />
            ))}
          </div>
        ) : (
          <TableView
            items={items}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleProtect={toggleProtect}
            onPrune={(item) => handleOpenSinglePrune(item)}
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
    </div>
  );
}
