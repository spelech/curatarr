/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import { useConnectionStore } from '../stores/useConnectionStore';
import { useSettingsStore, DEFAULT_SETTINGS } from '../stores/useSettingsStore';

describe('SettingsModal component', () => {
  beforeEach(() => {
    // Reset Zustand stores
    useConnectionStore.setState({
      connections: [
        {
          id: 'conn-1',
          name: 'Sonarr 4K',
          connectionType: 0,
          baseUrl: 'http://sonarr:8989',
          apiKey: 'key-123',
          tierTag: '4K',
          isEnabled: true,
          lastStatus: 'connected',
        },
      ],
      testResults: {
        'conn-1': { success: true, message: 'Connected to Sonarr v4', latencyMs: 15 },
      },
      discoveredServices: [
        {
          id: 'docker:radarr',
          name: 'Radarr (HD - radarr)',
          connectionType: 1,
          baseUrl: 'http://radarr:7878',
          discoverySource: 'docker_socket',
          isConfigured: false,
          tierTag: 'hd',
          port: 7878,
          details: 'Docker Container: radarr',
        },
      ],
      isScanning: false,
      scanError: undefined,
    });

    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS },
      isLoading: false,
      isSaving: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<SettingsModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders connections tab, tests connection, and displays results', async () => {
    const onClose = vi.fn();
    const testConnectionSpy = vi.spyOn(useConnectionStore.getState(), 'testConnection').mockResolvedValue({ success: true, message: 'Connected', latencyMs: 15 });

    render(<SettingsModal isOpen={true} onClose={onClose} />);

    // Check modal title
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined();

    // Check connection row
    expect(screen.getByText('Sonarr 4K')).toBeDefined();
    expect(screen.getByText('http://sonarr:8989')).toBeDefined();
    expect(screen.getByText('Connected to Sonarr v4')).toBeDefined();

    // Test connection button
    const testBtn = screen.getByRole('button', { name: 'Test' });
    fireEvent.click(testBtn);
    expect(testConnectionSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'conn-1' }));

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close settings' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('allows adding and editing connections', async () => {
    const saveSpy = vi.spyOn(useConnectionStore.getState(), 'saveConnection').mockResolvedValue(true);

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Click Add Manual Connection
    const addBtn = screen.getByRole('button', { name: 'Add Manual Connection' });
    fireEvent.click(addBtn);

    // Form inputs should appear
    expect(screen.getByText('Add New Connection')).toBeDefined();
    const nameInput = screen.getByPlaceholderText('e.g. Sonarr 4K');
    const urlInput = screen.getByPlaceholderText('http://sonarr4k:8989');
    const apiKeyInput = screen.getByPlaceholderText('API Key or Plex Token');

    fireEvent.change(nameInput, { target: { value: 'Radarr Test' } });
    fireEvent.change(urlInput, { target: { value: 'http://radarr-test:7878' } });
    fireEvent.change(apiKeyInput, { target: { value: 'apikey123' } });

    // Submit form
    const saveFormBtn = screen.getByRole('button', { name: 'Save Connection' });
    fireEvent.click(saveFormBtn);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  it('scans for discovered services and allows adding them', async () => {
    const discoverSpy = vi.spyOn(useConnectionStore.getState(), 'discoverServices').mockResolvedValue([]);

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const scanBtn = screen.getByRole('button', { name: 'Scan Services' });
    fireEvent.click(scanBtn);
    expect(discoverSpy).toHaveBeenCalled();

    // Discovered service should be listed
    expect(screen.getByText('Radarr (HD - radarr)')).toBeDefined();

    // Click Add on discovered service
    const addDiscoveredBtn = screen.getByRole('button', { name: 'Add Connection' });
    fireEvent.click(addDiscoveredBtn);

    // Form should populate with discovered service
    expect(screen.getByDisplayValue('Radarr (HD - radarr)')).toBeDefined();
    expect(screen.getByDisplayValue('http://radarr:7878')).toBeDefined();
  });

  it('switches to thresholds tab and handles saving and resetting settings', async () => {
    const saveSettingsSpy = vi.spyOn(useSettingsStore.getState(), 'saveSettings').mockResolvedValue(true);

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Switch tab
    const thresholdsTabBtn = screen.getByRole('button', { name: 'Rules & Thresholds' });
    fireEvent.click(thresholdsTabBtn);

    // Thresholds tab rendered
    expect(screen.getByText('Space Hogs Thresholds')).toBeDefined();
    expect(screen.getByText('Inactivity & Staleness Thresholds')).toBeDefined();

    // Modify a threshold input (e.g. staleDays)
    const staleInput = screen.getByDisplayValue(String(DEFAULT_SETTINGS.staleDays));
    fireEvent.change(staleInput, { target: { value: '200' } });

    // Save thresholds
    const saveBtn = screen.getByRole('button', { name: /Save Thresholds/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveSettingsSpy).toHaveBeenCalled();
    });

    // Reset to defaults
    const resetBtn = screen.getByRole('button', { name: /Reset to Defaults/i });
    fireEvent.click(resetBtn);
  });

  it('renders loading state when thresholds are loading without settings', () => {
    useSettingsStore.setState({
      settings: null,
      isLoading: true,
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Switch to thresholds tab
    const thresholdsTabBtn = screen.getByRole('button', { name: 'Rules & Thresholds' });
    fireEvent.click(thresholdsTabBtn);

    expect(screen.getByText('Loading thresholds...')).toBeDefined();
  });

  it('renders empty connections state, handles delete and edit connection', async () => {
    const deleteSpy = vi.spyOn(useConnectionStore.getState(), 'deleteConnection').mockResolvedValue(true);

    // 1. Render with connection
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Click Edit
    const editBtn = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editBtn);
    expect(screen.getByText('Edit Connection')).toBeDefined();

    // Cancel edit
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    // Click Delete
    const deleteBtn = screen.getByTitle('Delete connection');
    fireEvent.click(deleteBtn);
    expect(deleteSpy).toHaveBeenCalledWith('conn-1');
  });

  it('renders empty connection list message and configured discovered service', () => {
    useConnectionStore.setState({
      connections: [],
      discoveredServices: [
        {
          id: 'docker:sonarr',
          name: 'Sonarr',
          connectionType: 0,
          baseUrl: 'http://sonarr:8989',
          discoverySource: 'docker_socket',
          isConfigured: true,
          containerName: 'sonarr',
          port: 8989,
        },
      ],
      testResults: {
        'conn-fail': { success: false, message: 'Invalid API key', latencyMs: 0 },
      },
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Empty connection message
    expect(screen.getByText(/No connections configured yet/i)).toBeDefined();

    // Discovered service with Configured badge and Already Added label
    expect(screen.getByText('Configured')).toBeDefined();
    expect(screen.getByText('Already Added')).toBeDefined();
  });
});
