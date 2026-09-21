/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Header } from './Header';
import { useCatalogStore } from '../stores/useCatalogStore';

describe('Header component', () => {
  beforeEach(() => {
    useCatalogStore.setState({
      isSyncing: false,
      prunedNotification: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders title, version badge, and navigation buttons', () => {
    const onOpenSettings = vi.fn();
    const onOpenAudit = vi.fn();

    render(<Header onOpenSettings={onOpenSettings} onOpenAudit={onOpenAudit} />);

    expect(screen.getByText('Curatarr')).toBeDefined();
    expect(screen.getByText('v1.2.0')).toBeDefined();

    const auditBtn = screen.getByRole('button', { name: /Audit Log/i });
    fireEvent.click(auditBtn);
    expect(onOpenAudit).toHaveBeenCalledTimes(1);

    const settingsBtn = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('triggers sync when Sync Now is clicked', () => {
    const triggerSyncSpy = vi.spyOn(useCatalogStore.getState(), 'triggerSync').mockResolvedValue();

    render(<Header onOpenSettings={vi.fn()} onOpenAudit={vi.fn()} />);

    const syncBtn = screen.getByRole('button', { name: /Sync Now/i });
    fireEvent.click(syncBtn);

    expect(triggerSyncSpy).toHaveBeenCalledTimes(1);
  });

  it('shows pruned notification banner with Plex refresh button', async () => {
    const refreshPlexSpy = vi.spyOn(useCatalogStore.getState(), 'refreshPlex').mockResolvedValue({
      success: true,
      message: 'Scanned 3 libraries',
    });

    useCatalogStore.setState({
      prunedNotification: { count: 3, bytesFreed: 15 * 1024 * 1024 * 1024 },
    });

    render(<Header onOpenSettings={vi.fn()} onOpenAudit={vi.fn()} />);

    expect(screen.getByText('3 items pruned (15.0 GB freed)')).toBeDefined();

    const refreshPlexBtn = screen.getByRole('button', { name: /Refresh Plex/i });
    fireEvent.click(refreshPlexBtn);

    expect(refreshPlexSpy).toHaveBeenCalledTimes(1);
  });
});
