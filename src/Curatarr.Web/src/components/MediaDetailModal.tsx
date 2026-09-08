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
} from 'lucide-react';
import { MediaItem } from '../types/api';
import { getInstanceTitle, getBadgeStyle } from '../utils/badgeUtils';

interface MediaDetailModalProps {
  item: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleProtect: (mediaItemId: string, isProtected: boolean, reason?: string) => void;
  onPrune: (item: MediaItem, seasonNumber?: number) => void;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onToggleProtect,
  onPrune,
}) => {
  const [isEditingReason, setIsEditingReason] = useState(false);
  const [reasonInput, setReasonInput] = useState(item?.protectionReason || '');

  if (!isOpen || !item) return null;

  const isSeries = item.mediaType === 1;
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

  const totalPlays = item.watchStats.reduce((sum, w) => sum + w.playCount, 0);
  const lastPlayed = item.watchStats
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
    onToggleProtect(item.id, !item.isProtected, reasonInput || undefined);
    setIsEditingReason(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-fade-in overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-16 h-24 sm:w-20 sm:h-28 shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shadow-md">
              {item.posterUrl ? (
                <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
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
                {item.year && (
                  <span className="text-xs text-slate-400 font-mono">({item.year})</span>
                )}
                {item.isProtected && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Protected
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight truncate" title={item.title}>
                {item.title}
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
          {/* Quick External Links Bar */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
            <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              External Metadata:
            </span>
            {item.tmdbId && (
              <a
                href={isSeries ? `https://www.themoviedb.org/tv/${item.tmdbId}` : `https://www.themoviedb.org/movie/${item.tmdbId}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-sky-500 text-sky-300 hover:text-sky-200 transition font-mono"
              >
                TMDB: {item.tmdbId}
              </a>
            )}
            {item.tvdbId && (
              <a
                href={`https://thetvdb.com/dereferrer/series/${item.tvdbId}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-sky-500 text-sky-300 hover:text-sky-200 transition font-mono"
              >
                TVDB: {item.tvdbId}
              </a>
            )}
            {item.imdbId && (
              <a
                href={`https://www.imdb.com/title/${item.imdbId}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-amber-500 text-amber-300 hover:text-amber-200 transition font-mono"
              >
                IMDB: {item.imdbId}
              </a>
            )}
            {item.plexRatingKey && (
              <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-purple-300 font-mono">
                Plex ID: {item.plexRatingKey}
              </span>
            )}
            {!item.tmdbId && !item.tvdbId && !item.imdbId && !item.plexRatingKey && (
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
              <div className="font-mono text-sm font-bold text-white">{formatSize(item.totalSizeBytes)}</div>
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
              <div className="font-medium text-xs text-white truncate">{formatDate(item.addedAt)}</div>
            </div>
          </div>

          {/* Arr Instances & Files */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Connected Instances ({item.instances.length})
            </h3>
            <div className="space-y-2">
              {item.instances.map((inst) => (
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
                    <div className="font-mono text-slate-300">{formatSize(inst.sizeBytes)}</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5 truncate" title={inst.diskPath || 'No disk path recorded'}>
                      <Folder className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{inst.diskPath || 'No path available'}</span>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end">
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
          {isSeries && item.seasons.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-sky-400" />
                Seasons & Episodes ({item.seasons.length} Seasons)
              </h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-medium">
                      <th className="p-2.5">Season</th>
                      <th className="p-2.5">Episodes</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Size</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {item.seasons.map((s) => (
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
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => onPrune(item, s.seasonNumber)}
                            disabled={item.isProtected}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition inline-flex items-center gap-1"
                            title={item.isProtected ? 'Show is protected' : `Prune Season ${s.seasonNumber}`}
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            Prune Season
                          </button>
                        </td>
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
              Watch History ({item.watchStats.length} user records)
            </h3>
            {item.watchStats.length === 0 ? (
              <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl text-slate-500 text-center italic">
                No recorded watch sessions from Tautulli or Plex.
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
                    {item.watchStats.map((ws) => (
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

          {/* Protection Whitelist Management */}
          <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className={`w-4 h-4 ${item.isProtected ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span className="font-semibold text-white">Deletion Protection</span>
              </div>
              <button
                onClick={() => {
                  if (item.isProtected) {
                    onToggleProtect(item.id, false);
                  } else {
                    setIsEditingReason(true);
                  }
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
                  item.isProtected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {item.isProtected ? 'Protected (Click to Unprotect)' : 'Protect Item'}
              </button>
            </div>
            {item.isProtected && item.protectionReason && (
              <p className="text-[11px] text-slate-400 italic">
                Reason: "{item.protectionReason}"
              </p>
            )}
            {isEditingReason && !item.isProtected && (
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
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between gap-3">
          <button
            onClick={() => onPrune(item)}
            disabled={item.isProtected}
            className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 hover:border-red-500/60 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold transition flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Prune Entire Item
          </button>
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
