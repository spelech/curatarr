import React, { useEffect, useState, useMemo } from 'react';
import {
  History,
  HardDrive,
  Trash2,
  ShieldCheck,
  Search,
  RefreshCw,
  Film,
  Tv,
} from 'lucide-react';
import { AuditLogEntry } from '../types/api';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [totalFreed, setTotalFreed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'Movie' | 'Series'>('all');

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/audit?limit=250');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalFreed(data.totalBytesFreed || 0);
      }
    } catch {
      // Ignore network errors in mock/offline
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toFixed(1)} GB`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const exclusionCount = useMemo(() => {
    return logs.filter((l) => l.addedToImportExclusion).length;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (mediaTypeFilter !== 'all' && log.mediaType !== mediaTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = log.title.toLowerCase().includes(q);
        const matchesActor = log.actor.toLowerCase().includes(q);
        const matchesDetails = (log.details || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesActor && !matchesDetails) return false;
      }
      return true;
    });
  }, [logs, searchQuery, mediaTypeFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Hero */}
      <div className="bg-[#070c09] border border-[#14231a] rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Forensic Audit Log
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0b130e] text-emerald-400 border border-emerald-900/40 font-mono">
                  {logs.length} Entries
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Forensic immutable ledger recording disk space reclaimed, pruned files, and Arr import exclusion lists.
              </p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Space Reclaimed</span>
              </div>
              <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                {formatSize(totalFreed)}
              </div>
            </div>

            <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Deletions Recorded</span>
              </div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {logs.length}
              </div>
            </div>

            <div className="bg-[#040705] border border-[#14231a] rounded-xl px-3.5 py-2.5 col-span-2 sm:col-span-1">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exclusions Enforced</span>
              </div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {exclusionCount}
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
            placeholder="Search deleted titles, actors, or details..."
            aria-label="Search audit records"
            className="w-full pl-9 pr-3 py-1.5 min-h-[30px] bg-[#040705] border border-[#14231a] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs transition"
          />
        </div>

        <div className="flex items-center gap-2">
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
              onClick={() => setMediaTypeFilter('Movie')}
              className={`px-3 py-1 min-h-[28px] rounded-md font-medium flex items-center gap-1 transition ${
                mediaTypeFilter === 'Movie'
                  ? 'bg-emerald-500 text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film className="w-3 h-3" />
              Movies
            </button>
            <button
              onClick={() => setMediaTypeFilter('Series')}
              className={`px-3 py-1 min-h-[28px] rounded-md font-medium flex items-center gap-1 transition ${
                mediaTypeFilter === 'Series'
                  ? 'bg-emerald-500 text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-3 h-3" />
              Series
            </button>
          </div>

          <button
            onClick={() => fetchAuditLogs()}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-[#040705] hover:bg-[#0f1a14] border border-[#14231a] text-slate-400 hover:text-emerald-400 transition disabled:opacity-50 min-h-[28px]"
            title="Refresh audit logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Table / Cards */}
      {isLoading ? (
        <div className="border border-dashed border-[#17261e] rounded-2xl p-16 text-center text-slate-400 text-xs bg-[#070c09]/40">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading forensic audit ledger...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="border border-dashed border-[#17261e] rounded-2xl p-16 text-center bg-[#070c09]/40">
          <History className="w-12 h-12 text-[#1c3327] mx-auto mb-3" />
          <h2 className="text-base font-bold text-white">
            {logs.length === 0 ? 'No Deletions Recorded Yet' : 'No Matching Audit Logs'}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            {logs.length === 0
              ? 'When items or seasons are pruned from disk via Curatarr, the forensic audit history will appear here.'
              : 'No log entries matched your active search query or filter.'}
          </p>
        </div>
      ) : (
        <div className="border border-[#17261e] rounded-xl overflow-hidden bg-[#070c09]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#050806] border-b border-[#14231a] text-slate-400 font-semibold h-10">
                <tr>
                  <th className="p-3">Title & Media</th>
                  <th className="p-3">Trigger / Actor</th>
                  <th className="p-3">Details & Path</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-right">Freed Space</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14231a]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#0b130e]/60 transition">
                    <td className="p-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-xs">{log.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#040705] border border-[#17261e] text-slate-400">
                          {log.mediaType}
                          {log.seasonNumber !== null && log.seasonNumber !== undefined
                            ? ` (S${log.seasonNumber})`
                            : ''}
                        </span>
                        {log.addedToImportExclusion && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            title="Title added to Radarr/Sonarr import exclusion list to prevent re-download"
                          >
                            Exclusion List
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-[#040705] border border-[#17261e] text-slate-400 font-mono text-[11px]">
                        {log.actor}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 max-w-md truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDate(log.executedAt)}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-emerald-400">
                        +{formatSize(log.bytesFreed)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
