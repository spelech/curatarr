/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TriagePage } from './TriagePage';
import { useCatalogStore } from '../stores/useCatalogStore';

describe('TriagePage component', () => {
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
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders triage hero metrics and request list items', () => {
    render(<TriagePage />);

    expect(screen.getByText('Protection Triage')).toBeDefined();
    expect(screen.getByText(/2 Pending/)).toBeDefined();
    expect(screen.getByText('Oppenheimer')).toBeDefined();
    expect(screen.getByText('Severance')).toBeDefined();
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('bob')).toBeDefined();
    expect(screen.getByText(/"Keep for movie night"/)).toBeDefined();
    expect(screen.getByText(/"Still watching season 1"/)).toBeDefined();
  });

  it('filters requests by search query', () => {
    render(<TriagePage />);

    const searchInput = screen.getByPlaceholderText(/Search by title/i);
    fireEvent.change(searchInput, { target: { value: 'Oppenheimer' } });

    expect(screen.getByText('Oppenheimer')).toBeDefined();
    expect(screen.queryByText('Severance')).toBeNull();
  });

  it('filters requests by media type button', () => {
    render(<TriagePage />);

    const seriesBtn = screen.getByRole('button', { name: /Series/i });
    fireEvent.click(seriesBtn);

    expect(screen.queryByText('Oppenheimer')).toBeNull();
    expect(screen.getByText('Severance')).toBeDefined();
  });

  it('handles approve action', async () => {
    const approveSpy = vi.spyOn(useCatalogStore.getState(), 'approveProtectionRequest').mockResolvedValue(true);

    render(<TriagePage />);

    const approveButtons = screen.getAllByRole('button', { name: /Approve & Protect/i });
    fireEvent.click(approveButtons[0]);

    expect(approveSpy).toHaveBeenCalledWith('m-1', 'Keep for movie night');
  });

  it('handles dismiss action', async () => {
    const dismissSpy = vi.spyOn(useCatalogStore.getState(), 'dismissProtectionRequest').mockResolvedValue(true);

    render(<TriagePage />);

    const dismissButtons = screen.getAllByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissButtons[0]);

    expect(dismissSpy).toHaveBeenCalledWith('m-1');
  });

  it('shows empty inbox state when there are no pending requests', () => {
    useCatalogStore.setState({ pendingProtectionRequests: [] });

    render(<TriagePage />);

    expect(screen.getByText('Inbox Zero: All Caught Up!')).toBeDefined();
  });
});
