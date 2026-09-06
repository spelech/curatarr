import React, { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import { AuditLogEntry } from '../types/api';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [totalFreed, setTotalFreed] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch('/api/v1/audit?limit=100')
        .then((res) => res.json())
        .then((data) => {
          setLogs(data.logs || []);
          setTotalFreed(data.totalBytesFreed || 0);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toFixed(1)} GB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-fade-in max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Forensic Audit Log</h2>
              <p className="text-xs text-slate-400">Record of media deleted from disk drives</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reclaimed Counter */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs">
          <span className="text-slate-300">Lifetime Disk Space Reclaimed:</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">{formatSize(totalFreed)}</span>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin text-xs">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading audit history...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-500">
              No deletions recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{log.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {log.mediaType} {log.seasonNumber !== null && log.seasonNumber !== undefined ? `(S${log.seasonNumber})` : ''}
                      </span>
                      {log.addedToImportExclusion && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                          Exclusion Added
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">{log.details}</div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(log.executedAt).toLocaleString()} • Actor: {log.actor}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-semibold text-emerald-400">
                      +{formatSize(log.bytesFreed)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
