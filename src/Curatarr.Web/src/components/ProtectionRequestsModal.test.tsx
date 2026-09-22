/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProtectionRequestsModal } from './ProtectionRequestsModal';
import { useCatalogStore } from '../stores/useCatalogStore';
import { PendingProtectionRequest } from '../types/api';

describe('ProtectionRequestsModal component', () => {
  afterEach(() => {
    cleanup();
  });

  const mockRequests: PendingProtectionRequest[] = [
    {
      id: 'req-1',
      mediaItemId: 'item-101',
      title: 'Blade Runner 2049',
      year: 2017,
      mediaType: 0,
      totalSizeBytes: 35 * 1024 * 1024 * 1024,
      userId: 'user-bob',
      username: 'Bob',
      reason: 'Favorite sci-fi movie!',
      createdAt: '2026-09-20T10:00:00Z',
    },
  ];

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ProtectionRequestsModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders empty state when there are no pending requests', () => {
    useCatalogStore.setState({ pendingProtectionRequests: [] });
    render(<ProtectionRequestsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('All Caught Up!')).toBeDefined();
    expect(screen.getByText(/no pending protection requests/i)).toBeDefined();
  });

  it('renders request details and handles Approve action', async () => {
    const approveSpy = vi.fn().mockResolvedValue(true);

    useCatalogStore.setState({
      pendingProtectionRequests: mockRequests,
      approveProtectionRequest: approveSpy,
    });

    const onClose = vi.fn();
    render(<ProtectionRequestsModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('Pending Protection Requests')).toBeDefined();
    expect(screen.getByText('Blade Runner 2049')).toBeDefined();
    expect(screen.getByText('(2017)')).toBeDefined();
    expect(screen.getByText('35.0 GB')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('"Favorite sci-fi movie!"')).toBeDefined();

    // Click Approve
    const approveBtn = screen.getByRole('button', { name: /Approve & Protect/i });
    fireEvent.click(approveBtn);
    expect(approveSpy).toHaveBeenCalledWith('item-101', 'Favorite sci-fi movie!');

    // Close
    const closeBtns = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('handles Dismiss action', async () => {
    const dismissSpy = vi.fn().mockResolvedValue(true);

    useCatalogStore.setState({
      pendingProtectionRequests: mockRequests,
      dismissProtectionRequest: dismissSpy,
    });

    render(<ProtectionRequestsModal isOpen={true} onClose={vi.fn()} />);

    // Click Dismiss
    const dismissBtn = screen.getByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissBtn);
    expect(dismissSpy).toHaveBeenCalledWith('item-101');
  });
});
