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
    expect(state.settings?.syncIntervalHours).toBe(1);
    expect(state.settings?.catalogBatchSize).toBe(50);
    expect(state.isLoading).toBe(false);
  });

  it('saveSettings sends updated settings via PUT', async () => {
    const updated = { ...DEFAULT_SETTINGS, seriesEpisodeSpaceHogGb: 3.5, syncIntervalHours: 6, catalogBatchSize: 100 };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    } as Response);

    const ok = await useSettingsStore.getState().saveSettings(updated);

    expect(ok).toBe(true);
    expect(useSettingsStore.getState().settings?.seriesEpisodeSpaceHogGb).toBe(3.5);
    expect(useSettingsStore.getState().settings?.syncIntervalHours).toBe(6);
    expect(useSettingsStore.getState().settings?.catalogBatchSize).toBe(100);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/settings', expect.objectContaining({
      method: 'PUT',
    }));
  });

  it('handles fetchSettings failure and exceptions', async () => {
    // Non-ok response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
    } as Response);

    await useSettingsStore.getState().fetchSettings();
    expect(useSettingsStore.getState().error).toBe('Failed to load settings.');

    // Exception
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network offline'));
    await useSettingsStore.getState().fetchSettings();
    expect(useSettingsStore.getState().error).toBe('Network offline');
  });

  it('handles saveSettings failure and exceptions', async () => {
    // Non-ok response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Validation failed' }),
    } as unknown as Response);

    const fail1 = await useSettingsStore.getState().saveSettings(DEFAULT_SETTINGS);
    expect(fail1).toBe(false);
    expect(useSettingsStore.getState().error).toBe('Validation failed');

    // Exception
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Save timeout'));
    const fail2 = await useSettingsStore.getState().saveSettings(DEFAULT_SETTINGS);
    expect(fail2).toBe(false);
    expect(useSettingsStore.getState().error).toBe('Save timeout');
  });

  it('fetchPlexStatus fetches status and updates store state', async () => {
    const mockStatus = {
      isBound: true,
      serverName: 'Atlas Plex',
      machineIdentifier: 'atlas-123',
      hasAdminToken: true,
      connection: {
        id: 'conn-atlas',
        name: 'Atlas Plex',
        baseUrl: 'http://192.168.1.10:32400',
        isEnabled: true,
        lastStatus: 'Connected',
      },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    } as Response);

    const result = await useSettingsStore.getState().fetchPlexStatus();

    expect(result).toEqual(mockStatus);
    expect(useSettingsStore.getState().plexStatus).toEqual(mockStatus);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/plex/status');
  });

  it('fetchDiscoveredPlexServers fetches servers from /api/v1/plex/servers', async () => {
    const mockServers = [
      {
        name: 'Tower Server',
        clientIdentifier: 'tower-mach-1',
        owned: true,
        accessToken: 'tok-abc',
        connections: [],
      },
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ servers: mockServers }),
    } as Response);

    const servers = await useSettingsStore.getState().fetchDiscoveredPlexServers();

    expect(servers).toEqual(mockServers);
    expect(useSettingsStore.getState().discoveredPlexServers).toEqual(mockServers);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/plex/servers');
  });

  it('bindPlexServer sends POST /api/v1/plex/bind and updates status', async () => {
    const req = {
      name: 'Custom Plex',
      machineIdentifier: 'mach-999',
      baseUrl: 'http://10.0.0.99:32400',
      apiKey: 'tok-xyz',
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isBound: true,
          serverName: 'Custom Plex',
          machineIdentifier: 'mach-999',
        }),
      } as Response);

    const res = await useSettingsStore.getState().bindPlexServer(req);

    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/plex/bind', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(req),
    }));
  });

  it('fetchUsers loads user list from /api/v1/auth/users', async () => {
    const mockUsers = [
      {
        id: 'u-1',
        plexId: 'p-1',
        username: 'AdminUser',
        email: 'admin@curatarr.local',
        role: 'Admin',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    } as Response);

    await useSettingsStore.getState().fetchUsers();

    expect(useSettingsStore.getState().users).toEqual(mockUsers);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/users');
  });

  it('updateUserRole sends PUT to /api/v1/auth/users/:id/role', async () => {
    useSettingsStore.setState({
      users: [
        {
          id: 'u-1',
          plexId: 'p-1',
          username: 'GuestUser',
          role: 'Guest',
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const success = await useSettingsStore.getState().updateUserRole('u-1', 'Admin');

    expect(success).toBe(true);
    expect(useSettingsStore.getState().users[0].role).toBe('Admin');
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/users/u-1/role', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ role: 'Admin' }),
    }));
  });

  it('deleteUser sends DELETE to /api/v1/auth/users/:id', async () => {
    useSettingsStore.setState({
      users: [
        {
          id: 'u-1',
          plexId: 'p-1',
          username: 'UserToRemove',
          role: 'Guest',
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const success = await useSettingsStore.getState().deleteUser('u-1');

    expect(success).toBe(true);
    expect(useSettingsStore.getState().users).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/users/u-1', expect.objectContaining({
      method: 'DELETE',
    }));
  });
});
