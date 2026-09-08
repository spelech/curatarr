import { create } from 'zustand';
import { CuratarrSettings } from '../types/api';

interface SettingsState {
  settings: CuratarrSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  saveSettings: (settings: CuratarrSettings) => Promise<boolean>;
}

export const DEFAULT_SETTINGS: CuratarrSettings = {
  movieSpaceHogThresholdBytes: 20 * 1024 * 1024 * 1024,
  movie4kSpaceHogThresholdBytes: 50 * 1024 * 1024 * 1024,
  seriesEpisodeSpaceHogThresholdBytes: 2.5 * 1024 * 1024 * 1024,
  staleDays: 180,
  abandonedDays: 90,
  movieSpaceHogGb: 20.0,
  movie4kSpaceHogGb: 50.0,
  seriesEpisodeSpaceHogGb: 2.5,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/v1/settings');
      if (res.ok) {
        const data: CuratarrSettings = await res.json();
        set({ settings: data, isLoading: false });
      } else {
        set({ isLoading: false, error: 'Failed to load settings.' });
      }
    } catch (err: unknown) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Network error loading settings.' });
    }
  },

  saveSettings: async (settings: CuratarrSettings) => {
    set({ isSaving: true, error: null });
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const data: CuratarrSettings = await res.json();
        set({ settings: data, isSaving: false });
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        set({ isSaving: false, error: errData.error || 'Failed to save settings.' });
        return false;
      }
    } catch (err: unknown) {
      set({ isSaving: false, error: err instanceof Error ? err.message : 'Network error saving settings.' });
      return false;
    }
  },
}));
