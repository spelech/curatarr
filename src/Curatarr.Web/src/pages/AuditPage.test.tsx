/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AuditPage } from './AuditPage';

describe('AuditPage component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          logs: [
            {
              id: 'audit-1',
              mediaItemId: 'm-1',
              title: 'The Matrix',
              mediaType: 'Movie',
              seasonNumber: null,
              bytesFreed: 25 * 1024 * 1024 * 1024,
              actor: 'Admin',
              details: 'Pruned via manual single delete',
              addedToImportExclusion: true,
              executedAt: '2026-03-01T15:30:00Z',
            },
            {
              id: 'audit-2',
              mediaItemId: 'm-2',
              title: 'Breaking Bad',
              mediaType: 'Series',
              seasonNumber: 1,
              bytesFreed: 15 * 1024 * 1024 * 1024,
              actor: 'AutomatedRule',
              details: 'Pruned Season 1 due to inactivity',
              addedToImportExclusion: false,
              executedAt: '2026-03-02T16:00:00Z',
            },
          ],
          totalBytesFreed: 40 * 1024 * 1024 * 1024,
        }),
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('fetches and renders audit log records and metrics', async () => {
    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('Forensic Audit Log')).toBeDefined();
      expect(screen.getByText('The Matrix')).toBeDefined();
      expect(screen.getByText('Breaking Bad')).toBeDefined();
      expect(screen.getByText('Exclusion List')).toBeDefined();
    });
  });

  it('filters audit records by search query', async () => {
    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('The Matrix')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/Search deleted titles/i);
    fireEvent.change(searchInput, { target: { value: 'Matrix' } });

    expect(screen.getByText('The Matrix')).toBeDefined();
    expect(screen.queryByText('Breaking Bad')).toBeNull();
  });

  it('filters audit records by media type toggle', async () => {
    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('The Matrix')).toBeDefined();
    });

    const seriesBtn = screen.getByRole('button', { name: /Series/i });
    fireEvent.click(seriesBtn);

    expect(screen.queryByText('The Matrix')).toBeNull();
    expect(screen.getByText('Breaking Bad')).toBeDefined();
  });
});
