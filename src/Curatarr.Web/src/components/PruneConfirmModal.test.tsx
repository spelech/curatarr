/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PruneConfirmModal } from './PruneConfirmModal';
import { MediaItem } from '../types/api';

describe('PruneConfirmModal component', () => {
  afterEach(() => {
    cleanup();
  });

  const multiInstanceMovie: MediaItem = {
    id: 'm-hamilton',
    title: 'Hamilton',
    sortTitle: 'hamilton',
    mediaType: 0,
    year: 2020,
    totalSizeBytes: 31.9 * 1024 * 1024 * 1024,
    isProtected: false,
    instances: [
      {
        id: 'inst-hd',
        mediaItemId: 'm-hamilton',
        connectionId: 'conn-radarr-hd',
        externalId: 101,
        cutoffUnmet: false,
        isMonitored: true,
        sizeBytes: 11.1 * 1024 * 1024 * 1024,
        hasFile: true,
        resolution: '1080p',
        qualityProfileName: 'HD-1080p',
      },
      {
        id: 'inst-4k',
        mediaItemId: 'm-hamilton',
        connectionId: 'conn-radarr-4k',
        externalId: 102,
        cutoffUnmet: false,
        isMonitored: true,
        sizeBytes: 20.8 * 1024 * 1024 * 1024,
        hasFile: true,
        resolution: '4K',
        qualityProfileName: 'Ultra-HD',
      },
    ],
    seasons: [],
    watchStats: [],
  };

  it('renders correctly for multi-instance item and allows selecting only 4K', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <PruneConfirmModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        items={[multiInstanceMovie]}
        initialTargetConnectionIds={['conn-radarr-4k']}
      />
    );

    // Header
    expect(screen.getByText('Confirm Deletion')).toBeDefined();
    expect(screen.getByText('Hamilton')).toBeDefined();

    // Preservation notice should appear because only 4K is selected
    expect(screen.getByText(/Preserved copy:/i)).toBeDefined();

    // 20.8 GB should be displayed in the modal
    expect(screen.getAllByText(/20\.8 GB/i).length).toBeGreaterThan(0);

    // Click confirm
    const deleteBtn = screen.getByRole('button', { name: /Confirm & Delete/i });
    fireEvent.click(deleteBtn);

    expect(onConfirm).toHaveBeenCalledWith(['conn-radarr-4k'], false);
  });

  it('allows toggling instances and updates selection and exclude option', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <PruneConfirmModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        items={[multiInstanceMovie]}
      />
    );

    // Initially all instances are selected
    expect(screen.getAllByText('HD-1080p').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ultra-HD').length).toBeGreaterThan(0);

    // Toggle 1080p off by clicking its button
    const hdBtn = screen.getByText('HD-1080p').closest('button');
    expect(hdBtn).not.toBeNull();
    if (hdBtn) {
      fireEvent.click(hdBtn);
    }

    // Toggle exclude from import list checkbox
    const checkbox = screen.getByLabelText(/Add to Import Exclusion List/i);
    fireEvent.click(checkbox);

    // Click confirm
    const deleteBtn = screen.getByRole('button', { name: /Confirm & Delete/i });
    fireEvent.click(deleteBtn);

    expect(onConfirm).toHaveBeenCalledWith(['conn-radarr-4k'], true);
  });
});
