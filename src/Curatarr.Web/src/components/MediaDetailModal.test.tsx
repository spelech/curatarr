/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MediaDetailModal } from './MediaDetailModal';
import { MediaItem } from '../types/api';

describe('MediaDetailModal component', () => {
  afterEach(() => {
    cleanup();
  });

  const mockMovie: MediaItem = {
    id: 'm-detail-1',
    title: 'Interstellar',
    sortTitle: 'interstellar',
    mediaType: 0,
    year: 2014,
    addedAt: '2015-06-01T00:00:00Z', // Predates July 2017
    totalSizeBytes: 1500 * 1024 * 1024 * 1024, // 1.5 TB
    isProtected: false,
    tmdbId: '157336',
    imdbId: 'tt0816692',
    plexRatingKey: 12345,
    instances: [
      {
        id: 'inst-1',
        mediaItemId: 'm-detail-1',
        connectionId: 'radarr-4k',
        externalId: 50,
        resolution: '4K',
        cutoffUnmet: false,
        isMonitored: true,
        hasFile: true,
        sizeBytes: 1500 * 1024 * 1024 * 1024,
        diskPath: '/media/movies/Interstellar (2014)/Interstellar.mkv',
      },
    ],
    seasons: [],
    watchStats: [],
  };

  const mockSeries: MediaItem = {
    id: 's-detail-1',
    title: 'The Wire',
    sortTitle: 'the wire',
    mediaType: 1,
    year: 2002,
    addedAt: '2023-01-15T00:00:00Z',
    totalSizeBytes: 80 * 1024 * 1024 * 1024, // 80 GB
    isProtected: true,
    protectionReason: 'All-time Masterpiece',
    tvdbId: '79168',
    instances: [
      {
        id: 'inst-2',
        mediaItemId: 's-detail-1',
        connectionId: 'sonarr-hd',
        externalId: 60,
        resolution: '', // Missing file / no resolution
        cutoffUnmet: true,
        isMonitored: false,
        hasFile: false,
        sizeBytes: 80 * 1024 * 1024 * 1024,
      },
    ],
    seasons: [
      {
        id: 'seas-0',
        mediaItemId: 's-detail-1',
        seasonNumber: 0,
        episodeCount: 3,
        episodeFileCount: 3,
        sizeBytes: 2 * 1024 * 1024 * 1024,
        isMonitored: false,
      },
      {
        id: 'seas-1',
        mediaItemId: 's-detail-1',
        seasonNumber: 1,
        episodeCount: 13,
        episodeFileCount: 13,
        sizeBytes: 15 * 1024 * 1024 * 1024,
        isMonitored: true,
      },
    ],
    watchStats: [
      {
        id: 'ws-1',
        mediaItemId: 's-detail-1',
        userId: 'u-1',
        username: 'alice',
        seasonNumber: 1,
        playCount: 13,
        lastPlayedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };

  it('renders nothing when isOpen is false or item is null', () => {
    const { container: c1 } = render(
      <MediaDetailModal
        item={mockMovie}
        isOpen={false}
        onClose={vi.fn()}
        onToggleProtect={vi.fn()}
        onPrune={vi.fn()}
      />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <MediaDetailModal
        item={null}
        isOpen={true}
        onClose={vi.fn()}
        onToggleProtect={vi.fn()}
        onPrune={vi.fn()}
      />
    );
    expect(c2.firstChild).toBeNull();
  });

  it('renders movie details, pre-2017 watch alert, and protection editing', () => {
    const onClose = vi.fn();
    const onToggleProtect = vi.fn();
    const onPrune = vi.fn();

    render(
      <MediaDetailModal
        item={mockMovie}
        isOpen={true}
        onClose={onClose}
        onToggleProtect={onToggleProtect}
        onPrune={onPrune}
      />
    );

    // Header & metadata
    expect(screen.getByRole('heading', { name: 'Interstellar' })).toBeDefined();
    expect(screen.getByText('Movie')).toBeDefined();
    expect(screen.getByText('(2014)')).toBeDefined();
    expect(screen.getByText('TMDB: 157336')).toBeDefined();
    expect(screen.getByText('IMDB: tt0816692')).toBeDefined();
    expect(screen.getByText('Plex ID: 12345')).toBeDefined();

    // Size formatted in TB (1.5 TB)
    expect(screen.getAllByText('1.46 TB').length).toBeGreaterThan(0);
    expect(screen.getByText('Never Watched')).toBeDefined();

    // Pre-2017 alert
    expect(screen.getByTestId('detail-predates-tracking-alert')).toBeDefined();

    // Instance details
    expect(screen.getByText('4K')).toBeDefined();
    expect(screen.getByText('Cutoff Met')).toBeDefined();

    // Protect editing workflow
    const protectBtn = screen.getByRole('button', { name: 'Protect Item' });
    fireEvent.click(protectBtn);

    const reasonInput = screen.getByPlaceholderText(/Optional protection reason/i);
    fireEvent.change(reasonInput, { target: { value: 'Nolan Masterpiece' } });

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Protect' });
    fireEvent.click(confirmBtn);
    expect(onToggleProtect).toHaveBeenCalledWith('m-detail-1', true, 'Nolan Masterpiece');

    // Prune button
    const pruneBtn = screen.getByRole('button', { name: /Prune Entire Item/i });
    fireEvent.click(pruneBtn);
    expect(onPrune).toHaveBeenCalledWith(mockMovie);

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders series details with seasons table, watch history, and protected state', () => {
    const onClose = vi.fn();
    const onToggleProtect = vi.fn();
    const onPrune = vi.fn();

    render(
      <MediaDetailModal
        item={mockSeries}
        isOpen={true}
        onClose={onClose}
        onToggleProtect={onToggleProtect}
        onPrune={onPrune}
      />
    );

    // Series badge & protection
    expect(screen.getByText('TV Series')).toBeDefined();
    expect(screen.getByText('Protected')).toBeDefined();
    expect(screen.getByText('TVDB: 79168')).toBeDefined();
    expect(screen.getByText('Reason: "All-time Masterpiece"')).toBeDefined();

    // Instance with missing file & cutoff unmet
    expect(screen.getByText('Missing File')).toBeDefined();
    expect(screen.getByText('Cutoff Unmet')).toBeDefined();

    // Seasons table
    expect(screen.getByText('Specials (Season 0)')).toBeDefined();
    expect(screen.getAllByText('Season 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Unmonitored')).toBeDefined();
    expect(screen.getByText('Monitored')).toBeDefined();

    // Prune season (disabled when show is protected)
    const pruneSeasonBtns = screen.getAllByTitle('Show is protected');
    expect(pruneSeasonBtns.length).toBeGreaterThan(0);
    expect(pruneSeasonBtns[0]).toHaveProperty('disabled', true);

    // Watch stats table
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getAllByText('13').length).toBeGreaterThan(0);

    // Unprotect button click
    const unprotectBtn = screen.getByRole('button', { name: /Protected \(Click to Unprotect\)/i });
    fireEvent.click(unprotectBtn);
    expect(onToggleProtect).toHaveBeenCalledWith('s-detail-1', false);
  });

  it('triggers instance-specific prune when Prune Copy button is clicked on an instance card', () => {
    const onPrune = vi.fn();

    render(
      <MediaDetailModal
        item={mockMovie}
        isOpen={true}
        onClose={vi.fn()}
        onToggleProtect={vi.fn()}
        onPrune={onPrune}
      />
    );

    const pruneCopyBtn = screen.getByRole('button', { name: /Prune Copy/i });
    fireEvent.click(pruneCopyBtn);
    expect(onPrune).toHaveBeenCalledWith(mockMovie, undefined, ['radarr-4k']);
  });
});
