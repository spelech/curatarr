/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AuditLogModal } from './AuditLogModal';

describe('AuditLogModal component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<AuditLogModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('fetches and renders audit log entries and reclaimed disk space', async () => {
    const mockLogs = [
      {
        id: 'audit-1',
        mediaItemId: 'm-1',
        title: 'Old Movie (2000)',
        mediaType: 'Movie',
        seasonNumber: null,
        bytesFreed: 50 * 1024 * 1024 * 1024,
        details: 'Deleted 1080p file from Radarr HD',
        addedToImportExclusion: true,
        actor: 'Admin User',
        executedAt: new Date().toISOString(),
      },
      {
        id: 'audit-2',
        mediaItemId: 's-1',
        title: 'Old TV Show',
        mediaType: 'Series',
        seasonNumber: 2,
        bytesFreed: 15 * 1024 * 1024 * 1024,
        details: 'Deleted Season 2 files',
        addedToImportExclusion: false,
        actor: 'MCP Agent',
        executedAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ logs: mockLogs, totalBytesFreed: 65 * 1024 * 1024 * 1024 }),
    } as unknown as Response);

    const onClose = vi.fn();
    render(<AuditLogModal isOpen={true} onClose={onClose} />);

    expect(screen.getByRole('heading', { name: 'Forensic Audit Log' })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Old Movie (2000)')).toBeDefined();
    });

    expect(screen.getByText('Old TV Show')).toBeDefined();
    expect(screen.getByText('Exclusion Added')).toBeDefined();
    expect(screen.getByText('65.0 GB')).toBeDefined();
    expect(screen.getByText('+50.0 GB')).toBeDefined();

    // Close button
    const closeBtns = screen.getAllByRole('button');
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders empty state when no deletions recorded yet', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ logs: [], totalBytesFreed: 0 }),
    } as unknown as Response);

    render(<AuditLogModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No deletions recorded yet.')).toBeDefined();
    });
  });
});
