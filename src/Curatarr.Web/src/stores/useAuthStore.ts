import { create } from 'zustand';
import { AuthMeResponse, CuratarrUser } from '../types/api';

interface AuthState {
  user: CuratarrUser | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  authEnabled: boolean;
  isLoading: boolean;
  isLoggingIn: boolean;
  loginError: string | null;
  activePin: { id: number; code: string; authUrl: string } | null;
  isPreviewingAsGuest: boolean;

  checkAuth: () => Promise<void>;
  startPlexLogin: () => Promise<string | null>;
  claimPlexPin: (pinId: number) => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: CuratarrUser | null) => void;
  setPreviewAsGuest: (preview: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: true,
  authEnabled: true,
  isLoading: true,
  isLoggingIn: false,
  loginError: null,
  activePin: null,
  isPreviewingAsGuest: false,

  setPreviewAsGuest: (preview) => {
    set({ isPreviewingAsGuest: preview });
  },

  setUser: (user) => {
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false
    });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/v1/auth/me');
      if (res.ok) {
        const data: AuthMeResponse = await res.json();
        set({
          user: data.user,
          isAuthenticated: data.authenticated,
          isInitialized: data.initialized ?? true,
          authEnabled: data.authEnabled ?? true,
          isLoading: false
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false
        });
      }
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  },

  startPlexLogin: async () => {
    set({ isLoggingIn: true, loginError: null });
    try {
      const res = await fetch('/api/v1/auth/plex/pin', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`Failed to create Plex PIN (HTTP ${res.status})`);
      }
      const data = await res.json();
      set({ activePin: data });
      return data.authUrl as string;
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to start Plex login';
      set({ isLoggingIn: false, loginError: msg });
      return null;
    }
  },

  claimPlexPin: async (pinId: number) => {
    try {
      const res = await fetch('/api/v1/auth/plex/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinId })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        set({
          isLoggingIn: false,
          loginError: errData.error || `Error claiming PIN (HTTP ${res.status})`
        });
        return false;
      }

      const data = await res.json();
      if (data.success && data.user) {
        set({
          user: data.user,
          isAuthenticated: true,
          isLoggingIn: false,
          loginError: null,
          activePin: null
        });
        return true;
      }

      // If status is "waiting", return false and keep polling
      return false;
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to claim Plex PIN';
      set({ isLoggingIn: false, loginError: msg });
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    set({
      user: null,
      isAuthenticated: false,
      activePin: null,
      isLoggingIn: false,
      isPreviewingAsGuest: false
    });
  }
}));
