import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldOff,
  Shield,
  Film,
  Tv,
  Search,
  HardDrive,
  Clock,
  Eye,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useToastStore } from '../stores/useToastStore';
import { MediaItem } from '../types/api';

interface ProtectedItemsPageProps {
  onOpenDetail?: (item: MediaItem) => void;
}

export type ProtectionTab = 'all' | 'waiting' | 'protected';

export const ProtectedItemsPage: React.FC<ProtectedItemsPageProps> = ({ onOpenDetail }) => {
  const pendingRequests = useCatalogStore((s) => s.pendingProtectionRequests);
  const protectedItems = useCatalogStore((s) => s.protectedItems);
  const isLoadingProtected = useCatalogStore((s) => s.isLoadingProtected);
  const fetchPendingProtectionRequests = useCatalogStore((s) => s.fetchPendingProtectionRequests);
  const fetchProtectedItems = useCatalogStore((s) => s.fetchProtectedItems);
  const approveProtection = useCatalogStore((s) => s.approveProtectionRequest);
  const dismissProtection = useCatalogStore((s) => s.dismissProtectionRequest);
  const toggleProtect = useCatalogStore((s) => s.toggleProtect);
  const fetchItemById = useCatalogStore((s) => s.fetchItemById);
  const addToast = useToastStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<ProtectionTab>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'test') {
      if (pendingRequests.length === 0) {
        fetchPendingProtectionRequests();
      }
      if (protectedItems.length === 0) {
        fetchProtectedItems();
      }
    }
  }, [fetchPendingProtectionRequests, fetchProtectedItems, pendingRequests.length, protectedItems.length]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchPendingProtectionRequests(), fetchProtectedItems()]);
    setIsRefreshing(false);
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 GB';
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
      });
    } catch {
      return dateStr;
    }
  };

  const totalBytesAtRisk = useMemo(() => {
    return pendingRequests.reduce((sum, r) => sum + (r.totalSizeBytes || 0), 0);
  }, [pendingRequests]);

  const totalProtectedBytes = useMemo(() => {
    return protectedItems.reduce((sum, item) => sum + (item.totalSizeBytes || 0), 0);
  }, [protectedItems]);

  const filteredWaiting = useMemo(() => {
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

  const filteredProtected = useMemo(() => {
    return protectedItems.filter((item) => {
      if (mediaTypeFilter === 'movie' && item.mediaType !== 0) return false;
      if (mediaTypeFilter === 'series' && item.mediaType !== 1) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesUser = (item.requestedBy || '').toLowerCase().includes(q);
        const matchesReason = (item.protectionReason || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesUser && !matchesReason) return false;
      }
      return true;
    });
  }, [protectedItems, searchQuery, mediaTypeFilter]);

  const handleApprove = async (mediaItemId: string, title: string, reason?: string) => {
    setProcessingId(mediaItemId);
    const ok = await approveProtection(mediaItemId, reason);
    setProcessingId(null);
    if (ok) {
      addToast({ type: 'success', title: `Protected "${title}" and resolved request` });
      fetchProtectedItems();
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

  const handleUnprotect = async (mediaItemId: string, title: string) => {
    setProcessingId(mediaItemId);
    await toggleProtect(mediaItemId, false);
    setProcessingId(null);
    addToast({
      type: 'info',
      title: `Unprotected "${title}"`,
      message: 'Item removed from whitelist and subject to standard pruning rules.',
    });
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
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Protected Items
                </h1>
                {pendingRequests.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                    {pendingRequests.length} Waiting
                  </span>
                )}
                {protectedItems.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                    {protectedItems.length} Protected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Manage protected media whitelists immune to deletion and review pending protection requests from library users.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Waiting Review</span>
              </div>
              <div className="text-base font-bold text-amber-300 font-mono mt-0.5">
                {pendingRequests.length}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {formatSize(totalBytesAtRisk)} at risk
              </div>
            </div>

            <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Actively Protected</span>
              </div>
              <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                {protectedItems.length}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {formatSize(totalProtectedBytes)} guarded
              </div>
            </div>

            <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3.5 py-2.5 col-span-2 sm:col-span-1">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Total Monitored</span>
              </div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {pendingRequests.length + protectedItems.length}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {formatSize(totalBytesAtRisk + totalProtectedBytes)} total
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Sub-tab & Search Bar */}
      <div className="bg-[#070c09] border border-[#14231a] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#040705] border border-[#14231a] rounded-xl self-start md:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'all'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#0b130e]'
            }`}
          >
            <span>All Items</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'all' ? 'bg-black/20 text-black' : 'bg-[#14231a] text-slate-400'
              }`}
            >
              {pendingRequests.length + protectedItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('waiting')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'waiting'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#0b130e]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Waiting for Review</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'waiting'
                  ? 'bg-black/20 text-black'
                  : pendingRequests.length > 0
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-[#14231a] text-slate-400'
              }`}
            >
              {pendingRequests.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('protected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'protected'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#0b130e]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Actively Protected</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'protected' ? 'bg-black/20 text-black' : 'bg-[#14231a] text-slate-400'
              }`}
            >
              {protectedItems.length}
            </span>
          </button>
        </div>

        {/* Right side: Search, Media Type, Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, user, or reason..."
              className="w-full bg-[#040705] border border-[#14231a] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Media Type Filter */}
          <div className="flex items-center gap-1 bg-[#040705] border border-[#14231a] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMediaTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                mediaTypeFilter === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setMediaTypeFilter('movie')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                mediaTypeFilter === 'movie'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3 h-3" />
              <span>Movies</span>
            </button>
            <button
              type="button"
              onClick={() => setMediaTypeFilter('series')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                mediaTypeFilter === 'series'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="w-3 h-3" />
              <span>Series</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh protection data"
            aria-label="Refresh protection data"
            className="p-2 rounded-xl bg-[#040705] border border-[#14231a] text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30 transition cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-8">
          {/* Section: Waiting Items */}
          {(activeTab === 'all' || activeTab === 'waiting') && (
            <div className="space-y-3">
              {activeTab === 'all' && (
                <div className="flex items-center justify-between pb-1 border-b border-[#14231a]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-slate-200">
                      Waiting for Review
                    </h2>
                    <span className="text-xs font-mono text-slate-500">
                      ({filteredWaiting.length})
                    </span>
                  </div>
                </div>
              )}

              {filteredWaiting.length === 0 ? (
                activeTab === 'waiting' ? (
                  <div className="border border-dashed border-[#17261e] rounded-2xl p-12 text-center bg-[#070c09]/40">
                    <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2.5" />
                    <h3 className="text-sm font-semibold text-slate-200">Inbox Zero: All Caught Up!</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                      There are no pending protection requests waiting for review. All requests have been triaged.
                    </p>
                  </div>
                ) : null
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredWaiting.map((req) => (
                    <div
                      key={req.id}
                      className="bg-[#070c09] border border-[#14231a] hover:border-amber-500/30 rounded-2xl p-4 sm:p-5 transition shadow-sm flex flex-col justify-between gap-4 group"
                    >
                      {/* Top Row: Thumbnail + Info */}
                      <div className="flex items-start gap-3.5">
                        <div
                          onClick={() => handleItemClick(req.mediaItemId)}
                          className="w-14 sm:w-16 h-20 sm:h-24 rounded-xl object-cover bg-[#040705] border border-[#14231a] shrink-0 overflow-hidden cursor-pointer relative group/poster"
                        >
                          {req.posterUrl ? (
                            <img
                              src={req.posterUrl}
                              alt={req.title}
                              className="w-full h-full object-cover transition duration-300 group-hover/poster:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              {req.mediaType === 0 ? (
                                <Film className="w-6 h-6" />
                              ) : (
                                <Tv className="w-6 h-6" />
                              )}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition flex items-center justify-center text-emerald-300">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Waiting
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#040705] text-slate-400 border border-[#14231a]">
                              {req.mediaType === 0 ? 'Movie' : 'Series'}
                            </span>
                          </div>

                          <h3
                            onClick={() => handleItemClick(req.mediaItemId)}
                            className="text-sm font-semibold text-white truncate hover:text-emerald-300 transition cursor-pointer"
                            title={req.title}
                          >
                            {req.title}
                          </h3>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                            {req.year && <span>{req.year}</span>}
                            <span>•</span>
                            <span className="text-emerald-400">{formatSize(req.totalSizeBytes)}</span>
                          </div>

                          {/* Requester Info */}
                          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-300">
                            {req.userThumb ? (
                              <img
                                src={req.userThumb}
                                alt={req.username}
                                className="w-4 h-4 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[9px] font-bold">
                                {req.username[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-slate-200">{req.username}</span>
                            <span className="text-slate-500 text-[10px]">
                              {formatDate(req.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reason Quote */}
                      {req.reason && (
                        <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3 py-2 text-xs text-slate-300 italic">
                          <span className="text-slate-500 not-italic font-medium">Reason: </span>
                          "{req.reason}"
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1 border-t border-[#14231a]">
                        <button
                          type="button"
                          disabled={processingId === req.mediaItemId}
                          onClick={() => handleApprove(req.mediaItemId, req.title, req.reason)}
                          className="flex-1 px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Approve & Protect</span>
                        </button>

                        <button
                          type="button"
                          disabled={processingId === req.mediaItemId}
                          onClick={() => handleDismiss(req.mediaItemId, req.title)}
                          className="px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold bg-[#0b130e] hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 border border-[#14231a] hover:border-rose-900/40 flex items-center justify-center gap-1 transition disabled:opacity-50 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Dismiss</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleItemClick(req.mediaItemId)}
                          title="View Media Details"
                          className="p-2 min-h-[36px] min-w-[36px] rounded-xl bg-[#0b130e] hover:bg-[#14231a] text-slate-400 hover:text-white border border-[#14231a] flex items-center justify-center transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section: Actively Protected Items */}
          {(activeTab === 'all' || activeTab === 'protected') && (
            <div className="space-y-3">
              {activeTab === 'all' && (
                <div className="flex items-center justify-between pb-1 border-b border-[#14231a]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-semibold text-slate-200">
                      Actively Protected Whitelist
                    </h2>
                    <span className="text-xs font-mono text-slate-500">
                      ({filteredProtected.length})
                    </span>
                  </div>
                </div>
              )}

              {isLoadingProtected && protectedItems.length === 0 ? (
                <div className="border border-dashed border-[#17261e] rounded-2xl p-8 text-center text-slate-400 text-xs bg-[#070c09]/40">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading protected items...
                </div>
              ) : filteredProtected.length === 0 ? (
                activeTab === 'protected' ? (
                  <div className="border border-dashed border-[#17261e] rounded-2xl p-12 text-center bg-[#070c09]/40">
                    <Shield className="w-10 h-10 text-slate-600 mx-auto mb-2.5" />
                    <h3 className="text-sm font-semibold text-slate-200">No Protected Items Yet</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                      No movies or series are currently protected in your library. Protect items from the Library Curation view to whitelist them from pruning.
                    </p>
                  </div>
                ) : null
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProtected.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#070c09] border border-[#14231a] hover:border-emerald-500/30 rounded-2xl p-4 sm:p-5 transition shadow-sm flex flex-col justify-between gap-4 group"
                    >
                      {/* Top Row: Thumbnail + Info */}
                      <div className="flex items-start gap-3.5">
                        <div
                          onClick={() => handleItemClick(item.id)}
                          className="w-14 sm:w-16 h-20 sm:h-24 rounded-xl object-cover bg-[#040705] border border-[#14231a] shrink-0 overflow-hidden cursor-pointer relative group/poster"
                        >
                          {item.posterUrl ? (
                            <img
                              src={item.posterUrl}
                              alt={item.title}
                              className="w-full h-full object-cover transition duration-300 group-hover/poster:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              {item.mediaType === 0 ? (
                                <Film className="w-6 h-6" />
                              ) : (
                                <Tv className="w-6 h-6" />
                              )}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition flex items-center justify-center text-emerald-300">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              Protected
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#040705] text-slate-400 border border-[#14231a]">
                              {item.mediaType === 0 ? 'Movie' : 'Series'}
                            </span>
                          </div>

                          <h3
                            onClick={() => handleItemClick(item.id)}
                            className="text-sm font-semibold text-white truncate hover:text-emerald-300 transition cursor-pointer"
                            title={item.title}
                          >
                            {item.title}
                          </h3>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                            {item.year && <span>{item.year}</span>}
                            <span>•</span>
                            <span className="text-emerald-400">{formatSize(item.totalSizeBytes)}</span>
                          </div>

                          {item.requestedBy && (
                            <div className="text-[11px] text-slate-400 mt-2">
                              <span className="text-slate-500">Requested by: </span>
                              <span className="text-slate-300 font-medium">{item.requestedBy}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Protection Note */}
                      <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3 py-2 text-xs text-slate-300">
                        <span className="text-slate-500 font-medium">Protection Note: </span>
                        {item.protectionReason || 'Manual Whitelist (Immune to deletion)'}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1 border-t border-[#14231a]">
                        <button
                          type="button"
                          disabled={processingId === item.id}
                          onClick={() => handleUnprotect(item.id, item.title)}
                          className="flex-1 px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold bg-[#0b130e] hover:bg-rose-950/30 text-slate-300 hover:text-rose-300 border border-[#14231a] hover:border-rose-900/40 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                        >
                          <ShieldOff className="w-3.5 h-3.5 text-rose-400" />
                          <span>Unprotect</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleItemClick(item.id)}
                          title="View Media Details"
                          className="p-2 min-h-[36px] min-w-[36px] rounded-xl bg-[#0b130e] hover:bg-[#14231a] text-slate-400 hover:text-white border border-[#14231a] flex items-center justify-center transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state for 'all' when nothing matches */}
          {activeTab === 'all' && filteredWaiting.length === 0 && filteredProtected.length === 0 && (
            <div className="border border-dashed border-[#17261e] rounded-2xl p-16 text-center bg-[#070c09]/40">
              <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2.5" />
              <h3 className="text-sm font-semibold text-slate-200">Inbox Zero: All Caught Up!</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                There are no pending protection requests or protected items matching your filters.
              </p>
            </div>
          )}
        </div>
    </div>
  );
};
