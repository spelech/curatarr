/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProtectedItemsPage } from './ProtectedItemsPage';
import { useCatalogStore } from '../stores/useCatalogStore';
import { MediaItem } from '../types/api';

describe('ProtectedItemsPage component', () => {
  const mockProtectedItem: MediaItem = {
    id: 'm-prot-1',
    title: 'Interstellar',
    sortTitle: 'interstellar',
    mediaType: 0,
    year: 2014,
    totalSizeBytes: 30 * 1024 * 1024 * 1024,
    isProtected: true,
    protectionReason: 'Favorite Sci-Fi',
    instances: [],
    seasons: [],
    watchStats: [],
  };

  beforeEach(() => {
    useCatalogStore.setState({
      pendingProtectionRequests: [
        {
          id: 'req-1',
          mediaItemId: 'm-1',
          title: 'Oppenheimer',
          year: 2023,
          mediaType: 0,
          totalSizeBytes: 15 * 1024 * 1024 * 1024,
          userId: 'u-1',
          username: 'alice',
          reason: 'Keep for movie night',
          createdAt: '2026-03-01T10:00:00Z',
        },
        {
          id: 'req-2',
          mediaItemId: 'm-2',
          title: 'Severance',
          year: 2022,
          mediaType: 1,
          totalSizeBytes: 40 * 1024 * 1024 * 1024,
          userId: 'u-2',
          username: 'bob',
          reason: 'Still watching season 1',
          createdAt: '2026-03-02T12:00:00Z',
        },
      ],
      protectedItems: [mockProtectedItem],
      isLoadingProtected: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders hero metrics and both waiting and protected items', () => {
    render(<ProtectedItemsPage />);

    expect(screen.getByText('Protected Items')).toBeDefined();
    expect(screen.getByText(/2 Waiting/)).toBeDefined();
    expect(screen.getByText(/1 Protected/)).toBeDefined();

    // Waiting items
    expect(screen.getByText('Oppenheimer')).toBeDefined();
    expect(screen.getByText('Severance')).toBeDefined();
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('bob')).toBeDefined();
    expect(screen.getByText(/"Keep for movie night"/)).toBeDefined();

    // Protected item
    expect(screen.getByText('Interstellar')).toBeDefined();
    expect(screen.getByText(/Favorite Sci-Fi/)).toBeDefined();
  });

  it('switches between status tabs: All, Waiting, and Protected', () => {
    render(<ProtectedItemsPage />);

    // Click 'Waiting for Review' tab
    fireEvent.click(screen.getByRole('button', { name: /Waiting for Review/i }));
    expect(screen.getByText('Oppenheimer')).toBeDefined();
    expect(screen.getByText('Severance')).toBeDefined();
    expect(screen.queryByText('Interstellar')).toBeNull();

    // Click 'Actively Protected' tab
    fireEvent.click(screen.getByRole('button', { name: /Actively Protected/i }));
    expect(screen.getByText('Interstellar')).toBeDefined();
    expect(screen.queryByText('Oppenheimer')).toBeNull();
    expect(screen.queryByText('Severance')).toBeNull();

    // Click 'All Items' tab
    fireEvent.click(screen.getByRole('button', { name: /All Items/i }));
    expect(screen.getByText('Oppenheimer')).toBeDefined();
    expect(screen.getByText('Interstellar')).toBeDefined();
  });

  it('filters items across both lists with search query', () => {
    render(<ProtectedItemsPage />);

    const searchInput = screen.getByPlaceholderText(/Search by title/i);

    // Search for protected item
    fireEvent.change(searchInput, { target: { value: 'Interstellar' } });
    expect(screen.getByText('Interstellar')).toBeDefined();
    expect(screen.queryByText('Oppenheimer')).toBeNull();
    expect(screen.queryByText('Severance')).toBeNull();

    // Search for waiting item
    fireEvent.change(searchInput, { target: { value: 'Oppenheimer' } });
    expect(screen.getByText('Oppenheimer')).toBeDefined();
    expect(screen.queryByText('Interstellar')).toBeNull();
  });

  it('filters by media type (Movies vs Series)', () => {
    render(<ProtectedItemsPage />);

    const seriesBtn = screen.getByRole('button', { name: /Series/i });
    fireEvent.click(seriesBtn);

    expect(screen.getByText('Severance')).toBeDefined();
    expect(screen.queryByText('Oppenheimer')).toBeNull();
    expect(screen.queryByText('Interstellar')).toBeNull();
  });

  it('handles approve action on waiting item', async () => {
    const approveSpy = vi.spyOn(useCatalogStore.getState(), 'approveProtectionRequest').mockResolvedValue(true);

    render(<ProtectedItemsPage />);

    const approveButtons = screen.getAllByRole('button', { name: /Approve & Protect/i });
    fireEvent.click(approveButtons[0]);

    expect(approveSpy).toHaveBeenCalledWith('m-1', 'Keep for movie night');
  });

  it('handles dismiss action on waiting item', async () => {
    const dismissSpy = vi.spyOn(useCatalogStore.getState(), 'dismissProtectionRequest').mockResolvedValue(true);

    render(<ProtectedItemsPage />);

    const dismissButtons = screen.getAllByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissButtons[0]);

    expect(dismissSpy).toHaveBeenCalledWith('m-1');
  });

  it('handles unprotect action on protected item', async () => {
    const toggleSpy = vi.spyOn(useCatalogStore.getState(), 'toggleProtect').mockResolvedValue();

    render(<ProtectedItemsPage />);

    const unprotectButton = screen.getByRole('button', { name: /Unprotect/i });
    fireEvent.click(unprotectButton);

    expect(toggleSpy).toHaveBeenCalledWith('m-prot-1', false);
  });

  it('opens detail modal when clicking item', async () => {
    const onOpenDetail = vi.fn();
    vi.spyOn(useCatalogStore.getState(), 'fetchItemById').mockResolvedValue(mockProtectedItem);

    render(<ProtectedItemsPage onOpenDetail={onOpenDetail} />);

    const interstellarTitle = screen.getByText('Interstellar');
    fireEvent.click(interstellarTitle);

    await waitFor(() => {
      expect(onOpenDetail).toHaveBeenCalledWith(mockProtectedItem);
    });
  });

  it('renders empty states when there are no items', () => {
    useCatalogStore.setState({
      pendingProtectionRequests: [],
      protectedItems: [],
    });

    render(<ProtectedItemsPage />);

    // In 'All Items'
    expect(screen.getByText('Inbox Zero: All Caught Up!')).toBeDefined();

    // In 'Waiting for Review'
    fireEvent.click(screen.getByRole('button', { name: /Waiting for Review/i }));
    expect(screen.getByText('Inbox Zero: All Caught Up!')).toBeDefined();

    // In 'Actively Protected'
    fireEvent.click(screen.getByRole('button', { name: /Actively Protected/i }));
    expect(screen.getByText('No Protected Items Yet')).toBeDefined();
  });
});
