import React from 'react';
import { Layers, RefreshCw, Settings, History, CheckCircle2 } from 'lucide-react';
import { useCatalogStore } from '../stores/useCatalogStore';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenAudit: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenAudit }) => {
  const { isSyncing, triggerSync, prunedNotification, refreshPlex, clearPrunedNotification } = useCatalogStore();
  const [plexStatus, setPlexStatus] = React.useState<string | null>(null);

  const handlePlexRefresh = async () => {
    setPlexStatus('Scanning...');
    const res = await refreshPlex();
    setPlexStatus(res.message);
    setTimeout(() => {
      setPlexStatus(null);
      clearPrunedNotification();
    }, 4000);
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            Curatarr
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
              v1.0
            </span>
          </h1>
          <p className="text-xs text-slate-400">Media Curation & Library Decluttering</p>
        </div>
      </div>

      {/* Prune notice with manual Plex Refresh action */}
      {prunedNotification && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs text-amber-300 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>
            {prunedNotification.count} items pruned ({formatSize(prunedNotification.bytesFreed)} freed)
          </span>
          <button
            onClick={handlePlexRefresh}
            className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 font-medium text-amber-200 border border-amber-500/40 transition flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${plexStatus ? 'animate-spin' : ''}`} />
            {plexStatus || 'Refresh Plex'}
          </button>
        </div>
      )}

      {/* Right controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onOpenAudit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
        >
          <History className="w-3.5 h-3.5 text-slate-400" />
          Audit Log
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          Settings
        </button>

        <button
          onClick={() => triggerSync()}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 min-h-[28px] text-xs font-bold rounded-md bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 shadow-sm transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>
    </header>
  );
};
