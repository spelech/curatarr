/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PlexOnboardingModal } from './PlexOnboardingModal';
import { useSettingsStore } from '../stores/useSettingsStore';

describe('PlexOnboardingModal component', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      discoveredPlexServers: [
        {
          name: 'Home Media Server',
          clientIdentifier: 'machine-plex-123456789',
          owned: true,
          accessToken: 'plex-token-xyz',
          connections: [
            {
              uri: 'http://192.168.1.100:32400',
              address: '192.168.1.100',
              port: 32400,
              protocol: 'http',
              local: true,
            },
          ],
        },
      ],
      isFetchingPlexServers: false,
      isBindingPlex: false,
    });

    vi.spyOn(useSettingsStore.getState(), 'fetchDiscoveredPlexServers').mockImplementation(async () => {
      return useSettingsStore.getState().discoveredPlexServers;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders modal when open with discovered server selected', () => {
    const onClose = vi.fn();
    render(<PlexOnboardingModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('Connect Your Plex Media Server')).toBeDefined();
    expect(screen.getByText('Home Media Server')).toBeDefined();
    expect(screen.getByText('Owner')).toBeDefined();
    expect(screen.getByDisplayValue('http://192.168.1.100:32400')).toBeDefined();
  });

  it('allows switching to manual mode and submitting custom URL', async () => {
    const bindSpy = vi.spyOn(useSettingsStore.getState(), 'bindPlexServer').mockResolvedValue({ success: true });
    const onClose = vi.fn();

    render(<PlexOnboardingModal isOpen={true} onClose={onClose} />);

    // Click Enter Manually
    const manualBtn = screen.getByRole('button', { name: /Enter Manually/i });
    fireEvent.click(manualBtn);

    expect(screen.getByText('Manual Server Configuration')).toBeDefined();

    // Fill in custom URL and token
    const urlInput = screen.getByLabelText(/Base URL/i);
    fireEvent.change(urlInput, { target: { value: 'http://10.0.0.5:32400' } });

    const tokenInput = screen.getByLabelText(/Plex Auth Token/i);
    fireEvent.change(tokenInput, { target: { value: 'custom-token' } });

    const submitBtn = screen.getByRole('button', { name: /Save & Connect Server/i });
    fireEvent.click(submitBtn);

    expect(bindSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'http://10.0.0.5:32400',
        apiKey: 'custom-token',
      })
    );
  });
});
