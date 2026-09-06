import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { MediaItem } from '../types/api';

interface PruneConfirmModalProps {
  items: MediaItem[];
  seasonNumber?: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetConnectionIds: string[], addImportExclusion: boolean) => Promise<void>;
}

export const PruneConfirmModal: React.FC<PruneConfirmModalProps> = ({
  items,
  seasonNumber,
  isOpen,
  onClose,
  onConfirm,
}) => {
  // Extract all unique connection IDs across all items
  const allInstances = items.flatMap((i) => i.instances);
  const uniqueConnections = Array.from(
    new Map(allInstances.map((i) => [i.connectionId, i.qualityProfileName || 'Default'])).entries()
  );

  const [selectedConnections, setSelectedConnections] = useState<string[]>(
    uniqueConnections.map(([id]) => id)
  );
  const [addImportExclusion, setAddImportExclusion] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || items.length === 0) return null;

  const totalBytes = items.reduce((sum, i) => sum + i.totalSizeBytes, 0);
  const gb = totalBytes / (1024 * 1024 * 1024);
  const sizeStr = gb >= 1000 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toFixed(1)} GB`;

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
              <h2 className="text-base font-bold text-white">
                Confirm Deletion {seasonNumber !== undefined ? `(Season ${seasonNumber})` : ''}
              </h2>
              <p className="text-xs text-slate-400">
                This will unlink video files from your disk drive via Sonarr/Radarr.
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
            <span className="font-semibold text-white">{items.length} titles</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Storage to reclaim:</span>
            <span className="font-mono font-bold text-emerald-400">{sizeStr}</span>
          </div>
        </div>

        {/* Selected Titles List preview */}
        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin text-xs">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-slate-950/40 border border-slate-800/60 px-2.5 py-1.5 rounded-md"
            >
              <span className="font-medium text-slate-200 truncate">{item.title}</span>
              <span className="font-mono text-slate-400 text-[11px]">
                {((item.totalSizeBytes) / (1024 * 1024 * 1024)).toFixed(1)} GB
              </span>
            </div>
          ))}
        </div>

        {/* Instance Target Selectors (HD vs 4K) */}
        {uniqueConnections.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">Target Arr Instances:</div>
            <div className="flex flex-wrap gap-2">
              {uniqueConnections.map(([connId, tierName]) => {
                const checked = selectedConnections.includes(connId);
                return (
                  <button
                    type="button"
                    key={connId}
                    onClick={() => handleToggleConnection(connId)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-2 ${
                      checked
                        ? 'bg-sky-950/40 border-sky-500 text-sky-200'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-sky-600 pointer-events-none"
                    />
                    <span>{tierName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Import Exclusion Checkbox (Defaults to false per decision) */}
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
              Permanently blacklist from future automated RSS and indexer re-downloads.
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
            {isDeleting ? 'Deleting from Disk...' : 'Confirm & Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
