import React, { useState } from 'react';
import {
  X,
  Film,
  Tv,
  Shield,
  Trash2,
  ExternalLink,
  HardDrive,
  Calendar,
  Eye,
  Folder,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  ArrowUpCircle,
} from 'lucide-react';
import { MediaItem } from '../types/api';
import { getInstanceTitle, getBadgeStyle, itemPredatesWatchHistory } from '../utils/badgeUtils';
import { useAuthStore } from '../stores/useAuthStore';
import { useCatalogStore } from '../stores/useCatalogStore';

interface MediaDetailModalProps {
  item: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleProtect: (mediaItemId: string, isProtected: boolean, reason?: string) => void;
  onPrune: (item: MediaItem, seasonNumber?: number, targetConnectionIds?: string[]) => void;
  onUpgradeQuality?: (item: MediaItem, instanceId?: string) => void;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onToggleProtect,
  onPrune,
  onUpgradeQuality,
}) => {
  const user = useAuthStore((s) => s.user);
  const isPreviewingAsGuest = useAuthStore((s) => s.isPreviewingAsGuest);
  const isGuest = user?.role === 'Guest' || isPreviewingAsGuest;
  const isAdmin = user?.role === 'Admin' && !isPreviewingAsGuest;

  const catalogItem = useCatalogStore((s) => s.items.find((i) => i.id === item?.id));
  const currentItem = catalogItem || item;
  const requestProtection = useCatalogStore((s) => s.requestProtection);
  const removeProtectionRequest = useCatalogStore((s) => s.removeProtectionRequest);
  const clearProtectionRequests = useCatalogStore((s) => s.clearProtectionRequests);

  const [isEditingReason, setIsEditingReason] = useState(false);
  const [reasonInput, setReasonInput] = useState(currentItem?.protectionReason || '');
  const [isRequesting, setIsRequesting] = useState(false);
  const [guestReason, setGuestReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !currentItem) return null;

  const isSeries = currentItem.mediaType === 1;
  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toFixed(1)} GB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const totalPlays = currentItem.watchStats.reduce((sum, w) => sum + w.playCount, 0);
  const lastPlayed = currentItem.watchStats
    .map((w) => (w.lastPlayedAt ? new Date(w.lastPlayedAt).getTime() : 0))
    .reduce((max, t) => Math.max(max, t), 0);

  const formatLastPlayed = () => {
    if (lastPlayed === 0) return totalPlays > 0 ? 'Watched' : 'Never Watched';
    const daysAgo = Math.floor((Date.now() - lastPlayed) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return 'Watched today';
    if (daysAgo === 1) return 'Watched yesterday';
    if (daysAgo < 30) return `${daysAgo}d ago`;
    if (daysAgo < 365) return `${Math.floor(daysAgo / 30)}mo ago`;
    return `${Math.floor(daysAgo / 365)}y ago`;
  };

  const handleSaveProtection = () => {
    onToggleProtect(currentItem.id, !currentItem.isProtected, reasonInput || undefined);
    setIsEditingReason(false);
  };

  const handleRequestProtection = async () => {
    setIsSubmitting(true);
    try {
      await requestProtection(currentItem.id, guestReason);
      setIsRequesting(false);
      setGuestReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const myRequest = currentItem.protectionRequests?.find(
    (r) => r.userId === user?.id || (user?.username && r.username.toLowerCase() === user.username.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-fade-in overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-16 h-24 sm:w-20 sm:h-28 shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shadow-md">
              {currentItem.posterUrl ? (
                <img src={currentItem.posterUrl} alt={currentItem.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  {isSeries ? <Tv className="w-8 h-8 text-sky-400" /> : <Film className="w-8 h-8 text-amber-400" />}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {isSeries ? 'TV Series' : 'Movie'}
                </span>
                {currentItem.year && (
                  <span className="text-xs text-slate-400 font-mono">({currentItem.year})</span>
                )}
                {currentItem.isProtected && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Protected
                  </span>
                )}
                {(currentItem.protectionRequestCount ?? 0) > 0 && (
                  <span
                    data-testid="detail-protection-request-badge"
                    className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40 flex items-center gap-1"
                  >
                    <Shield className="w-3 h-3" />
                    {currentItem.protectionRequestCount} Protection {currentItem.protectionRequestCount === 1 ? 'Request' : 'Requests'}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight truncate" title={currentItem.title}>
                {currentItem.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300 scrollbar-thin">
          {/* Overseerr Requester and Request/Add Date Banner */}
          {(currentItem.requestedBy || currentItem.requestedAt) && (
            <div
              data-testid="overseerr-request-banner"
              className="p-3.5 bg-violet-950/20 border border-violet-800/40 rounded-xl flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-900/60 border border-violet-700/60 flex items-center justify-center text-violet-300 font-bold uppercase text-xs shrink-0">
                  {currentItem.requestedBy ? currentItem.requestedBy.substring(0, 2) : 'Req'}
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Requested in Overseerr by</div>
                  <div className="font-semibold text-white text-xs">{currentItem.requestedBy || 'Unknown User'}</div>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-400">
                {currentItem.requestedAt && (
                  <div>
                    Requested: <span className="text-slate-300 font-medium font-mono">{formatDate(currentItem.requestedAt)}</span>
                  </div>
                )}
                {currentItem.addedAt && (
                  <div>
                    Added to Library: <span className="text-slate-300 font-medium font-mono">{formatDate(currentItem.addedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick External Links Bar */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
            <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              External Metadata:
            </span>
            {currentItem.tmdbId && (
              <a
                href={isSeries ? `https://www.themoviedb.org/tv/${currentItem.tmdbId}` : `https://www.themoviedb.org/movie/${currentItem.tmdbId}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-sky-500 text-sky-300 hover:text-sky-200 transition font-mono"
              >
                TMDB: {currentItem.tmdbId}
              </a>
            )}
            {currentItem.tvdbId && (
              <a
                href={`https://thetvdb.com/dereferrer/series/${currentItem.tvdbId}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-sky-500 text-sky-300 hover:text-sky-200 transition font-mono"
              >
                TVDB: {currentItem.tvdbId}
              </a>
            )}
            {currentItem.imdbId && (
              <a
                href={`https://www.imdb.com/title/${currentItem.imdbId}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-amber-500 text-amber-300 hover:text-amber-200 transition font-mono"
              >
                IMDB: {currentItem.imdbId}
              </a>
            )}
            {currentItem.plexRatingKey && (
              <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-purple-300 font-mono">
                Plex ID: {currentItem.plexRatingKey}
              </span>
            )}
            {!currentItem.tmdbId && !currentItem.tvdbId && !currentItem.imdbId && !currentItem.plexRatingKey && (
              <span className="text-slate-500 italic">No external metadata IDs linked</span>
            )}
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
              <div className="text-slate-400 text-[11px] flex items-center gap-1 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                Storage Used
              </div>
              <div className="font-mono text-sm font-bold text-white">{formatSize(currentItem.totalSizeBytes)}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
              <div className="text-slate-400 text-[11px] flex items-center gap-1 mb-1">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                Total Plays
              </div>
              <div className="font-mono text-sm font-bold text-white">{totalPlays}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
              <div className="text-slate-400 text-[11px] flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Last Activity
              </div>
              <div className="font-medium text-xs text-white truncate" title={formatLastPlayed()}>
                {formatLastPlayed()}
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
              <div className="text-slate-400 text-[11px] flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Date Added
              </div>
              <div className="font-medium text-xs text-white truncate">{formatDate(currentItem.addedAt)}</div>
            </div>
          </div>

          {/* Protection Requests Section (View who requested & Ask to Protect) */}
          <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className={`w-4 h-4 ${(currentItem.protectionRequestCount ?? 0) > 0 ? 'text-violet-400' : 'text-slate-500'}`} />
                <span className="font-semibold text-white">
                  Protection Requests ({currentItem.protectionRequests?.length ?? currentItem.protectionRequestCount ?? 0})
                </span>
              </div>
              {isAdmin && (currentItem.protectionRequests?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await onToggleProtect(currentItem.id, true, 'Approved user protection request');
                      await clearProtectionRequests(currentItem.id);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition"
                  >
                    Approve & Whitelist
                  </button>
                  <button
                    onClick={() => clearProtectionRequests(currentItem.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* List of Requesters */}
            {currentItem.protectionRequests && currentItem.protectionRequests.length > 0 ? (
              <div className="divide-y divide-slate-800/60 border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900/40">
                {currentItem.protectionRequests.map((req) => (
                  <div key={req.id} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-800/20 transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {req.userThumb ? (
                        <img src={req.userThumb} alt={req.username} className="w-6 h-6 rounded-full shrink-0 border border-slate-700" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-violet-900/60 border border-violet-700/60 flex items-center justify-center text-violet-300 font-bold text-[10px] shrink-0">
                          {req.username ? req.username.substring(0, 2).toUpperCase() : 'U'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-xs">{req.username}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{formatDate(req.createdAt)}</span>
                        </div>
                        {req.reason && (
                          <div className="text-[11px] text-slate-400 italic truncate" title={req.reason}>
                            "{req.reason}"
                          </div>
                        )}
                      </div>
                    </div>
                    {(isAdmin || req.userId === user?.id || (user?.username && req.username.toLowerCase() === user.username.toLowerCase())) && (
                      <button
                        onClick={() => removeProtectionRequest(currentItem.id)}
                        className="text-[11px] text-slate-400 hover:text-red-400 transition px-2 py-0.5 rounded border border-transparent hover:border-slate-800 shrink-0"
                        title="Remove request"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">No users have asked to protect this item yet.</p>
            )}

            {/* Action for Guest or User: Ask to Protect */}
            {myRequest ? (
              <div className="p-2.5 bg-violet-950/20 border border-violet-800/30 rounded-lg flex items-center justify-between text-xs text-violet-300">
                <span>You requested protection for this item.</span>
                <button
                  onClick={() => removeProtectionRequest(currentItem.id)}
                  className="text-xs text-slate-400 hover:text-red-400 underline transition"
                >
                  Cancel My Request
                </button>
              </div>
            ) : isRequesting ? (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="Reason for requesting protection (optional)..."
                  value={guestReason}
                  onChange={(e) => setGuestReason(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-violet-500"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRequestProtection}
                    disabled={isSubmitting}
                    className="px-3 py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button
                    onClick={() => setIsRequesting(false)}
                    className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsRequesting(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 transition flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                Ask to Protect This Item
              </button>
            )}
          </div>

          {/* Arr Instances & Files */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Connected Instances ({currentItem.instances.length})
            </h3>
            <div className="space-y-2">
              {currentItem.instances.map((inst) => (
                <div
                  key={inst.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {getInstanceTitle(inst, isSeries)}
                      </span>
                      {inst.resolution ? (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getBadgeStyle(inst.resolution, false)}`}
                        >
                          {inst.resolution}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800/40 text-slate-400 border border-dashed border-slate-700">
                          Missing File
                        </span>
                      )}
                      {inst.cutoffUnmet ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Cutoff Unmet
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Cutoff Met
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-slate-300">{formatSize(inst.sizeBytes)}</div>
                      {!isGuest && (
                        <button
                          onClick={() => onUpgradeQuality?.(currentItem, inst.id)}
                          title="Upgrade quality profile & search"
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 hover:border-sky-500/50 transition flex items-center gap-1.5"
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          <span>Upgrade</span>
                        </button>
                      )}
                      {!isGuest && (
                        <button
                          onClick={() => onPrune(currentItem, undefined, [inst.connectionId])}
                          disabled={currentItem.isProtected}
                          title={currentItem.isProtected ? 'Item is protected' : `Prune only this ${inst.resolution || ''} copy`}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 hover:border-red-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Prune Copy</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5 truncate" title={inst.diskPath || 'No disk path recorded'}>
                      <Folder className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{inst.diskPath || 'No path available'}</span>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end flex-wrap">
                      <span>Profile: <b className="text-sky-300 font-medium">{inst.qualityProfileName || 'Default'}</b></span>
                      <span>Monitored: <b className={inst.isMonitored ? 'text-emerald-400' : 'text-slate-500'}>{inst.isMonitored ? 'Yes' : 'No'}</b></span>
                      <span>Has File: <b className={inst.hasFile ? 'text-emerald-400' : 'text-slate-500'}>{inst.hasFile ? 'Yes' : 'No'}</b></span>
                      <span>External ID: <b className="font-mono text-slate-300">{inst.externalId}</b></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TV Seasons Breakdown (If Series) */}
          {isSeries && currentItem.seasons.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-sky-400" />
                Seasons & Episodes ({currentItem.seasons.length} Seasons)
              </h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-medium">
                      <th className="p-2.5">Season</th>
                      <th className="p-2.5">Episodes</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Size</th>
                      {!isGuest && <th className="p-2.5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {currentItem.seasons.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-2.5 font-semibold text-white">
                          {s.seasonNumber === 0 ? 'Specials (Season 0)' : `Season ${s.seasonNumber}`}
                        </td>
                        <td className="p-2.5 text-slate-300 font-mono">
                          {s.episodeFileCount} / {s.episodeCount} files on disk
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              s.isMonitored
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {s.isMonitored ? 'Monitored' : 'Unmonitored'}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-300">{formatSize(s.sizeBytes)}</td>
                        {!isGuest && (
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => onPrune(currentItem, s.seasonNumber)}
                              disabled={currentItem.isProtected}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition inline-flex items-center gap-1"
                              title={currentItem.isProtected ? 'Show is protected' : `Prune Season ${s.seasonNumber}`}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              Prune Season
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Watch Activity by User */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              Watch History ({currentItem.watchStats.length} user records)
            </h3>
            {currentItem.watchStats.length === 0 ? (
              <div className="space-y-2">
                <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl text-slate-500 text-center italic">
                  No recorded watch sessions from Tautulli or Plex.
                </div>
                {itemPredatesWatchHistory(currentItem) && (
                  <div
                    data-testid="detail-predates-tracking-alert"
                    className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2.5"
                  >
                    <History className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-white block">Pre-dates Watch History Tracking</span>
                      <span className="text-amber-200/80 text-[11px] block mt-0.5">
                        {currentItem.addedAt
                          ? `This title was added to your library in ${formatDate(currentItem.addedAt)}, before Tautulli watch history tracking began in July 2017.`
                          : 'This title predates Tautulli watch history tracking (began July 2017).'} It may have been watched without an active logging session.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-medium">
                      <th className="p-2.5">User</th>
                      {isSeries && <th className="p-2.5">Season</th>}
                      <th className="p-2.5">Plays</th>
                      <th className="p-2.5">Last Watched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {currentItem.watchStats.map((ws) => (
                      <tr key={ws.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-2.5 font-semibold text-slate-200">
                          {ws.username || ws.userId}
                        </td>
                        {isSeries && (
                          <td className="p-2.5 text-slate-400">
                            {ws.seasonNumber !== null && ws.seasonNumber !== undefined
                              ? `Season ${ws.seasonNumber}`
                              : 'All / Overall'}
                          </td>
                        )}
                        <td className="p-2.5 font-mono text-emerald-400 font-bold">{ws.playCount}</td>
                        <td className="p-2.5 text-slate-400">{formatDate(ws.lastPlayedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Admin Deletion Protection Whitelist Management */}
          {!isGuest && (
            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={`w-4 h-4 ${currentItem.isProtected ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="font-semibold text-white">Admin Deletion Protection</span>
                </div>
                <button
                  onClick={() => {
                    if (currentItem.isProtected) {
                      onToggleProtect(currentItem.id, false);
                    } else {
                      setIsEditingReason(true);
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
                    currentItem.isProtected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {currentItem.isProtected ? 'Protected (Click to Unprotect)' : 'Protect Item'}
                </button>
              </div>
              {currentItem.isProtected && currentItem.protectionReason && (
                <p className="text-[11px] text-slate-400 italic">
                  Reason: "{currentItem.protectionReason}"
                </p>
              )}
              {isEditingReason && !currentItem.isProtected && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Optional protection reason (e.g. Favorite, Archival)..."
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    className="flex-1 px-3 py-1 bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleSaveProtection}
                    className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                  >
                    Confirm Protect
                  </button>
                  <button
                    onClick={() => setIsEditingReason(false)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between gap-3">
          {!isGuest ? (
            <button
              onClick={() => onPrune(currentItem)}
              disabled={currentItem.isProtected}
              className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 hover:border-red-500/60 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold transition flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Prune Entire Item
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
