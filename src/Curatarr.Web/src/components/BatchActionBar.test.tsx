/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BatchActionBar } from './BatchActionBar';
import { MediaItem } from '../types/api';

describe('BatchActionBar component', () => {
  afterEach(() => {
    cleanup();
  });

  const mockItems: MediaItem[] = [
    {
      id: 'item-1',
      title: 'Movie 1',
      sortTitle: 'Movie 1',
      mediaType: 0,
      totalSizeBytes: 5 * 1024 * 1024 * 1024,
      isProtected: false,
      instances: [],
      seasons: [],
      watchStats: [],
    },
    {
      id: 'item-2',
      title: 'Movie 2',
      sortTitle: 'Movie 2',
      mediaType: 0,
      totalSizeBytes: 10 * 1024 * 1024 * 1024,
      isProtected: false,
      instances: [],
      seasons: [],
      watchStats: [],
    },
  ];

  it('renders nothing when selectedCount is 0', () => {
    const { container } = render(
      <BatchActionBar
        selectedCount={0}
        selectedItems={[]}
        onBatchProtect={vi.fn()}
        onBatchPrune={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders count, formatted reclaimable size, and action buttons', () => {
    const onBatchProtect = vi.fn();
    const onBatchPrune = vi.fn();
    const onClear = vi.fn();

    render(
      <BatchActionBar
        selectedCount={2}
        selectedItems={mockItems}
        onBatchProtect={onBatchProtect}
        onBatchPrune={onBatchPrune}
        onClear={onClear}
      />
    );

    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('selected')).toBeDefined();
    expect(screen.getByText('(15.0 GB reclaimable)')).toBeDefined();

    const protectBtn = screen.getByRole('button', { name: /Protect All/i });
    fireEvent.click(protectBtn);
    expect(onBatchProtect).toHaveBeenCalledTimes(1);

    const pruneBtn = screen.getByRole('button', { name: /Batch Prune/i });
    fireEvent.click(pruneBtn);
    expect(onBatchPrune).toHaveBeenCalledTimes(1);

    const clearBtn = screen.getByTitle('Clear Selection');
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
