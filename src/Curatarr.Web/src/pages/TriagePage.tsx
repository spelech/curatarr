import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Film,
  Tv,
  Search,
  HardDrive,
  Users,
  Eye,
} from 'lucide-react';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useToastStore } from '../stores/useToastStore';
import { MediaItem } from '../types/api';

interface TriagePageProps {
  onOpenDetail?: (item: MediaItem) => void;
}

export const TriagePage: React.FC<TriagePageProps> = ({ onOpenDetail }) => {
  const pendingRequests = useCatalogStore((s) => s.pendingProtectionRequests);
  const approveProtection = useCatalogStore((s) => s.approveProtectionRequest);
  const dismissProtection = useCatalogStore((s) => s.dismissProtectionRequest);
  const fetchItemById = useCatalogStore((s) => s.fetchItemById);
  const addToast = useToastStore((s) => s.addToast);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'movie' | 'series'>('all');

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const totalBytesAtRisk = useMemo(() => {
    return pendingRequests.reduce((sum, r) => sum + (r.totalSizeBytes || 0), 0);
  }, [pendingRequests]);

  const uniqueRequesters = useMemo(() => {
    const set = new Set(pendingRequests.map((r) => r.username));
    return set.size;
  }, [pendingRequests]);

  const filteredRequests = useMemo(() => {
    return pendingRequests.filter((req) => {
      if (mediaTypeFilter === 'movie' && req.mediaType !== 0) return false;
      if (mediaTypeFilter === 'series' && req.mediaType !== 1) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = req.title.toLowerCase().includes(q);
        const matchesUser = req.username.toLowerCase().includes(q);
        const matchesReason = (req.reason || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesUser && !matchesReason) return false;
      }
      return true;
    });
  }, [pendingRequests, searchQuery, mediaTypeFilter]);

  const handleApprove = async (mediaItemId: string, title: string, reason?: string) => {
    setProcessingId(mediaItemId);
    const ok = await approveProtection(mediaItemId, reason);
    setProcessingId(null);
    if (ok) {
      addToast({ type: 'success', title: `Protected "${title}" and resolved request` });
    } else {
      addToast({ type: 'error', title: `Failed to protect "${title}"` });
    }
  };

  const handleDismiss = async (mediaItemId: string, title: string) => {
    setProcessingId(mediaItemId);
    const ok = await dismissProtection(mediaItemId);
    setProcessingId(null);
    if (ok) {
      addToast({ type: 'info', title: `Dismissed request for "${title}"` });
    } else {
      addToast({ type: 'error', title: `Failed to dismiss request for "${title}"` });
    }
  };

  const handleItemClick = async (mediaItemId: string) => {
    if (!onOpenDetail) return;
    const item = await fetchItemById(mediaItemId);
    if (item) {
      onOpenDetail(item);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Hero */}
      <div className="bg-[#070c09] border border-[#14231a] rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Protection Triage
                </h1>
                {pendingRequests.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                    {pendingRequests.length} Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Review and approve library protection requests from Overseerr users and Plex guests before scheduled pruning cycles.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pending</span>
              </div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {pendingRequests.length}
              </div>
            </div>

            <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Storage at Risk</span>
              </div>
              <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                {formatSize(totalBytesAtRisk)}
              </div>
            </div>

            <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3.5 py-2.5 col-span-2 sm:col-span-1">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Requesters</span>
              </div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {uniqueRequesters}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#070c09] border border-[#14231a] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, requester, or reason..."
            aria-label="Search protection requests"
            className="w-full pl-9 pr-3 py-1.5 min-h-[30px] bg-[#040705] border border-[#14231a] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs transition"
          />
        </div>

        <div className="flex items-center bg-[#040705] border border-[#14231a] rounded-lg p-0.5">
          <button
            onClick={() => setMediaTypeFilter('all')}
            className={`px-3 py-1 min-h-[28px] rounded-md font-medium transition ${
              mediaTypeFilter === 'all'
                ? 'bg-emerald-500 text-black font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Types
          </button>
          <button
            onClick={() => setMediaTypeFilter('movie')}
            className={`px-3 py-1 min-h-[28px] rounded-md font-medium flex items-center gap-1 transition ${
              mediaTypeFilter === 'movie'
                ? 'bg-emerald-500 text-black font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-3 h-3" />
            Movies
          </button>
          <button
            onClick={() => setMediaTypeFilter('series')}
            className={`px-3 py-1 min-h-[28px] rounded-md font-medium flex items-center gap-1 transition ${
              mediaTypeFilter === 'series'
                ? 'bg-emerald-500 text-black font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Tv className="w-3 h-3" />
            Series
          </button>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="border border-dashed border-[#17261e] rounded-2xl p-16 text-center bg-[#070c09]/40">
          <CheckCircle2 className="w-12 h-12 text-emerald-500/80 mx-auto mb-3" />
          <h2 className="text-base font-bold text-white">
            {pendingRequests.length === 0 ? 'Inbox Zero: All Caught Up!' : 'No Matching Requests'}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            {pendingRequests.length === 0
              ? 'There are no pending protection requests from users. All library items are governed by active retention criteria.'
              : 'No pending requests matched your active search query or filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className="p-4 bg-[#070c09] border border-[#14231a] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-emerald-500/30 transition shadow-sm"
            >
              {/* Media Thumbnail & Meta */}
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div
                  onClick={() => handleItemClick(req.mediaItemId)}
                  className="w-14 h-20 rounded-lg bg-[#040705] border border-[#17261e] overflow-hidden shrink-0 cursor-pointer flex items-center justify-center text-slate-500 hover:border-emerald-500/60 transition group"
                  title="Click to view details"
                >
                  {req.posterUrl ? (
                    <img
                      src={req.posterUrl}
                      alt={req.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                      loading="lazy"
                    />
                  ) : req.mediaType === 1 ? (
                    <Tv className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <Film className="w-6 h-6 text-emerald-400" />
                  )}
                </div>

                <div className="min-w-0 space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      onClick={() => handleItemClick(req.mediaItemId)}
                      className="font-bold text-white text-sm hover:text-emerald-400 cursor-pointer transition truncate"
                      title={req.title}
                    >
                      {req.title}
                    </span>
                    {req.year && (
                      <span className="text-xs text-slate-400 font-mono">({req.year})</span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0b130e] text-emerald-400 border border-emerald-900/40">
                      {req.mediaType === 1 ? 'Series' : 'Movie'}
                    </span>
                    <span className="font-mono text-xs text-emerald-400 font-semibold">
                      {formatSize(req.totalSizeBytes)}
                    </span>
                  </div>

                  {/* Requester Info */}
                  <div className="flex items-center gap-2.5 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      {req.userThumb ? (
                        <img
                          src={req.userThumb}
                          alt={req.username}
                          className="w-4 h-4 rounded-full border border-[#17261e] shrink-0"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center text-[9px] font-bold shrink-0 border border-emerald-900/40">
                          {req.username.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="text-slate-300 font-medium">{req.username}</span>
                    </div>
                    <span>•</span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      Requested {formatDate(req.createdAt)}
                    </span>
                  </div>

                  {/* User Justification / Reason */}
                  {req.reason && (
                    <div className="text-xs text-emerald-200/90 bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-3 py-1.5 italic max-w-2xl">
                      "{req.reason}"
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  onClick={() => handleItemClick(req.mediaItemId)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#0f1a14] border border-[#17261e] transition min-h-[32px]"
                  title="Inspect media details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDismiss(req.mediaItemId, req.title)}
                  disabled={processingId === req.mediaItemId}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-[#17261e] hover:border-rose-500/30 disabled:opacity-40 transition min-h-[32px]"
                  title="Dismiss request without protecting"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleApprove(req.mediaItemId, req.title, req.reason)}
                  disabled={processingId === req.mediaItemId}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/60 disabled:opacity-40 transition flex items-center gap-1.5 min-h-[32px] shadow-sm"
                  title="Approve request and protect this item"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Approve & Protect</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
