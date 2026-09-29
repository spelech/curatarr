import { create } from 'zustand';
import { CuratarrSettings, ManagedUser, PlexBindingStatus, PlexServerResource } from '../types/api';

interface SettingsState {
  settings: CuratarrSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Plex Server Binding (Overseerr-style)
  plexStatus: PlexBindingStatus | null;
  discoveredPlexServers: PlexServerResource[];
  isFetchingPlexServers: boolean;
  isBindingPlex: boolean;

  // User Management
  users: ManagedUser[];
  isFetchingUsers: boolean;

  fetchSettings: () => Promise<void>;
  saveSettings: (settings: CuratarrSettings) => Promise<boolean>;
  fetchPlexStatus: () => Promise<PlexBindingStatus | null>;
  fetchDiscoveredPlexServers: (token?: string) => Promise<PlexServerResource[]>;
  bindPlexServer: (req: { machineIdentifier?: string; name?: string; baseUrl: string; apiKey: string }) => Promise<{ success: boolean; message?: string }>;
  fetchUsers: () => Promise<void>;
  updateUserRole: (id: string, role: 'Admin' | 'Guest') => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
}

export const DEFAULT_SETTINGS: CuratarrSettings = {
  movieSpaceHogThresholdBytes: 20 * 1024 * 1024 * 1024,
  movie4kSpaceHogThresholdBytes: 50 * 1024 * 1024 * 1024,
  seriesEpisodeSpaceHogThresholdBytes: 2.5 * 1024 * 1024 * 1024,
  staleDays: 180,
  abandonedDays: 90,
  neverWatchedMinAgeDays: 60,
  syncIntervalHours: 1,
  catalogBatchSize: 50,
  sub720pCutoffYear: 2000,
  movieSpaceHogGb: 20.0,
  movie4kSpaceHogGb: 50.0,
  seriesEpisodeSpaceHogGb: 2.5,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,
  isSaving: false,
  error: null,

  plexStatus: null,
  discoveredPlexServers: [],
  isFetchingPlexServers: false,
  isBindingPlex: false,

  users: [],
  isFetchingUsers: false,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/v1/settings');
      if (res.ok) {
        const data: CuratarrSettings = await res.json();
        set({ settings: data, isLoading: false });
      } else {
        set({ isLoading: false, error: 'Failed to load settings.' });
      }
    } catch (err: unknown) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Network error loading settings.' });
    }
  },

  saveSettings: async (settings: CuratarrSettings) => {
    set({ isSaving: true, error: null });
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const data: CuratarrSettings = await res.json();
        set({ settings: data, isSaving: false });
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        set({ isSaving: false, error: errData.error || 'Failed to save settings.' });
        return false;
      }
    } catch (err: unknown) {
      set({ isSaving: false, error: err instanceof Error ? err.message : 'Network error saving settings.' });
      return false;
    }
  },

  fetchPlexStatus: async () => {
    try {
      const res = await fetch('/api/v1/plex/status');
      if (res.ok) {
        const data: PlexBindingStatus = await res.json();
        set({ plexStatus: data });
        return data;
      }
      return null;
    } catch {
      return null;
    }
  },

  fetchDiscoveredPlexServers: async (token?: string) => {
    set({ isFetchingPlexServers: true });
    try {
      const url = token ? `/api/v1/plex/servers?token=${encodeURIComponent(token)}` : '/api/v1/plex/servers';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const servers: PlexServerResource[] = data.servers || [];
        set({ discoveredPlexServers: servers, isFetchingPlexServers: false });
        return servers;
      }
      set({ isFetchingPlexServers: false });
      return [];
    } catch {
      set({ isFetchingPlexServers: false });
      return [];
    }
  },

  bindPlexServer: async (req) => {
    set({ isBindingPlex: true });
    try {
      const res = await fetch('/api/v1/plex/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        set((state) => ({
          isBindingPlex: false,
          plexStatus: {
            isBound: true,
            serverName: data.serverName,
            machineIdentifier: data.machineIdentifier,
            hasAdminToken: true,
            connection: data.connection,
          },
          settings: state.settings ? {
            ...state.settings,
            plexServerMachineId: data.machineIdentifier,
            plexServerName: data.serverName,
          } : null,
        }));
        return { success: true };
      }
      set({ isBindingPlex: false });
      return { success: false, message: data.error || data.testResult?.message || 'Failed to bind Plex server.' };
    } catch (err: unknown) {
      set({ isBindingPlex: false });
      return { success: false, message: err instanceof Error ? err.message : 'Network error binding Plex server.' };
    }
  },

  fetchUsers: async () => {
    set({ isFetchingUsers: true });
    try {
      const res = await fetch('/api/v1/auth/users');
      if (res.ok) {
        const data: ManagedUser[] = await res.json();
        set({ users: data, isFetchingUsers: false });
      } else {
        set({ isFetchingUsers: false });
      }
    } catch {
      set({ isFetchingUsers: false });
    }
  },

  updateUserRole: async (id: string, role: 'Admin' | 'Guest') => {
    try {
      const res = await fetch(`/api/v1/auth/users/${id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        set((state) => ({
          users: state.users.map((u) => (u.id === id ? { ...u, role } : u)),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  deleteUser: async (id: string) => {
    try {
      const res = await fetch(`/api/v1/auth/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        set((state) => ({
          users: state.users.filter((u) => u.id !== id),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
