import React from 'react';
import { Layers, RefreshCw, Settings, History, CheckCircle2, LogOut, User as UserIcon, Eye } from 'lucide-react';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useAuthStore } from '../stores/useAuthStore';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenAudit: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenAudit }) => {
  const isSyncing = useCatalogStore((s) => s.isSyncing);
  const triggerSync = useCatalogStore((s) => s.triggerSync);
  const prunedNotification = useCatalogStore((s) => s.prunedNotification);
  const refreshPlex = useCatalogStore((s) => s.refreshPlex);
  const clearPrunedNotification = useCatalogStore((s) => s.clearPrunedNotification);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPreviewingAsGuest = useAuthStore((s) => s.isPreviewingAsGuest);
  const setPreviewAsGuest = useAuthStore((s) => s.setPreviewAsGuest);
  const logout = useAuthStore((s) => s.logout);

  const isAdmin = (!user || user.role === 'Admin') && !isPreviewingAsGuest;
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
              v{__APP_VERSION__}
            </span>
          </h1>
          <p className="text-xs text-slate-400">Media Curation & Library Decluttering</p>
        </div>
      </div>

      {/* Prune notice with manual Plex Refresh action (Admin Only) */}
      {isAdmin && prunedNotification && (
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
        {/* User Info Chip */}
        {user && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            {user.thumbUrl ? (
              <img src={user.thumbUrl} alt={user.username} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                <UserIcon className="w-3 h-3" />
              </div>
            )}
            <span className="font-medium text-slate-200">{user.username}</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                isAdmin
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-700/80 text-slate-300 border border-slate-600'
              }`}
            >
              {isPreviewingAsGuest ? 'Guest (Preview)' : user.role}
            </span>
          </div>
        )}

        {/* Admin Guest Preview Toggle */}
        {user?.role === 'Admin' && (
          <button
            type="button"
            onClick={() => setPreviewAsGuest(!isPreviewingAsGuest)}
            title={isPreviewingAsGuest ? 'Exit Guest Preview' : 'Preview what guests see'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border transition cursor-pointer ${
              isPreviewingAsGuest
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isPreviewingAsGuest ? 'Exit Guest View' : 'View as Guest'}</span>
          </button>
        )}

        {isAdmin && (
          <>
            <button
              onClick={onOpenAudit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              Audit Log
            </button>

            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              Settings
            </button>

            <button
              onClick={() => triggerSync()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 min-h-[28px] text-xs font-bold rounded-md bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 shadow-sm transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </>
        )}

        {isAuthenticated && (
          <button
            onClick={() => logout()}
            title="Sign Out"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-500/30 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        )}
      </div>
    </header>
  );
};
