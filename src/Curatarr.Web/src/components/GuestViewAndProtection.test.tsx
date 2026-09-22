import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaCard } from './MediaCard';
import { TableView } from './TableView';
import { MediaDetailModal } from './MediaDetailModal';
import { LoginModal } from './LoginModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useCatalogStore } from '../stores/useCatalogStore';
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

describe('Guest View Mode & Protection Requests Component Tests', () => {
  const baseItem: MediaItem = {
    id: 'item-1',
    title: 'Inception',
    sortTitle: 'Inception',
    mediaType: 0,
    year: 2010,
    totalSizeBytes: 15 * 1024 * 1024 * 1024,
    isProtected: false,
    addedAt: '2024-01-15T12:00:00Z',
    requestedBy: 'alice_plex',
    requestedAt: '2024-01-14T10:00:00Z',
    protectionRequestCount: 2,
    protectionRequests: [
      {
        id: 'pr-1',
        mediaItemId: 'item-1',
        userId: 'usr-bob',
        username: 'bob_the_guest',
        reason: 'Watching this weekend with family!',
        createdAt: '2024-01-20T15:00:00Z',
      },
      {
        id: 'pr-2',
        mediaItemId: 'item-1',
        userId: 'usr-charlie',
        username: 'charlie_guest',
        reason: '',
        createdAt: '2024-01-21T09:00:00Z',
      },
    ],
    instances: [
      {
        id: 'inst-1',
        mediaItemId: 'item-1',
        connectionId: 'conn-1',
        externalId: 101,
        isMonitored: true,
        sizeBytes: 15 * 1024 * 1024 * 1024,
        hasFile: true,
        resolution: '1080p',
        cutoffUnmet: false,
      },
    ],
    seasons: [],
    watchStats: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCatalogStore.setState({
      items: [baseItem],
      selectedIds: new Set(),
    });
  });

  describe('MediaCard Guest Restrictions', () => {
    it('shows checkboxes and prune buttons for Admins', () => {
      useAuthStore.setState({
        user: { id: 'usr-admin', plexId: '1', username: 'admin_user', role: 'Admin' },
        isAuthenticated: true,
      });

      render(
        <MediaCard
          item={baseItem}
          isSelected={false}
          onToggleSelect={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
          onOpenDetail={vi.fn()}
        />
      );

      expect(screen.getByRole('checkbox')).toBeDefined();
      expect(screen.getByTitle('Prune item')).toBeDefined();
      expect(screen.getByTestId('protection-request-count-badge')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
    });

    it('hides checkboxes and prune buttons for Guests, shows protection count badge', () => {
      useAuthStore.setState({
        user: { id: 'usr-guest', plexId: '2', username: 'guest_user', role: 'Guest' },
        isAuthenticated: true,
      });

      render(
        <MediaCard
          item={baseItem}
          isSelected={false}
          onToggleSelect={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
          onOpenDetail={vi.fn()}
        />
      );

      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(screen.queryByTitle('Prune item')).toBeNull();
      expect(screen.getByTestId('protection-request-count-badge')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
    });
  });

  describe('TableView Guest Restrictions', () => {
    it('hides row checkboxes and prune buttons for Guests in TableView', () => {
      useAuthStore.setState({
        user: { id: 'usr-guest', plexId: '2', username: 'guest_user', role: 'Guest' },
        isAuthenticated: true,
      });

      render(
        <TableView
          items={[baseItem]}
          selectedIds={new Set()}
          onToggleSelect={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
          onOpenDetail={vi.fn()}
        />
      );

      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(screen.queryByTitle('Prune')).toBeNull();
      expect(screen.getByTestId('protection-request-count-badge')).toBeDefined();
    });
  });

  describe('MediaDetailModal Overseerr metadata and Protection Requests', () => {
    it('displays Overseerr requester and dates, plus list of protection requesters', () => {
      useAuthStore.setState({
        user: { id: 'usr-admin', plexId: '1', username: 'admin_user', role: 'Admin' },
        isAuthenticated: true,
      });

      render(
        <MediaDetailModal
          item={baseItem}
          isOpen={true}
          onClose={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
        />
      );

      // Overseerr Request Banner
      expect(screen.getByTestId('overseerr-request-banner')).toBeDefined();
      expect(screen.getByText('alice_plex')).toBeDefined();

      // Protection Requests List
      expect(screen.getByText(/Protection Requests \(2\)/)).toBeDefined();
      expect(screen.getByText('bob_the_guest')).toBeDefined();
      expect(screen.getByText('"Watching this weekend with family!"')).toBeDefined();
      expect(screen.getByText('charlie_guest')).toBeDefined();

      // Admin has Whitelist and Prune actions
      expect(screen.getByText('Admin Deletion Protection')).toBeDefined();
      expect(screen.getByText('Prune Entire Item')).toBeDefined();
    });

    it('hides prune buttons for Guests and renders Ask to Protect form', () => {
      useAuthStore.setState({
        user: { id: 'usr-guest2', plexId: '99', username: 'new_guest', role: 'Guest' },
        isAuthenticated: true,
      });

      render(
        <MediaDetailModal
          item={baseItem}
          isOpen={true}
          onClose={vi.fn()}
          onToggleProtect={vi.fn()}
          onPrune={vi.fn()}
        />
      );

      // Guests should not see prune or admin whitelist
      expect(screen.queryByText('Prune Entire Item')).toBeNull();
      expect(screen.queryByText('Admin Deletion Protection')).toBeNull();

      // Guest sees Ask to Protect button
      const askBtn = screen.getByText('Ask to Protect This Item');
      expect(askBtn).toBeDefined();

      // Clicking Ask to Protect opens the reason input
      fireEvent.click(askBtn);
      expect(screen.getByPlaceholderText(/Reason for requesting protection/)).toBeDefined();
      expect(screen.getByText('Submit Request')).toBeDefined();
    });
  });

  describe('LoginModal Authentication Display', () => {
    it('renders Plex Login prompt when unauthenticated and auth is enabled', () => {
      useAuthStore.setState({
        isAuthenticated: false,
        isInitialized: true,
        authEnabled: true,
        isLoading: false,
      });

      render(<LoginModal />);

      expect(screen.getByText('Sign in to Curatarr')).toBeDefined();
      expect(screen.getByText(/Sign in with Plex/i)).toBeDefined();
    });

    it('does not render when user is already authenticated', () => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        authEnabled: true,
        isLoading: false,
      });

      const { container } = render(<LoginModal />);
      expect(container.firstChild).toBeNull();
    });
  });
});
