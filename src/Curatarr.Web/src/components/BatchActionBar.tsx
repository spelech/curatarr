import React from 'react';
import { Shield, Trash2, X } from 'lucide-react';
import { MediaItem } from '../types/api';

interface BatchActionBarProps {
  selectedCount: number;
  selectedItems: MediaItem[];
  onBatchProtect: () => void;
  onBatchPrune: () => void;
  onClear: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  selectedItems,
  onBatchProtect,
  onBatchPrune,
  onClear,
}) => {
  if (selectedCount === 0) return null;

  const totalBytes = selectedItems.reduce((sum, item) => sum + item.totalSizeBytes, 0);
  const gb = totalBytes / (1024 * 1024 * 1024);
  const sizeStr = gb >= 1000 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toFixed(1)} GB`;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 text-xs animate-slide-up">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
        <span className="font-bold text-white bg-sky-600 px-2 py-0.5 rounded-full">
          {selectedCount}
        </span>
        <span className="text-slate-300">selected</span>
        <span className="font-mono text-slate-400">({sizeStr} reclaimable)</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBatchProtect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 font-medium transition"
        >
          <Shield className="w-3.5 h-3.5" />
          Protect All
        </button>

        <button
          onClick={onBatchPrune}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium shadow-sm transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Batch Prune
        </button>

        <button
          onClick={onClear}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Clear Selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
