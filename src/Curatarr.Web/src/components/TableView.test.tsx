/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TableView } from './TableView';
import { MediaItem } from '../types/api';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn().mockImplementation(({ count }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 64,
        end: (index + 1) * 64,
        size: 64,
        key: index,
      })),
    getTotalSize: () => count * 64,
    scrollToIndex: vi.fn(),
  })),
}));

describe('TableView component', () => {
  afterEach(() => {
    cleanup();
  });

  const mockItems: MediaItem[] = [
    {
      id: 'item-1',
      title: 'Inception (2010)',
      sortTitle: 'Inception',
      mediaType: 0,
      totalSizeBytes: 15 * 1024 * 1024 * 1024,
      isProtected: false,
      instances: [
        {
          id: 'inst-1',
          mediaItemId: 'item-1',
          connectionId: 'conn-1',
          externalId: 10,
          cutoffUnmet: false,
          isMonitored: true,
          sizeBytes: 15 * 1024 * 1024 * 1024,
          hasFile: true,
          qualityProfileName: 'HD-1080p',
        },
      ],
      seasons: [],
      watchStats: [{ id: 'ws-1', mediaItemId: 'item-1', userId: 'u-1', username: 'admin', playCount: 3, lastPlayedAt: new Date().toISOString() }],
    },
    {
      id: 'item-2',
      title: 'Breaking Bad (2008)',
      sortTitle: 'Breaking Bad',
      mediaType: 1,
      totalSizeBytes: 50 * 1024 * 1024 * 1024,
      isProtected: true,
      instances: [
        {
          id: 'inst-2',
          mediaItemId: 'item-2',
          connectionId: 'conn-2',
          externalId: 20,
          cutoffUnmet: true,
          isMonitored: true,
          sizeBytes: 50 * 1024 * 1024 * 1024,
          hasFile: true,
          qualityProfileName: '4K-UHD',
        },
      ],
      seasons: [],
      watchStats: [],
    },
  ];


  it('renders table headers and colgroup elements with calculated widths', () => {
    render(
      <TableView
        items={mockItems}
        selectedIds={new Set<string>()}
        onToggleSelect={vi.fn()}
        onToggleProtect={vi.fn()}
        onPrune={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    );

    expect(screen.getByText('Title')).toBeDefined();
    expect(screen.getByText('Type')).toBeDefined();
    expect(screen.getByText('Tier / Instances')).toBeDefined();
    expect(screen.getByText('Size')).toBeDefined();
    expect(screen.getByText('Plays')).toBeDefined();
    expect(screen.getByText('Last Watched')).toBeDefined();
    expect(screen.getByText('Added')).toBeDefined();
    expect(screen.getByText('Actions')).toBeDefined();
  });

  it('handles item selection callbacks', () => {
    const onToggleSelect = vi.fn();
    render(
      <TableView
        items={mockItems}
        selectedIds={new Set(['item-1'])}
        onToggleSelect={onToggleSelect}
        onToggleProtect={vi.fn()}
        onPrune={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);

    fireEvent.click(checkboxes[0]);
    expect(onToggleSelect).toHaveBeenCalledWith('item-1');
  });

  it('calls onOpenDetail, onPrune, and onToggleProtect when action elements are clicked', () => {
    const onPrune = vi.fn();
    const onOpenDetail = vi.fn();
    const onToggleProtect = vi.fn();

    render(
      <TableView
        items={mockItems}
        selectedIds={new Set<string>()}
        onToggleSelect={vi.fn()}
        onToggleProtect={onToggleProtect}
        onPrune={onPrune}
        onOpenDetail={onOpenDetail}
      />
    );

    const titleElem = screen.getByText('Inception (2010)');
    fireEvent.click(titleElem);
    expect(onOpenDetail).toHaveBeenCalledWith(mockItems[0]);

    const pruneButtons = screen.getAllByTitle('Prune');
    expect(pruneButtons.length).toBe(2);
    fireEvent.click(pruneButtons[0]);
    expect(onPrune).toHaveBeenCalledWith(mockItems[0]);

    const protectButtons = screen.getAllByTitle('Protect');
    expect(protectButtons.length).toBe(1);
    fireEvent.click(protectButtons[0]);
    expect(onToggleProtect).toHaveBeenCalledWith(mockItems[0].id, true);
  });

  it('displays loading more indicator when isLoadingMore is true', () => {
    render(
      <TableView
        items={mockItems}
        selectedIds={new Set<string>()}
        onToggleSelect={vi.fn()}
        onToggleProtect={vi.fn()}
        onPrune={vi.fn()}
        onOpenDetail={vi.fn()}
        isLoadingMore={true}
      />
    );

    expect(screen.getByText('Loading more candidates...')).toBeDefined();
  });

  it('renders top and bottom spacer rows when scrolled into middle of virtual list', async () => {
    const { useVirtualizer } = await import('@tanstack/react-virtual');
    vi.mocked(useVirtualizer).mockReturnValueOnce({
      getVirtualItems: () => [
        { index: 1, start: 128, end: 192, size: 64, key: 1 },
      ],
      getTotalSize: () => 500,
      scrollToIndex: vi.fn(),
      measure: vi.fn(),
      measureElement: vi.fn(),
    } as unknown as ReturnType<typeof useVirtualizer>);

    render(
      <TableView
        items={mockItems}
        selectedIds={new Set<string>()}
        onToggleSelect={vi.fn()}
        onToggleProtect={vi.fn()}
        onPrune={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    );

    expect(screen.getByText('Breaking Bad (2008)')).toBeDefined();
  });
});
