import React, { useEffect, useState } from 'react';
import { RotateCcw, Save, Loader2, CheckCircle2, Film, Tv, Clock, HardDrive } from 'lucide-react';
import { useSettingsStore, DEFAULT_SETTINGS } from '../stores/useSettingsStore';
import { useCatalogStore } from '../stores/useCatalogStore';

export const ThresholdSettingsTab: React.FC = () => {
  const { settings, isLoading, isSaving, error, fetchSettings, saveSettings } = useSettingsStore();
  const { fetchCategories, fetchItems } = useCatalogStore();

  const [movieSpaceHogGb, setMovieSpaceHogGb] = useState(DEFAULT_SETTINGS.movieSpaceHogGb);
  const [movie4kSpaceHogGb, setMovie4kSpaceHogGb] = useState(DEFAULT_SETTINGS.movie4kSpaceHogGb);
  const [seriesEpisodeSpaceHogGb, setSeriesEpisodeSpaceHogGb] = useState(DEFAULT_SETTINGS.seriesEpisodeSpaceHogGb);
  const [staleDays, setStaleDays] = useState(DEFAULT_SETTINGS.staleDays);
  const [abandonedDays, setAbandonedDays] = useState(DEFAULT_SETTINGS.abandonedDays);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setMovieSpaceHogGb(settings.movieSpaceHogGb);
      setMovie4kSpaceHogGb(settings.movie4kSpaceHogGb);
      setSeriesEpisodeSpaceHogGb(settings.seriesEpisodeSpaceHogGb);
      setStaleDays(settings.staleDays);
      setAbandonedDays(settings.abandonedDays);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);

    const ok = await saveSettings({
      movieSpaceHogThresholdBytes: Math.round(movieSpaceHogGb * 1024 * 1024 * 1024),
      movie4kSpaceHogThresholdBytes: Math.round(movie4kSpaceHogGb * 1024 * 1024 * 1024),
      seriesEpisodeSpaceHogThresholdBytes: Math.round(seriesEpisodeSpaceHogGb * 1024 * 1024 * 1024),
      staleDays,
      abandonedDays,
      movieSpaceHogGb,
      movie4kSpaceHogGb,
      seriesEpisodeSpaceHogGb,
    });

    if (ok) {
      setSaveSuccess(true);
      // Refresh catalog categories & items immediately
      await fetchCategories();
      await fetchItems();
      setTimeout(() => setSaveSuccess(false), 4000);
    }
  };

  const handleResetDefaults = () => {
    setMovieSpaceHogGb(DEFAULT_SETTINGS.movieSpaceHogGb);
    setMovie4kSpaceHogGb(DEFAULT_SETTINGS.movie4kSpaceHogGb);
    setSeriesEpisodeSpaceHogGb(DEFAULT_SETTINGS.seriesEpisodeSpaceHogGb);
    setStaleDays(DEFAULT_SETTINGS.staleDays);
    setAbandonedDays(DEFAULT_SETTINGS.abandonedDays);
  };

  if (isLoading && !settings) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-400 gap-2 text-xs">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading thresholds...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 text-xs">
      {/* Space Hogs Section */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold border-b border-slate-800 pb-2">
          <HardDrive className="w-4 h-4 text-purple-400" />
          <span>Space Hogs Thresholds</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Tune the size thresholds that determine which movies and TV series are flagged as storage consumers.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          {/* Series Per-Episode */}
          <div className="space-y-1 bg-slate-900/60 border border-slate-800 p-3 rounded-lg">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <Tv className="w-3.5 h-3.5 text-sky-400" />
              <span>Series (Per Episode)</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={seriesEpisodeSpaceHogGb}
                onChange={(e) => setSeriesEpisodeSpaceHogGb(parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-white font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] font-mono text-slate-400 shrink-0">GB / ep</span>
            </div>
            <p className="text-[10px] text-slate-500 pt-1">
              Average size per episode file. Series exceeding this are flagged (Default: 2.5 GB).
            </p>
          </div>

          {/* Standard / 1080p Movie */}
          <div className="space-y-1 bg-slate-900/60 border border-slate-800 p-3 rounded-lg">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-amber-400" />
              <span>HD / 1080p Movies</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                step="1"
                min="1"
                max="500"
                value={movieSpaceHogGb}
                onChange={(e) => setMovieSpaceHogGb(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-white font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] font-mono text-slate-400 shrink-0">GB</span>
            </div>
            <p className="text-[10px] text-slate-500 pt-1">
              Size threshold for non-4K movies (e.g. uncompressed REMUXes; Default: 20 GB).
            </p>
          </div>

          {/* 4K Movie */}
          <div className="space-y-1 bg-slate-900/60 border border-slate-800 p-3 rounded-lg">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-purple-400" />
              <span>4K Movies</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                step="1"
                min="1"
                max="500"
                value={movie4kSpaceHogGb}
                onChange={(e) => setMovie4kSpaceHogGb(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-white font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] font-mono text-slate-400 shrink-0">GB</span>
            </div>
            <p className="text-[10px] text-slate-500 pt-1">
              Threshold for 4K UHD movies before being flagged as a space hog (Default: 50 GB).
            </p>
          </div>
        </div>
      </div>

      {/* Inactivity & Staleness Section */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold border-b border-slate-800 pb-2">
          <Clock className="w-4 h-4 text-sky-400" />
          <span>Inactivity & Staleness Thresholds</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Configure how many days must elapse without watch activity to categorize titles as Stale or Abandoned.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {/* Stale */}
          <div className="space-y-1 bg-slate-900/60 border border-slate-800 p-3 rounded-lg">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <span>Stale Media Inactivity</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                step="1"
                min="1"
                max="3650"
                value={staleDays}
                onChange={(e) => setStaleDays(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-white font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] font-mono text-slate-400 shrink-0">Days</span>
            </div>
            <p className="text-[10px] text-slate-500 pt-1">
              Days since last played across all users to consider Stale (Default: 180 days).
            </p>
          </div>

          {/* Abandoned */}
          <div className="space-y-1 bg-slate-900/60 border border-slate-800 p-3 rounded-lg">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <span>Abandoned TV Inactivity</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                step="1"
                min="1"
                max="3650"
                value={abandonedDays}
                onChange={(e) => setAbandonedDays(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-white font-mono focus:border-sky-500 focus:outline-none"
              />
              <span className="text-[11px] font-mono text-slate-400 shrink-0">Days</span>
            </div>
            <p className="text-[10px] text-slate-500 pt-1">
              Days since last episode played for in-progress series (Default: 90 days).
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Thresholds saved successfully! Smart category summaries updated.</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={handleResetDefaults}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Defaults
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Save Thresholds</span>
        </button>
      </div>
    </form>
  );
};
