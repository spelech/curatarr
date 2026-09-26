/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QualityUpgradeModal } from './QualityUpgradeModal';
import { MediaItem } from '../types/api';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useConnectionStore } from '../stores/useConnectionStore';

describe('QualityUpgradeModal component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    useConnectionStore.setState({
      connections: [
        {
          id: 'conn-radarr-1',
          connectionType: 1, // Radarr
          name: 'Radarr HD',
          baseUrl: 'http://radarr:7878',
          apiKey: 'key123',
          isEnabled: true,
          lastStatus: 'Healthy',
        },
      ],
    });
  });

  const testMediaItem: MediaItem = {
    id: 'm-casablanca',
    title: 'Casablanca',
    sortTitle: 'casablanca',
    mediaType: 0,
    year: 1942,
    totalSizeBytes: 1.2 * 1024 * 1024 * 1024,
    isProtected: false,
    instances: [
      {
        id: 'inst-sd',
        mediaItemId: 'm-casablanca',
        connectionId: 'conn-radarr-1',
        externalId: 42,
        cutoffUnmet: true,
        isMonitored: true,
        sizeBytes: 1.2 * 1024 * 1024 * 1024,
        hasFile: true,
        resolution: 'SD',
        qualityProfileName: 'Any - SD',
      },
    ],
    seasons: [],
    watchStats: [],
  };

  it('renders modal with item info, fetches profiles, and triggers upgrade with search', async () => {
    const fetchProfilesMock = vi.fn().mockResolvedValue([
      { id: 1, name: 'Any - SD' },
      { id: 2, name: 'HD-1080p' },
      { id: 3, name: 'Ultra-HD-4K' },
    ]);
    const upgradeMock = vi.fn().mockResolvedValue({
      success: true,
      message: 'Quality profile upgraded to HD-1080p and search initiated.',
      searchTriggered: true,
    });

    useCatalogStore.setState({
      fetchQualityProfiles: fetchProfilesMock,
      upgradeQuality: upgradeMock,
    });

    const onClose = vi.fn();

    render(
      <QualityUpgradeModal
        isOpen={true}
        onClose={onClose}
        item={testMediaItem}
      />
    );

    // Title and item details
    expect(screen.getByText('Upgrade Quality Profile')).toBeDefined();
    expect(screen.getByText('Casablanca')).toBeDefined();
    expect(screen.getByText(/Current: SD/)).toBeDefined();

    // Verify profiles are fetched
    await waitFor(() => {
      expect(fetchProfilesMock).toHaveBeenCalledWith('conn-radarr-1');
    });

    // Profile select should have HD-1080p option
    await waitFor(() => {
      expect(screen.getByText(/HD-1080p/)).toBeDefined();
    });

    // Change profile selection to HD-1080p (id: 2)
    const select = screen.getByLabelText(/New Quality Profile/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '2' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Upgrade & Search/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(upgradeMock).toHaveBeenCalledWith('m-casablanca', {
        connectionId: 'conn-radarr-1',
        qualityProfileId: 2,
        triggerSearch: true,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('allows unchecking automatic search', async () => {
    const fetchProfilesMock = vi.fn().mockResolvedValue([
      { id: 1, name: 'Any - SD' },
      { id: 2, name: 'HD-1080p' },
    ]);
    const upgradeMock = vi.fn().mockResolvedValue({
      success: true,
      message: 'Quality profile updated.',
      searchTriggered: false,
    });

    useCatalogStore.setState({
      fetchQualityProfiles: fetchProfilesMock,
      upgradeQuality: upgradeMock,
    });

    const onClose = vi.fn();

    render(
      <QualityUpgradeModal
        isOpen={true}
        onClose={onClose}
        item={testMediaItem}
      />
    );

    await waitFor(() => {
      expect(fetchProfilesMock).toHaveBeenCalled();
    });

    // Uncheck automatic search
    const checkbox = screen.getByRole('checkbox', { name: /Trigger automatic search immediately/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);

    // Button label should now be 'Update Profile'
    const submitBtn = screen.getByRole('button', { name: /Update Profile/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(upgradeMock).toHaveBeenCalledWith('m-casablanca', {
        connectionId: 'conn-radarr-1',
        qualityProfileId: 1,
        triggerSearch: false,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('selects the SD instance by default when multiple instances exist', async () => {
    const multiItem: MediaItem = {
      ...testMediaItem,
      instances: [
        {
          id: 'inst-1080p',
          mediaItemId: 'm-casablanca',
          connectionId: 'conn-radarr-1',
          externalId: 41,
          cutoffUnmet: false,
          isMonitored: true,
          sizeBytes: 8 * 1024 * 1024 * 1024,
          hasFile: true,
          resolution: '1080p',
          qualityProfileName: 'HD-1080p',
        },
        {
          id: 'inst-sd-copy',
          mediaItemId: 'm-casablanca',
          connectionId: 'conn-radarr-2',
          externalId: 42,
          cutoffUnmet: true,
          isMonitored: true,
          sizeBytes: 1.1 * 1024 * 1024 * 1024,
          hasFile: true,
          resolution: 'SD',
          qualityProfileName: 'SD-Any',
        },
      ],
    };

    useConnectionStore.setState({
      connections: [
        {
          id: 'conn-radarr-1',
          connectionType: 1,
          name: 'Radarr HD',
          baseUrl: 'http://radarr1:7878',
          apiKey: 'key1',
          isEnabled: true,
          lastStatus: 'Healthy',
        },
        {
          id: 'conn-radarr-2',
          connectionType: 1,
          name: 'Radarr SD',
          baseUrl: 'http://radarr2:7878',
          apiKey: 'key2',
          isEnabled: true,
          lastStatus: 'Healthy',
        },
      ],
    });

    const fetchProfilesMock = vi.fn().mockResolvedValue([{ id: 10, name: '720p/1080p' }]);
    useCatalogStore.setState({ fetchQualityProfiles: fetchProfilesMock });

    render(
      <QualityUpgradeModal
        isOpen={true}
        onClose={vi.fn()}
        item={multiItem}
      />
    );

    // Multi-instance selector should be visible and pre-select the SD instance
    await waitFor(() => {
      const instanceSelect = screen.getByLabelText(/Target Arr Instance/i) as HTMLSelectElement;
      expect(instanceSelect.value).toBe('inst-sd-copy');
    });

    expect(fetchProfilesMock).toHaveBeenCalledWith('conn-radarr-2');
  });
});
