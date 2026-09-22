/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MediaCard } from './MediaCard';
import { MediaItem } from '../types/api';

describe('MediaCard component', () => {
  afterEach(() => {
    cleanup();
  });

  const mockMovie: MediaItem = {
    id: 'movie-1',
    title: 'Inception',
    sortTitle: 'Inception',
    mediaType: 0,
    year: 2010,
    totalSizeBytes: 12 * 1024 * 1024 * 1024,
    isProtected: false,
    instances: [
      {
        id: 'inst-1',
        mediaItemId: 'movie-1',
        connectionId: 'conn-1',
        externalId: 10,
        cutoffUnmet: false,
        isMonitored: true,
        sizeBytes: 12 * 1024 * 1024 * 1024,
        hasFile: true,
        qualityProfileName: 'HD-1080p',
      },
    ],
    seasons: [],
    watchStats: [
      {
        id: 'ws-1',
        mediaItemId: 'movie-1',
        userId: 'u-1',
        username: 'admin',
        playCount: 4,
        lastPlayedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      },
    ],
  };

  const mockSeries: MediaItem = {
    id: 'series-1',
    title: 'Breaking Bad',
    sortTitle: 'Breaking Bad',
    mediaType: 1,
    year: 2008,
    totalSizeBytes: 40 * 1024 * 1024 * 1024,
    isProtected: true,
    protectionReason: 'Favorite',
    instances: [
      {
        id: 'inst-2',
        mediaItemId: 'series-1',
        connectionId: 'conn-2',
        externalId: 20,
        cutoffUnmet: true,
        isMonitored: true,
        sizeBytes: 40 * 1024 * 1024 * 1024,
        hasFile: true,
        qualityProfileName: '4K-UHD',
      },
    ],
    seasons: [
      {
        id: 's-1',
        mediaItemId: 'series-1',
        seasonNumber: 1,
        episodeCount: 7,
        episodeFileCount: 7,
        sizeBytes: 8 * 1024 * 1024 * 1024,
        isMonitored: true,
      },
    ],
    watchStats: [],
  };

  it('renders movie card details accurately', () => {
    const onOpenDetail = vi.fn();
    const onToggleSelect = vi.fn();
    const onToggleProtect = vi.fn();
    const onPrune = vi.fn();

    render(
      <MediaCard
        item={mockMovie}
        isSelected={false}
        onToggleSelect={onToggleSelect}
        onToggleProtect={onToggleProtect}
        onPrune={onPrune}
        onOpenDetail={onOpenDetail}
      />
    );

    expect(screen.getByRole('heading', { name: 'Inception' })).toBeDefined();
    expect(screen.getByText('• 2010')).toBeDefined();
    expect(screen.getByText('12.0 GB')).toBeDefined();
    expect(screen.getByText('4 plays')).toBeDefined();
    expect(screen.getByText('2d ago')).toBeDefined();

    // Check selection checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onToggleSelect).toHaveBeenCalledWith('movie-1');

    // Check open detail
    fireEvent.click(screen.getByRole('heading', { name: 'Inception' }));
    expect(onOpenDetail).toHaveBeenCalledWith(mockMovie);

    // Check prune button
    const pruneBtn = screen.getByTitle('Prune item');
    fireEvent.click(pruneBtn);
    expect(onPrune).toHaveBeenCalledWith(mockMovie);

    // Check protect button
    const protectBtn = screen.getByTitle('Protect from deletion');
    fireEvent.click(protectBtn);
    expect(onToggleProtect).toHaveBeenCalledWith('movie-1', true);
  });

  it('renders series card with protected status and expands seasons drawer', () => {
    const onPrune = vi.fn();

    render(
      <MediaCard
        item={mockSeries}
        isSelected={true}
        onToggleSelect={vi.fn()}
        onToggleProtect={vi.fn()}
        onPrune={onPrune}
        onOpenDetail={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Breaking Bad' })).toBeDefined();
    expect(screen.getByText('• 2008')).toBeDefined();
    expect(screen.getByText('Cutoff')).toBeDefined();
    expect(screen.getByTitle('Protected: Favorite')).toBeDefined();
    expect(screen.getByTitle('Item is protected')).toHaveProperty('disabled', true);

    // Toggle Seasons expander
    const seasonsToggle = screen.getByRole('button', { name: /1 Seasons/i });
    fireEvent.click(seasonsToggle);

    expect(screen.getByText('Seasons on Disk (1)')).toBeDefined();
    expect(screen.getByText('S1')).toBeDefined();

    const pruneSeasonBtn = screen.getByTitle('Prune Season 1');
    fireEvent.click(pruneSeasonBtn);
    expect(onPrune).toHaveBeenCalledWith(mockSeries, 1);
  });

  it('renders multi-instance prune dropdown and triggers specific instance pruning', () => {
    const onPrune = vi.fn();
    const multiInstanceMovie: MediaItem = {
      ...mockMovie,
      id: 'movie-multi',
      instances: [
        {
          id: 'inst-hd',
          mediaItemId: 'movie-multi',
          connectionId: 'conn-radarr-hd',
          externalId: 101,
          cutoffUnmet: false,
          isMonitored: true,
          sizeBytes: 10 * 1024 * 1024 * 1024,
          hasFile: true,
          resolution: '1080p',
          qualityProfileName: 'HD-1080p',
        },
        {
          id: 'inst-4k',
          mediaItemId: 'movie-multi',
          connectionId: 'conn-radarr-4k',
          externalId: 102,
          cutoffUnmet: false,
          isMonitored: true,
          sizeBytes: 25 * 1024 * 1024 * 1024,
          hasFile: true,
          resolution: '4K',
          qualityProfileName: 'Ultra-HD',
        },
      ],
    };

    render(
      <MediaCard
        item={multiInstanceMovie}
        isSelected={false}
        onToggleSelect={vi.fn()}
        onToggleProtect={vi.fn()}
        onPrune={onPrune}
        onOpenDetail={vi.fn()}
      />
    );

    // Clicking prune button should open the dropdown menu
    const pruneBtn = screen.getByTitle(/Choose copy to prune/i);
    fireEvent.click(pruneBtn);

    expect(screen.getByText('Select Copy to Prune')).toBeDefined();
    expect(screen.getByText('Prune All Copies')).toBeDefined();
    expect(screen.getByText('HD-1080p')).toBeDefined();
    expect(screen.getByText('Ultra-HD')).toBeDefined();

    // Clicking specific 4K instance
    const fourKOption = screen.getByText('Ultra-HD');
    fireEvent.click(fourKOption);
    expect(onPrune).toHaveBeenCalledWith(multiInstanceMovie, undefined, ['conn-radarr-4k']);
  });
});
