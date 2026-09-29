/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PlexSettingsTab } from './PlexSettingsTab';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useConnectionStore } from '../stores/useConnectionStore';

describe('PlexSettingsTab component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    useSettingsStore.setState({
      settings: {
        movieSpaceHogThresholdBytes: 20 * 1024 * 1024 * 1024,
        movie4kSpaceHogThresholdBytes: 50 * 1024 * 1024 * 1024,
        seriesEpisodeSpaceHogThresholdBytes: 2.5 * 1024 * 1024 * 1024,
        staleDays: 180,
        abandonedDays: 90,
        neverWatchedMinAgeDays: 60,
        syncIntervalHours: 1,
        catalogBatchSize: 50,
        sub720pCutoffYear: 2000,
        movieSpaceHogGb: 20,
        movie4kSpaceHogGb: 50,
        seriesEpisodeSpaceHogGb: 2.5,
        authEnabled: true,
        adminUsernames: 'admin, steven',
      },
      plexStatus: {
        isBound: true,
        serverName: 'Atlas Plex Server',
        machineIdentifier: 'atlas-mach-456',
        hasAdminToken: true,
        connection: {
          id: 'conn-plex-1',
          name: 'Atlas Plex Server',
          connectionType: 3,
          baseUrl: 'http://192.168.1.15:32400',
          apiKey: 'plex-token-xyz',
          isEnabled: true,
          lastStatus: 'Connected',
        },
      },
      discoveredPlexServers: [],
      isFetchingPlexServers: false,
    });

    useConnectionStore.setState({
      connections: [
        {
          id: 'conn-plex-1',
          name: 'Atlas Plex Server',
          connectionType: 3,
          baseUrl: 'http://192.168.1.15:32400',
          apiKey: 'plex-token-xyz',
          isEnabled: true,
          lastStatus: 'Connected',
        },
      ],
      testResults: {},
    });

    vi.spyOn(useSettingsStore.getState(), 'fetchSettings').mockImplementation(async () => {});
    vi.spyOn(useSettingsStore.getState(), 'fetchPlexStatus').mockImplementation(async () => useSettingsStore.getState().plexStatus);
    vi.spyOn(useConnectionStore.getState(), 'fetchConnections').mockImplementation(async () => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders bound Plex server information accurately', () => {
    render(<PlexSettingsTab />);

    expect(screen.getByText('Plex Media Server Binding')).toBeDefined();
    expect(screen.getByText('Atlas Plex Server')).toBeDefined();
    expect(screen.getByText('atlas-mach-456')).toBeDefined();
    expect(screen.getByText('http://192.168.1.15:32400')).toBeDefined();
    expect(screen.getByText('Connected')).toBeDefined();
  });

  it('renders unbound state when no server is bound', () => {
    useSettingsStore.setState({
      plexStatus: {
        isBound: false,
        serverName: null,
        machineIdentifier: null,
        hasAdminToken: false,
        connection: null,
      },
    });

    render(<PlexSettingsTab />);

    expect(screen.getByText('No Plex Server Bound')).toBeDefined();
    expect(screen.getByRole('button', { name: /Launch Plex Setup Wizard/i })).toBeDefined();
  });

  it('triggers test connection when Test connection button is clicked', async () => {
    const testSpy = vi.spyOn(useConnectionStore.getState(), 'testConnection').mockResolvedValue({ success: true, latencyMs: 15 });

    render(<PlexSettingsTab />);

    const testBtn = screen.getByTitle('Test connection now');
    fireEvent.click(testBtn);

    expect(testSpy).toHaveBeenCalledWith(expect.objectContaining({
      id: 'conn-plex-1',
      name: 'Atlas Plex Server',
    }));
  });

  it('saves authentication settings when Save Auth Settings is clicked', async () => {
    const saveSpy = vi.spyOn(useSettingsStore.getState(), 'saveSettings').mockResolvedValue(true);

    render(<PlexSettingsTab />);

    const saveBtn = screen.getByRole('button', { name: /Save Auth Settings/i });
    fireEvent.click(saveBtn);

    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
      authEnabled: true,
      adminUsernames: 'admin, steven',
    }));
  });
});
