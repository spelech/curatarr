import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck, Trash2, X } from 'lucide-react';
import { MediaItem } from '../types/api';
import { useConnectionStore } from '../stores/useConnectionStore';

interface PruneConfirmModalProps {
  items: MediaItem[];
  seasonNumber?: number;
  initialTargetConnectionIds?: string[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetConnectionIds: string[], addImportExclusion: boolean) => Promise<void>;
}

export const PruneConfirmModal: React.FC<PruneConfirmModalProps> = ({
  items,
  seasonNumber,
  initialTargetConnectionIds,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const connections = useConnectionStore((s) => s.connections);

  // Extract unique instances across items
  const instanceOptions = useMemo(() => {
    const map = new Map<string, {
      connectionId: string;
      name: string;
      resolution?: string;
      totalSize: number;
    }>();

    for (const item of items) {
      for (const inst of item.instances || []) {
        const conn = connections.find((c) => c.id === inst.connectionId);
        const name = conn?.name || inst.qualityProfileName || inst.resolution || 'Arr';
        const existing = map.get(inst.connectionId);
        if (existing) {
          existing.totalSize += inst.sizeBytes;
        } else {
          map.set(inst.connectionId, {
            connectionId: inst.connectionId,
            name,
            resolution: inst.resolution || conn?.tierTag,
            totalSize: inst.sizeBytes,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [items, connections]);

  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [addImportExclusion, setAddImportExclusion] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      if (initialTargetConnectionIds && initialTargetConnectionIds.length > 0) {
        setSelectedConnections(initialTargetConnectionIds);
      } else {
        setSelectedConnections(instanceOptions.map((opt) => opt.connectionId));
      }
      setAddImportExclusion(false);
    }
  }, [isOpen, items, initialTargetConnectionIds, instanceOptions]);

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toFixed(1)} GB`;
  };

  const reclaimableBytes = useMemo(() => {
    if (seasonNumber !== undefined) {
      return items.reduce((sum, i) => {
        const s = i.seasons?.find((sea) => sea.seasonNumber === seasonNumber);
        return sum + (s?.sizeBytes ?? 0);
      }, 0);
    }

    return items.reduce((sum, item) => {
      const matching = (item.instances || []).filter((inst) =>
        selectedConnections.includes(inst.connectionId)
      );
      if (matching.length > 0) {
        return sum + matching.reduce((iSum, i) => iSum + i.sizeBytes, 0);
      }
      return (!item.instances || item.instances.length === 0) ? sum + item.totalSizeBytes : sum;
    }, 0);
  }, [items, seasonNumber, selectedConnections]);

  const preservedInstances = useMemo(() => {
    if (items.length !== 1 || seasonNumber !== undefined) return [];
    return (items[0].instances || []).filter(
      (inst) => !selectedConnections.includes(inst.connectionId)
    );
  }, [items, seasonNumber, selectedConnections]);

  const modalTitle = useMemo(() => {
    if (seasonNumber !== undefined) {
      return `Confirm Deletion (Season ${seasonNumber})`;
    }
    return 'Confirm Deletion';
  }, [seasonNumber]);

  if (!isOpen || items.length === 0) return null;

  const handleToggleConnection = (id: string) => {
    setSelectedConnections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    setIsDeleting(true);
    await onConfirm(selectedConnections, addImportExclusion);
    setIsDeleting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {modalTitle}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {items.length === 1 ? (
                  <span>
                    Delete <strong className="text-white font-medium">{items[0].title}</strong>
                    {items[0].year ? ` (${items[0].year})` : ''} from disk
                  </span>
                ) : (
                  <span>This will unlink and remove selected media files from your disk via Sonarr/Radarr.</span>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Space and Items Summary */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>Items to delete:</span>
            <span className="font-semibold text-white">
              {items.length} {items.length === 1 ? 'title' : 'titles'}
              {seasonNumber !== undefined ? ` (Season ${seasonNumber})` : ''}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Storage to reclaim:</span>
            <span className="font-mono font-bold text-emerald-400">{formatSize(reclaimableBytes)}</span>
          </div>
        </div>

        {/* Selected Titles List preview (when multiple items) */}
        {items.length > 1 && (
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin text-xs">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-slate-950/40 border border-slate-800/60 px-2.5 py-1.5 rounded-md"
              >
                <span className="font-medium text-slate-200 truncate">{item.title}</span>
                <span className="font-mono text-slate-400 text-[11px]">
                  {formatSize(item.totalSizeBytes)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Instance Target Selectors (HD vs 4K) */}
        {instanceOptions.length > 0 && seasonNumber === undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Target Arr Instances / Copies:</span>
              <span className="text-[11px] text-slate-400">
                {selectedConnections.length} of {instanceOptions.length} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {instanceOptions.map((opt) => {
                const checked = selectedConnections.includes(opt.connectionId);
                return (
                  <button
                    type="button"
                    key={opt.connectionId}
                    onClick={() => handleToggleConnection(opt.connectionId)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-2 ${
                      checked
                        ? 'bg-sky-950/40 border-sky-500 text-sky-200'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-sky-600 pointer-events-none"
                    />
                    <span>{opt.name}</span>
                    {opt.resolution && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-800 text-slate-300">
                        {opt.resolution}
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-slate-400">
                      ({formatSize(opt.totalSize)})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Preservation Reassurance Banner */}
        {preservedInstances.length > 0 && (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2.5 animate-in fade-in">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-200">Preserved copy: </span>
              {preservedInstances.map((inst) => {
                const conn = connections.find((c) => c.id === inst.connectionId);
                const name = conn?.name || inst.qualityProfileName || inst.resolution || 'Arr';
                return `${name} (${inst.resolution ? `${inst.resolution}, ` : ''}${formatSize(inst.sizeBytes)})`;
              }).join(', ')}
              <span className="text-slate-400 block mt-0.5">
                This copy will remain safely untouched on disk and in your library.
              </span>
            </div>
          </div>
        )}

        {/* Import Exclusion Checkbox (Optionally blacklist from re-download) */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5">
          <input
            type="checkbox"
            id="addExclusion"
            checked={addImportExclusion}
            onChange={(e) => setAddImportExclusion(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-600 focus:ring-sky-500 cursor-pointer"
          />
          <label htmlFor="addExclusion" className="text-xs text-slate-300 cursor-pointer select-none">
            <span className="font-medium text-white block">Add to Import Exclusion List</span>
            <span className="text-slate-400 text-[11px] block">
              Blacklist from future automated RSS and indexer re-downloads in the target Arr instance.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting || selectedConnections.length === 0}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium shadow-md transition flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Deleting from Disk...' : selectedConnections.length < instanceOptions.length && instanceOptions.length > 1 ? 'Confirm & Delete Selected Copy' : 'Confirm & Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
