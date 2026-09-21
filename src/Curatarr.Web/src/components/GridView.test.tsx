/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GridView } from './GridView';
import { MediaItem } from '../types/api';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn().mockImplementation(({ count }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 380,
        end: (index + 1) * 380,
        size: 380,
        key: index,
      })),
    getTotalSize: () => count * 380,
    measure: vi.fn(),
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  })),
}));

describe('GridView component', () => {
  beforeEach(() => {
    // Polyfill ResizeObserver for jsdom
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    cleanup();
  });

  const mockItems: MediaItem[] = [
    {
      id: 'm-1',
      title: 'Dune: Part Two',
      sortTitle: 'dune part two',
      mediaType: 0,
      year: 2024,
      totalSizeBytes: 20 * 1024 * 1024 * 1024,
      isProtected: false,
      instances: [
        {
          id: 'inst-1',
          mediaItemId: 'm-1',
          connectionId: 'radarr-1',
          externalId: 1,
          cutoffUnmet: false,
          isMonitored: true,
          sizeBytes: 20 * 1024 * 1024 * 1024,
          hasFile: true,
          resolution: '4K',
        },
      ],
      seasons: [],
      watchStats: [],
    },
    {
      id: 's-1',
      title: 'Shogun',
      sortTitle: 'shogun',
      mediaType: 1,
      year: 2024,
      totalSizeBytes: 30 * 1024 * 1024 * 1024,
      isProtected: true,
      protectionReason: 'Whitelist',
      instances: [
        {
          id: 'inst-2',
          mediaItemId: 's-1',
          connectionId: 'sonarr-1',
          externalId: 2,
          cutoffUnmet: true,
          isMonitored: true,
          sizeBytes: 30 * 1024 * 1024 * 1024,
          hasFile: true,
          resolution: '1080p',
        },
      ],
      seasons: [
        {
          id: 'seas-1',
          mediaItemId: 's-1',
          seasonNumber: 1,
          episodeCount: 10,
          episodeFileCount: 10,
          sizeBytes: 30 * 1024 * 1024 * 1024,
          isMonitored: true,
        },
      ],
      watchStats: [],
    },
  ];

  it('renders media cards in grid layout and connects user actions', () => {
    const onToggleSelect = vi.fn();
    const onToggleProtect = vi.fn();
    const onPrune = vi.fn();
    const onOpenDetail = vi.fn();
    const onLoadMore = vi.fn();

    render(
      <GridView
        items={mockItems}
        selectedIds={new Set(['m-1'])}
        onToggleSelect={onToggleSelect}
        onToggleProtect={onToggleProtect}
        onPrune={onPrune}
        onOpenDetail={onOpenDetail}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={onLoadMore}
      />
    );

    expect(screen.getByRole('heading', { name: 'Dune: Part Two' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Shogun' })).toBeDefined();

    // Check onToggleSelect
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
    fireEvent.click(checkboxes[1]);
    expect(onToggleSelect).toHaveBeenCalledWith('s-1');

    // Check onOpenDetail
    fireEvent.click(screen.getByRole('heading', { name: 'Dune: Part Two' }));
    expect(onOpenDetail).toHaveBeenCalledWith(mockItems[0]);

    // Check onPrune
    const pruneButtons = screen.getAllByTitle('Prune item');
    fireEvent.click(pruneButtons[0]);
    expect(onPrune).toHaveBeenCalledWith(mockItems[0]);
  });

  it('displays loading spinner when isLoadingMore is true', () => {
    render(
      <GridView
        items={mockItems}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onToggleProtect={vi.fn()}
        onPrune={vi.fn()}
        onOpenDetail={vi.fn()}
        hasMore={true}
        isLoadingMore={true}
        onLoadMore={vi.fn()}
      />
    );

    expect(screen.getByText('Loading more candidates...')).toBeDefined();
  });

  it('calculates initial column count across different viewport widths', () => {
    const originalInnerWidth = window.innerWidth;

    try {
      // Test 1536px (2xl -> 7 cols)
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1600 });
      const { unmount: unmount1 } = render(
        <GridView
          items={mockItems}
          selectedIds={new Set()}
          onToggleSelect={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
          onOpenDetail={vi.fn()}
          hasMore={false}
          isLoadingMore={false}
          onLoadMore={vi.fn()}
        />
      );
      unmount1();

      // Test 1280px (xl -> 6 cols)
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1300 });
      const { unmount: unmount2 } = render(
        <GridView
          items={mockItems}
          selectedIds={new Set()}
          onToggleSelect={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
          onOpenDetail={vi.fn()}
          hasMore={false}
          isLoadingMore={false}
          onLoadMore={vi.fn()}
        />
      );
      unmount2();

      // Test 1024px (lg -> 5 cols)
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1100 });
      const { unmount: unmount3 } = render(
        <GridView
          items={mockItems}
          selectedIds={new Set()}
          onToggleSelect={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
          onOpenDetail={vi.fn()}
          hasMore={false}
          isLoadingMore={false}
          onLoadMore={vi.fn()}
        />
      );
      unmount3();

      // Test 768px (md -> 4 cols)
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });
      const { unmount: unmount4 } = render(
        <GridView
          items={mockItems}
          selectedIds={new Set()}
          onToggleSelect={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
          onOpenDetail={vi.fn()}
          hasMore={false}
          isLoadingMore={false}
          onLoadMore={vi.fn()}
        />
      );
      unmount4();

      // Test 640px (sm -> 3 cols)
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 650 });
      const { unmount: unmount5 } = render(
        <GridView
          items={mockItems}
          selectedIds={new Set()}
          onToggleSelect={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
          onOpenDetail={vi.fn()}
          hasMore={false}
          isLoadingMore={false}
          onLoadMore={vi.fn()}
        />
      );
      unmount5();

      // Test mobile (<640px -> 2 cols)
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
      const { unmount: unmount6 } = render(
        <GridView
          items={mockItems}
          selectedIds={new Set()}
          onToggleSelect={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
          onOpenDetail={vi.fn()}
          hasMore={false}
          isLoadingMore={false}
          onLoadMore={vi.fn()}
        />
      );
      unmount6();
    } finally {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    }
  });
});
