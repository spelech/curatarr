/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SeasonDrawer } from './SeasonDrawer';
import { Season } from '../types/api';

describe('SeasonDrawer component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders fallback when seasons array is empty', () => {
    render(<SeasonDrawer seasons={[]} onPruneSeason={vi.fn()} />);
    expect(screen.getByText('No seasons found.')).toBeDefined();
  });

  it('renders season list with episode counts, sizes, and prune buttons', () => {
    const onPruneSeason = vi.fn();
    const mockSeasons: Season[] = [
      {
        id: 's-0',
        mediaItemId: 'show-1',
        seasonNumber: 0,
        episodeCount: 2,
        episodeFileCount: 2,
        sizeBytes: 1024 * 1024 * 500, // 500 MB
        isMonitored: true,
      },
      {
        id: 's-1',
        mediaItemId: 'show-1',
        seasonNumber: 1,
        episodeCount: 10,
        episodeFileCount: 10,
        sizeBytes: 1024 * 1024 * 1024 * 5, // 5.0 GB
        isMonitored: true,
      },
    ];

    render(<SeasonDrawer seasons={mockSeasons} onPruneSeason={onPruneSeason} />);

    expect(screen.getByText('Seasons on Disk (2)')).toBeDefined();
    expect(screen.getByText('Specials')).toBeDefined();
    expect(screen.getByText('S1')).toBeDefined();
    expect(screen.getByText('500 MB')).toBeDefined();
    expect(screen.getByText('5.0 GB')).toBeDefined();

    const pruneS1Btn = screen.getByTitle('Prune Season 1');
    fireEvent.click(pruneS1Btn);
    expect(onPruneSeason).toHaveBeenCalledWith(1);
  });
});
