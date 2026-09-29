/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import { useConnectionStore } from '../stores/useConnectionStore';
import { useSettingsStore } from '../stores/useSettingsStore';

describe('SettingsPage component', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connections: [
        {
          id: 'conn-1',
          name: 'Radarr Primary',
          connectionType: 1,
          baseUrl: 'http://radarr:7878',
          apiKey: 'test-api-key',
          tierTag: 'HD',
          isEnabled: true,
          lastStatus: 'Online',
        },
        {
          id: 'conn-plex',
          name: 'Titan Plex',
          connectionType: 3,
          baseUrl: 'http://192.168.1.50:32400',
          apiKey: 'plex-tok',
          isEnabled: true,
          lastStatus: 'Connected',
        },
      ],
      discoveredServices: [],
      testResults: {},
      isScanning: false,
    });

    vi.spyOn(useSettingsStore.getState(), 'fetchSettings').mockImplementation(async () => {});
    vi.spyOn(useSettingsStore.getState(), 'fetchPlexStatus').mockImplementation(async () => useSettingsStore.getState().plexStatus);
    vi.spyOn(useSettingsStore.getState(), 'fetchUsers').mockImplementation(async () => {});

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
        adminUsernames: 'steven',
      },
      plexStatus: {
        isBound: true,
        serverName: 'Titan Plex',
        machineIdentifier: 'machine-titan-123',
        hasAdminToken: true,
        connection: {
          id: 'plex-conn-1',
          name: 'Titan Plex',
          connectionType: 3,
          baseUrl: 'http://192.168.1.50:32400',
          apiKey: 'plex-tok',
          isEnabled: true,
          lastStatus: 'Connected',
        },
      },
      discoveredPlexServers: [],
      users: [
        {
          id: 'user-1',
          plexId: 'plex-123',
          username: 'steven',
          email: 'steven@example.com',
          role: 'Admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders settings header and 4 tabs', () => {
    render(<SettingsPage />);

    expect(screen.getByText('Settings & Governance Rules')).toBeDefined();
    expect(screen.getByRole('button', { name: /Plex & Auth/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Arr Connections/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Rules & Thresholds/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Users/i })).toBeDefined();
  });

  it('renders Plex & Auth tab content by default', () => {
    render(<SettingsPage />);

    expect(screen.getByText('Plex Media Server Binding')).toBeDefined();
    expect(screen.getByText('Titan Plex')).toBeDefined();
    expect(screen.getByText('Require Plex Authentication')).toBeDefined();
  });

  it('switches between tabs cleanly', () => {
    render(<SettingsPage />);

    // Switch to Arr Connections tab
    const arrTab = screen.getByRole('button', { name: /Arr Connections/i });
    fireEvent.click(arrTab);

    expect(screen.getByText('Radarr Primary')).toBeDefined();
    expect(screen.getByText('http://radarr:7878')).toBeDefined();

    // Switch to Users tab
    const usersTab = screen.getByRole('button', { name: /Users/i });
    fireEvent.click(usersTab);

    expect(screen.getByText('Plex User Management')).toBeDefined();
    expect(screen.getByText('steven')).toBeDefined();

    // Switch to Rules & Thresholds tab
    const thresholdsTab = screen.getByRole('button', { name: /Rules & Thresholds/i });
    fireEvent.click(thresholdsTab);

    expect(screen.getByText('Space Hogs Thresholds')).toBeDefined();
  });

  it('triggers connection test in Arr Connections tab', () => {
    const testSpy = vi.spyOn(useConnectionStore.getState(), 'testConnection').mockResolvedValue({
      success: true,
      message: 'Connected (25ms)',
      latencyMs: 25,
    });

    render(<SettingsPage />);

    // Switch to Arr Connections tab
    const arrTab = screen.getByRole('button', { name: /Arr Connections/i });
    fireEvent.click(arrTab);

    const testBtn = screen.getByRole('button', { name: /Test Connection/i });
    fireEvent.click(testBtn);

    expect(testSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'conn-1',
        baseUrl: 'http://radarr:7878',
      })
    );
  });

  it('opens connection editor form when Add Connection is clicked in Arr tab', () => {
    render(<SettingsPage />);

    // Switch to Arr Connections tab
    const arrTab = screen.getByRole('button', { name: /Arr Connections/i });
    fireEvent.click(arrTab);

    const addBtn = screen.getByRole('button', { name: /Add Connection/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Add New Connection')).toBeDefined();
    expect(screen.getByPlaceholderText(/e\.g\. Sonarr 4K/i)).toBeDefined();
  });
});
