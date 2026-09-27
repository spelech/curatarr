/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import { useConnectionStore } from '../stores/useConnectionStore';

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
      ],
      discoveredServices: [],
      testResults: {},
      isScanning: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders settings header and connections by default', () => {
    render(<SettingsPage />);

    expect(screen.getByText('Settings & Governance Rules')).toBeDefined();
    expect(screen.getByText('Radarr Primary')).toBeDefined();
    expect(screen.getByText('http://radarr:7878')).toBeDefined();
    expect(screen.getByText('Service Connections')).toBeDefined();
    expect(screen.getByText('Rules & Thresholds')).toBeDefined();
  });

  it('switches between Service Connections and Rules tabs', () => {
    render(<SettingsPage />);

    const thresholdsTab = screen.getByRole('button', { name: /Rules & Thresholds/i });
    fireEvent.click(thresholdsTab);

    // Threshold tab content should be active
    const connectionsTab = screen.getByRole('button', { name: /Service Connections/i });
    fireEvent.click(connectionsTab);

    expect(screen.getByText('Radarr Primary')).toBeDefined();
  });

  it('triggers connection test when Test Connection button is clicked', () => {
    const testSpy = vi.spyOn(useConnectionStore.getState(), 'testConnection').mockResolvedValue({
      success: true,
      message: 'Connected (25ms)',
      latencyMs: 25,
    });

    render(<SettingsPage />);

    const testBtn = screen.getByRole('button', { name: /Test Connection/i });
    fireEvent.click(testBtn);

    expect(testSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'conn-1',
        baseUrl: 'http://radarr:7878',
      })
    );
  });

  it('opens connection editor form when Add Connection is clicked', () => {
    render(<SettingsPage />);

    const addBtn = screen.getByRole('button', { name: /Add Connection/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Add New Connection')).toBeDefined();
    expect(screen.getByPlaceholderText(/e\.g\. Sonarr 4K/i)).toBeDefined();
  });
});
