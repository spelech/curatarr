import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Film,
  Tv,
} from 'lucide-react';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useToastStore } from '../stores/useToastStore';
import { MediaItem } from '../types/api';

interface ProtectionRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDetail?: (item: MediaItem) => void;
}

export const ProtectionRequestsModal: React.FC<ProtectionRequestsModalProps> = ({
  isOpen,
  onClose,
  onOpenDetail,
}) => {
  const pendingRequests = useCatalogStore((s) => s.pendingProtectionRequests);
  const approveProtection = useCatalogStore((s) => s.approveProtectionRequest);
  const dismissProtection = useCatalogStore((s) => s.dismissProtectionRequest);
  const fetchItemById = useCatalogStore((s) => s.fetchItemById);
  const addToast = useToastStore((s) => s.addToast);

  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!isOpen) return null;

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
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Pending Protection Requests
                </h2>
                {pendingRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-600/30 text-violet-300 border border-violet-500/30 font-mono">
                    {pendingRequests.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Shared users and guests requesting that items be protected from automatic or batch pruning.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin text-xs">
          {pendingRequests.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 opacity-80" />
              <h3 className="text-sm font-semibold text-white">All Caught Up!</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                There are no pending protection requests from users.
              </p>
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition"
              >
                {/* Left: Media metadata */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    onClick={() => handleItemClick(req.mediaItemId)}
                    className="w-12 h-16 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0 cursor-pointer flex items-center justify-center text-slate-500 hover:opacity-80 transition"
                  >
                    {req.posterUrl ? (
                      <img src={req.posterUrl} alt={req.title} className="w-full h-full object-cover" />
                    ) : req.mediaType === 1 ? (
                      <Tv className="w-5 h-5" />
                    ) : (
                      <Film className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        onClick={() => handleItemClick(req.mediaItemId)}
                        className="font-bold text-white text-xs hover:text-sky-300 cursor-pointer transition truncate"
                        title={req.title}
                      >
                        {req.title}
                      </span>
                      {req.year && <span className="text-[11px] text-slate-400 font-mono">({req.year})</span>}
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {req.mediaType === 1 ? 'Series' : 'Movie'}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {formatSize(req.totalSizeBytes)}
                      </span>
                    </div>

                    {/* Requester pill */}
                    <div className="flex items-center gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {req.userThumb ? (
                          <img src={req.userThumb} alt={req.username} className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-violet-900/80 text-violet-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                            {req.username.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="text-slate-300 font-medium">{req.username}</span>
                      </div>
                      <span className="text-slate-500 font-mono text-[10px]">{formatDate(req.createdAt)}</span>
                    </div>

                    {req.reason && (
                      <div className="text-[11px] text-violet-300/90 bg-violet-950/30 border border-violet-800/30 rounded px-2 py-0.5 italic">
                        "{req.reason}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleApprove(req.mediaItemId, req.title, req.reason)}
                    disabled={processingId === req.mediaItemId}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 disabled:opacity-40 transition flex items-center gap-1"
                    title="Approve request and protect this item"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Approve & Protect</span>
                  </button>
                  <button
                    onClick={() => handleDismiss(req.mediaItemId, req.title)}
                    disabled={processingId === req.mediaItemId}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 disabled:opacity-40 transition"
                    title="Dismiss request without protecting"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
