/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useAuthStore } from '../stores/useAuthStore';

describe('Sidebar component', () => {
  beforeEach(() => {
    useCatalogStore.setState({
      isSyncing: false,
      pendingProtectionRequests: [],
    });
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        plexId: 'plex-1',
        username: 'AdminUser',
        role: 'Admin',
      },
      isAuthenticated: true,
      isPreviewingAsGuest: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders branding and primary navigation links in expanded mode', () => {
    const onToggleCollapse = vi.fn();
    const onOpenSettings = vi.fn();
    const onOpenAudit = vi.fn();
    const onOpenProtectionRequests = vi.fn();

    render(
      <Sidebar
        isCollapsed={false}
        onToggleCollapse={onToggleCollapse}
        isMobileOpen={false}
        onCloseMobile={vi.fn()}
        onOpenSettings={onOpenSettings}
        onOpenAudit={onOpenAudit}
        onOpenProtectionRequests={onOpenProtectionRequests}
      />
    );

    expect(screen.getByText('Curatarr')).toBeDefined();
    expect(screen.getByText('Library Intelligence')).toBeDefined();
    expect(screen.getByText('Library Curation')).toBeDefined();
    expect(screen.getByText('Protected Items')).toBeDefined();
    expect(screen.getByText('Audit History')).toBeDefined();
    expect(screen.getByText('Settings & Rules')).toBeDefined();

    // Test clicking navigation items
    fireEvent.click(screen.getByRole('button', { name: /Settings & Rules/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Audit History/i }));
    expect(onOpenAudit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Protected Items/i }));
    expect(onOpenProtectionRequests).toHaveBeenCalledTimes(1);
  });

  it('calls onChangeView with the correct view name when navigation buttons are clicked', () => {
    const onChangeView = vi.fn();

    render(
      <Sidebar
        currentView="curation"
        onChangeView={onChangeView}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        isMobileOpen={false}
        onCloseMobile={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Protected Items/i }));
    expect(onChangeView).toHaveBeenCalledWith('protected');

    fireEvent.click(screen.getByRole('button', { name: /Audit History/i }));
    expect(onChangeView).toHaveBeenCalledWith('audit');

    fireEvent.click(screen.getByRole('button', { name: /Settings & Rules/i }));
    expect(onChangeView).toHaveBeenCalledWith('settings');

    fireEvent.click(screen.getByRole('button', { name: /Library Curation/i }));
    expect(onChangeView).toHaveBeenCalledWith('curation');
  });

  it('calls onToggleCollapse when collapse button is clicked', () => {
    const onToggleCollapse = vi.fn();

    render(
      <Sidebar
        isCollapsed={false}
        onToggleCollapse={onToggleCollapse}
        isMobileOpen={false}
        onCloseMobile={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenAudit={vi.fn()}
        onOpenProtectionRequests={vi.fn()}
      />
    );

    const collapseBtn = screen.getByRole('button', { name: 'Collapse sidebar' });
    fireEvent.click(collapseBtn);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('displays pending request count badge when triage items exist', () => {
    useCatalogStore.setState({
      pendingProtectionRequests: [
        {
          id: 'req-1',
          mediaItemId: 'm-1',
          title: 'Dune Part Two',
          year: 2024,
          mediaType: 0,
          totalSizeBytes: 1024 * 1024 * 1024,
          userId: 'u-1',
          username: 'steve',
          reason: 'Please keep',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });

    render(
      <Sidebar
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        isMobileOpen={false}
        onCloseMobile={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenAudit={vi.fn()}
        onOpenProtectionRequests={vi.fn()}
      />
    );

    expect(screen.getByText('1')).toBeDefined();
  });

  it('renders mobile drawer when isMobileOpen is true and closes on close button click', () => {
    const onCloseMobile = vi.fn();

    render(
      <Sidebar
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        isMobileOpen={true}
        onCloseMobile={onCloseMobile}
        onOpenSettings={vi.fn()}
        onOpenAudit={vi.fn()}
        onOpenProtectionRequests={vi.fn()}
      />
    );

    const closeBtn = screen.getByRole('button', { name: 'Close navigation' });
    fireEvent.click(closeBtn);
    expect(onCloseMobile).toHaveBeenCalledTimes(1);
  });
});
