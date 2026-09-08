import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSettingsStore, DEFAULT_SETTINGS } from './useSettingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: null,
      isLoading: false,
      isSaving: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it('fetchSettings loads settings correctly', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => DEFAULT_SETTINGS,
    } as Response);

    await useSettingsStore.getState().fetchSettings();

    const state = useSettingsStore.getState();
    expect(state.settings).not.toBeNull();
    expect(state.settings?.seriesEpisodeSpaceHogGb).toBe(2.5);
    expect(state.isLoading).toBe(false);
  });

  it('saveSettings sends updated settings via PUT', async () => {
    const updated = { ...DEFAULT_SETTINGS, seriesEpisodeSpaceHogGb: 3.5 };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    } as Response);

    const ok = await useSettingsStore.getState().saveSettings(updated);

    expect(ok).toBe(true);
    expect(useSettingsStore.getState().settings?.seriesEpisodeSpaceHogGb).toBe(3.5);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/settings', expect.objectContaining({
      method: 'PUT',
    }));
  });
});
