/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from './App';
import { useCatalogStore } from './stores/useCatalogStore';
import { useConnectionStore } from './stores/useConnectionStore';
import { useToastStore } from './stores/useToastStore';
import { MediaItem } from './types/api';

vi.mock('./components/GridView', () => ({
  GridView: ({ items, onPrune }: { items: MediaItem[]; onPrune: (item: MediaItem) => void }) => (
    <div data-testid="mock-grid-view">
      {items.map((item) => (
        <button key={item.id} onClick={() => onPrune(item)}>
          Prune {item.title}
        </button>
      ))}
    </div>
  ),
}));

describe('App Prune Toast Lifecycle Integration', () => {
  const mockItem: MediaItem = {
    id: 'item-1',
    title: 'The Matrix',
    sortTitle: 'Matrix, The',
    mediaType: 0,
    totalSizeBytes: 5 * 1024 * 1024 * 1024,
    isProtected: false,
    instances: [
      {
        id: 'inst-1',
        mediaItemId: 'item-1',
        connectionId: 'conn-radarr-1',
        externalId: 101,
        cutoffUnmet: false,
        isMonitored: true,
        sizeBytes: 5 * 1024 * 1024 * 1024,
        hasFile: true,
        qualityProfileName: 'Radarr HD',
      },
    ],
    seasons: [],
    watchStats: [],
  };

  beforeEach(() => {
    useToastStore.getState().clearToasts();
    useCatalogStore.setState({
      items: [mockItem],
      categories: [{ categoryId: 'never_watched', name: 'Never Watched', count: 1, reclaimableSizeBytes: 5368709120 }],
      users: [],
      selectedIds: new Set<string>(),
      isLoading: false,
      hasMore: false,
    });
    useConnectionStore.setState({
      connections: [
        {
          id: 'conn-radarr-1',
          connectionType: 1,
          name: 'Radarr HD',
          baseUrl: 'http://radarr:7878',
          apiKey: 'key',
          isEnabled: true,
          lastStatus: 'Online',
        },
      ],
      isLoading: false,
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/catalog')) {
        return Promise.resolve({ ok: true, json: async () => [mockItem] });
      }
      if (url.includes('/api/v1/categories')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/api/v1/users')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/api/v1/connections')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'conn-radarr-1',
              connectionType: 1,
              name: 'Radarr HD',
              baseUrl: 'http://radarr:7878',
              apiKey: 'key',
              isEnabled: true,
              lastStatus: 'Online',
            },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('handles successful prune lifecycle with toasts and manual follow-up guidance', async () => {
    // Mock executePrune to succeed
    const executePruneSpy = vi.spyOn(useCatalogStore.getState(), 'executePrune').mockResolvedValue({
      success: true,
      message: 'Pruned successfully',
      bytesFreed: 5 * 1024 * 1024 * 1024,
    });
    const refreshPlexSpy = vi.spyOn(useCatalogStore.getState(), 'refreshPlex').mockResolvedValue({
      success: true,
      message: 'Plex scanned',
    });

    render(<App />);

    // Open single prune modal for The Matrix
    const pruneBtn = await screen.findByRole('button', { name: 'Prune The Matrix' });
    fireEvent.click(pruneBtn);

    // PruneConfirmModal is open
    expect(screen.getByText('Confirm Deletion')).toBeDefined();

    // Click 'Confirm & Delete'
    const confirmBtn = screen.getByRole('button', { name: /confirm & delete/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(executePruneSpy).toHaveBeenCalledTimes(1);
    });

    // Check success toast
    await waitFor(() => {
      expect(screen.getByText('Deleted from Radarr HD & Disk')).toBeDefined();
      expect(screen.getByText('5.0 GB reclaimed')).toBeDefined();
    });

    // Check manual follow-up warning toast
    expect(screen.getByText('Prune Complete: Manual Steps')).toBeDefined();
    expect(screen.getByText(/Plex: Empty Trash in your Plex library/i)).toBeDefined();
    expect(screen.getByText(/Overseerr \/ Seerr: Media will show as 'Available'/i)).toBeDefined();
    expect(screen.getByText(/Download Client: Verify hardlinked or seeded downloads/i)).toBeDefined();

    // Click 'Scan Plex Libraries' button on manual follow-up toast
    const scanPlexBtn = screen.getByRole('button', { name: 'Scan Plex Libraries' });
    fireEvent.click(scanPlexBtn);

    await waitFor(() => {
      expect(refreshPlexSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error toast when prune fails and does not show manual follow-up toast', async () => {
    vi.spyOn(useCatalogStore.getState(), 'executePrune').mockResolvedValue({
      success: false,
      message: 'Radarr API rejected delete command',
      bytesFreed: 0,
    });

    render(<App />);

    const pruneBtn = await screen.findByRole('button', { name: 'Prune The Matrix' });
    fireEvent.click(pruneBtn);

    const confirmBtn = screen.getByRole('button', { name: /confirm & delete/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Failed to prune The Matrix')).toBeDefined();
      expect(screen.getByText('Radarr API rejected delete command')).toBeDefined();
    });

    // Manual follow-up should not appear because prune failed
    expect(screen.queryByText('Prune Complete: Manual Steps')).toBeNull();
  });
});
