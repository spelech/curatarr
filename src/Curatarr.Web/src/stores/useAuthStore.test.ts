import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from './useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isInitialized: true,
      authEnabled: true,
      isLoading: true,
      isLoggingIn: false,
      loginError: null,
      activePin: null,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state and checkAuth successfully for authenticated user', async () => {
    const mockUser = {
      id: 'usr-1',
      plexId: 'plex-123',
      username: 'plexmaster',
      role: 'Admin' as const,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        initialized: true,
        authEnabled: true,
        user: mockUser,
      }),
    } as unknown as Response);

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.username).toBe('plexmaster');
    expect(state.user?.role).toBe('Admin');
    expect(state.isLoading).toBe(false);
  });

  it('should handle unauthenticated checkAuth response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: false,
        initialized: true,
        authEnabled: true,
        user: null,
      }),
    } as unknown as Response);

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('should start Plex login flow and set activePin', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 9988,
        code: 'ABCD-1234',
        authUrl: 'https://app.plex.tv/auth#?pin=ABCD-1234',
      }),
    } as unknown as Response);

    const authUrl = await useAuthStore.getState().startPlexLogin();

    expect(authUrl).toBe('https://app.plex.tv/auth#?pin=ABCD-1234');
    const state = useAuthStore.getState();
    expect(state.activePin?.id).toBe(9988);
    expect(state.activePin?.code).toBe('ABCD-1234');
  });

  it('should claim Plex PIN and update user on success', async () => {
    useAuthStore.setState({
      activePin: { id: 9988, code: 'ABCD-1234', authUrl: 'https://app.plex.tv/auth#?pin=ABCD-1234' },
    });

    const mockUser = {
      id: 'usr-guest',
      plexId: 'plex-456',
      username: 'guestuser',
      role: 'Guest' as const,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        user: mockUser,
      }),
    } as unknown as Response);

    const claimed = await useAuthStore.getState().claimPlexPin(9988);

    expect(claimed).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.username).toBe('guestuser');
    expect(state.user?.role).toBe('Guest');
    expect(state.activePin).toBeNull();
  });

  it('should logout and clear user session', async () => {
    useAuthStore.setState({
      user: { id: 'usr-1', plexId: '1', username: 'admin', role: 'Admin' },
      isAuthenticated: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as unknown as Response);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.isPreviewingAsGuest).toBe(false);
  });

  it('should toggle isPreviewingAsGuest state', () => {
    expect(useAuthStore.getState().isPreviewingAsGuest).toBe(false);

    useAuthStore.getState().setPreviewAsGuest(true);
    expect(useAuthStore.getState().isPreviewingAsGuest).toBe(true);

    useAuthStore.getState().setPreviewAsGuest(false);
    expect(useAuthStore.getState().isPreviewingAsGuest).toBe(false);
  });
});
