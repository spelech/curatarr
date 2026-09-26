import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  X,
  ArrowUpCircle,
  Search,
  Layers,
  Loader2,
  Film,
  Tv,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { MediaItem, QualityProfile } from '../types/api';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useConnectionStore } from '../stores/useConnectionStore';
import { useToastStore } from '../stores/useToastStore';

interface QualityUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediaItem | null;
  initialInstanceId?: string;
}

export const QualityUpgradeModal: React.FC<QualityUpgradeModalProps> = ({
  isOpen,
  onClose,
  item,
  initialInstanceId,
}) => {
  const connections = useConnectionStore((s) => s.connections);
  const fetchQualityProfiles = useCatalogStore((s) => s.fetchQualityProfiles);
  const upgradeQuality = useCatalogStore((s) => s.upgradeQuality);
  const addToast = useToastStore((s) => s.addToast);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [profiles, setProfiles] = useState<QualityProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [triggerSearch, setTriggerSearch] = useState<boolean>(true);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter to valid Arr instances
  const arrInstances = useMemo(() => {
    if (!item?.instances) return [];
    return item.instances.filter((inst) => {
      const conn = connections.find((c) => c.id === inst.connectionId);
      if (!conn) return true;
      // 0: Sonarr, 1: Radarr
      return conn.connectionType === 0 || conn.connectionType === 1;
    });
  }, [item, connections]);

  // Determine default instance: initialInstanceId or SD/sub-720p instance or first
  useEffect(() => {
    if (!isOpen || arrInstances.length === 0) {
      setSelectedInstanceId('');
      return;
    }

    if (initialInstanceId && arrInstances.some((i) => i.id === initialInstanceId)) {
      setSelectedInstanceId(initialInstanceId);
      return;
    }

    // Prefer instance with SD resolution
    const sdInst = arrInstances.find((i) => i.resolution?.toUpperCase() === 'SD');
    if (sdInst) {
      setSelectedInstanceId(sdInst.id);
      return;
    }

    // Otherwise first instance
    setSelectedInstanceId(arrInstances[0].id);
  }, [isOpen, arrInstances, initialInstanceId]);

  const selectedInstance = useMemo(
    () => arrInstances.find((i) => i.id === selectedInstanceId) || arrInstances[0],
    [arrInstances, selectedInstanceId]
  );

  const loadProfiles = useCallback(async (connectionId: string, currentProfileName?: string) => {
    setIsLoadingProfiles(true);
    setError(null);
    try {
      const fetched = await fetchQualityProfiles(connectionId);
      setProfiles(fetched);
      if (fetched.length > 0) {
        // If current profile name matches one, pre-select or pick next
        const currentMatch = fetched.find(
          (p) => currentProfileName && p.name.toLowerCase() === currentProfileName.toLowerCase()
        );
        if (currentMatch) {
          // Pre-select current profile
          setSelectedProfileId(currentMatch.id);
        } else {
          // Pre-select first HD or 1080p profile, or first available
          const hdProfile = fetched.find((p) =>
            /1080|hd|720/i.test(p.name)
          );
          setSelectedProfileId(hdProfile ? hdProfile.id : fetched[0].id);
        }
      } else {
        setSelectedProfileId(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load quality profiles');
    } finally {
      setIsLoadingProfiles(false);
    }
  }, [fetchQualityProfiles]);

  // Fetch quality profiles whenever selected instance changes
  useEffect(() => {
    if (!isOpen || !selectedInstance) return;
    loadProfiles(selectedInstance.connectionId, selectedInstance.qualityProfileName);
  }, [isOpen, selectedInstance, loadProfiles]);

  if (!isOpen || !item) return null;

  const isSeries = item.mediaType === 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstance || selectedProfileId === null) return;

    setIsSubmitting(true);
    setError(null);

    const result = await upgradeQuality(item.id, {
      connectionId: selectedInstance.connectionId,
      qualityProfileId: selectedProfileId,
      triggerSearch,
    });

    setIsSubmitting(false);

    if (result.success) {
      addToast({ type: 'success', title: result.message });
      onClose();
    } else {
      setError(result.message || 'Failed to upgrade quality profile');
    }
  };

  const getConnName = (connectionId: string) => {
    const conn = connections.find((c) => c.id === connectionId);
    return conn?.name || (isSeries ? 'Sonarr' : 'Radarr');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quality-upgrade-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="quality-upgrade-title" className="text-sm font-bold text-white">
                Upgrade Quality Profile
              </h2>
              <p className="text-[11px] text-slate-400">
                Change Arr target profile and initiate automatic indexer search
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Item Summary Card */}
          <div className="flex items-center gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            {item.posterUrl ? (
              <img
                src={item.posterUrl}
                alt={item.title}
                className="w-12 h-16 object-cover rounded-lg border border-slate-800 shrink-0"
              />
            ) : (
              <div className="w-12 h-16 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center shrink-0 text-slate-600">
                {isSeries ? <Tv className="w-6 h-6" /> : <Film className="w-6 h-6" />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                <span>{isSeries ? 'Series' : 'Movie'}</span>
                {item.year && <span>• {item.year}</span>}
              </div>
              <h3 className="font-semibold text-white truncate text-sm" title={item.title}>
                {item.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {selectedInstance?.resolution && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Current: {selectedInstance.resolution}
                  </span>
                )}
                <span className="text-[10px] text-slate-400">
                  Profile: <b className="text-sky-300 font-medium">{selectedInstance?.qualityProfileName || 'Unknown'}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Instance Selection (if multiple instances exist) */}
          {arrInstances.length > 1 && (
            <div className="space-y-1.5">
              <label htmlFor="instance-select" className="text-slate-300 font-medium flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Target Arr Instance
              </label>
              <select
                id="instance-select"
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-sky-500 transition"
              >
                {arrInstances.map((inst) => {
                  const connName = getConnName(inst.connectionId);
                  const res = inst.resolution ? ` (${inst.resolution})` : '';
                  const prof = inst.qualityProfileName ? ` - Profile: ${inst.qualityProfileName}` : '';
                  return (
                    <option key={inst.id} value={inst.id}>
                      {connName}{res}{prof}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Target Quality Profile Selector */}
          <div className="space-y-1.5">
            <label htmlFor="quality-profile-select" className="text-slate-300 font-medium flex items-center justify-between">
              <span>New Quality Profile</span>
              {isLoadingProfiles && (
                <span className="text-[11px] text-sky-400 flex items-center gap-1 font-normal">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Fetching profiles from {getConnName(selectedInstance?.connectionId || '')}...
                </span>
              )}
            </label>

            {isLoadingProfiles ? (
              <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-500 text-xs flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading available quality profiles...</span>
              </div>
            ) : profiles.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  No quality profiles could be retrieved from {getConnName(selectedInstance?.connectionId || '')}.
                  Please ensure the Arr instance is connected and reachable in Settings.
                </div>
              </div>
            ) : (
              <select
                id="quality-profile-select"
                value={selectedProfileId ?? ''}
                onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-sky-500 transition"
              >
                {profiles.map((p) => {
                  const isCurrent =
                    selectedInstance?.qualityProfileName &&
                    p.name.toLowerCase() === selectedInstance.qualityProfileName.toLowerCase();
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} {isCurrent ? '(Current)' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Automatic Search Checkbox */}
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={triggerSearch}
                onChange={(e) => setTriggerSearch(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-950 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-sky-400" />
                  Trigger automatic search immediately
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ensures the item is monitored and instructs {getConnName(selectedInstance?.connectionId || '')} to immediately search indexers for an upgraded release.
                </p>
              </div>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingProfiles || selectedProfileId === null}
              className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium transition text-xs flex items-center gap-1.5 shadow-lg shadow-sky-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  {triggerSearch ? (
                    <Search className="w-3.5 h-3.5" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{triggerSearch ? 'Upgrade & Search' : 'Update Profile'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
