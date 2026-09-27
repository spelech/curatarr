import React from 'react';
import {
  X,
  HelpCircle,
  Clock,
  AlertTriangle,
  HardDrive,
  Tv,
  Film,
  FileQuestion,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import { useSettingsStore, DEFAULT_SETTINGS } from '../stores/useSettingsStore';
 
interface CategoryCriteriaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CategoryCriteriaModal: React.FC<CategoryCriteriaModalProps> = ({
  isOpen,
  onClose,
}) => {
  const settings = useSettingsStore((s) => s.settings);

  if (!isOpen) return null;

  const formatGb = (bytes?: number) => {
    if (!bytes) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const neverWatchedDays = settings?.neverWatchedMinAgeDays ?? DEFAULT_SETTINGS.neverWatchedMinAgeDays;
  const staleDays = settings?.staleDays ?? DEFAULT_SETTINGS.staleDays;
  const abandonedDays = settings?.abandonedDays ?? DEFAULT_SETTINGS.abandonedDays;
  const movieHdGb = formatGb(settings?.movieSpaceHogThresholdBytes ?? DEFAULT_SETTINGS.movieSpaceHogThresholdBytes);
  const movie4kGb = formatGb(settings?.movie4kSpaceHogThresholdBytes ?? DEFAULT_SETTINGS.movie4kSpaceHogThresholdBytes);
  const seriesEpGb = formatGb(settings?.seriesEpisodeSpaceHogThresholdBytes ?? DEFAULT_SETTINGS.seriesEpisodeSpaceHogThresholdBytes);
  const sub720pYear = settings?.sub720pCutoffYear ?? DEFAULT_SETTINGS.sub720pCutoffYear ?? 2000;

  const categories = [
    {
      id: 'never_watched',
      name: 'Never Watched',
      icon: Clock,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      rule: 'Items with 0 total playback records across all tracked Plex/Tautulli users.',
      threshold: `Added to library at least ${neverWatchedDays} days ago (items newer than this grace period are ignored).`,
    },
    {
      id: 'stale',
      name: 'Stale Media',
      icon: Clock,
      color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      rule: 'Media that was previously watched, but has had zero playback activity for an extended time.',
      threshold: `Last played by any user more than ${staleDays} days ago.`,
    },
    {
      id: 'abandoned',
      name: 'Abandoned TV',
      icon: Tv,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      rule: 'TV series where someone started watching (at least 1 episode played), but stopped mid-series.',
      threshold: `No episodes played in over ${abandonedDays} days, with unplayed episodes remaining.`,
    },
    {
      id: 'sub_720p',
      name: 'Sub-720p (SD)',
      icon: Film,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      rule: 'Titles containing at least one sub-720p (SD / 480p) file on disk, prime for quality upgrade or removal.',
      threshold: sub720pYear > 0
        ? `Released in or after ${sub720pYear} (pre-${sub720pYear} titles often only exist in SD).`
        : 'All release years included (year cutoff disabled).',
    },
    {
      id: 'cutoff_unmet',
      name: 'Cutoff Unmet',
      icon: AlertTriangle,
      color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      rule: 'Media that is currently on disk, but has not reached the desired Quality Profile Cutoff in Radarr or Sonarr.',
      threshold: 'Flagged when the downloaded file quality is lower than your configured Arr cutoff profile.',
    },
    {
      id: 'space_hogs',
      name: 'Space Hogs',
      icon: HardDrive,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      rule: 'Oversized titles consuming disproportionately large amounts of storage space on your filesystem.',
      threshold: `HD Movies > ${movieHdGb}, 4K Movies > ${movie4kGb}, or TV Shows averaging > ${seriesEpGb} per episode on disk.`,
    },
    {
      id: 'missing',
      name: 'Missing / Stalled',
      icon: FileQuestion,
      color: 'text-slate-400 bg-slate-800/40 border-slate-700',
      rule: 'Monitored entries in Sonarr or Radarr that currently have no files present on disk.',
      threshold: 'Useful for cleaning up stale metadata or dead indexer downloads.',
    },
    {
      id: 'protection_requested',
      name: 'Protection Requests',
      icon: ShieldAlert,
      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
      rule: 'Items where shared library users or guests have clicked "Ask to Protect" to request preservation.',
      threshold: 'Awaiting administrator review in the Protection Requests queue.',
    },
    {
      id: 'protected',
      name: 'Protected',
      icon: Shield,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      rule: 'Media manually whitelisted or protected from deletion by an administrator.',
      threshold: 'Completely exempt and hidden from batch deletion actions.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Smart Category Rules & Thresholds
              </h2>
              <p className="text-[11px] text-slate-400">
                Curatarr automatically categorizes your library using live rules and thresholds.
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
          {categories.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.id}
                className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1.5 hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border ${c.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-white">{c.name}</span>
                </div>
                <p className="text-slate-300 text-[11px] pl-7">{c.rule}</p>
                <div className="pl-7 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-400">Threshold:</span>
                  <span className="text-slate-300 font-mono">{c.threshold}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>Thresholds can be customized in Settings &rarr; Thresholds.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
