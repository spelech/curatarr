import { create } from 'zustand';
import { DiscoveredService, ServiceConnection } from '../types/api';

interface ConnectionState {
  connections: ServiceConnection[];
  isLoading: boolean;
  discoveredServices: DiscoveredService[];
  isScanning: boolean;
  scanError?: string;
  testResults: Record<string, { success: boolean; version?: string; message?: string; latencyMs: number }>;

  fetchConnections: () => Promise<void>;
  discoverServices: () => Promise<DiscoveredService[]>;
  saveConnection: (conn: Partial<ServiceConnection>) => Promise<boolean>;
  deleteConnection: (id: string) => Promise<boolean>;
  testConnection: (conn: Partial<ServiceConnection>) => Promise<{ success: boolean; version?: string; message?: string; latencyMs: number }>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  isLoading: false,
  discoveredServices: [],
  isScanning: false,
  scanError: undefined,
  testResults: {},

  fetchConnections: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/v1/connections');
      if (res.ok) {
        const data = await res.json();
        set({ connections: data, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  discoverServices: async () => {
    set({ isScanning: true, scanError: undefined });
    try {
      const res = await fetch('/api/v1/discovery');
      if (res.ok) {
        const data: DiscoveredService[] = await res.json();
        set({ discoveredServices: data, isScanning: false });
        return data;
      } else {
        set({ isScanning: false, scanError: `Failed to scan: HTTP ${res.status}` });
        return [];
      }
    } catch (e: unknown) {
      const msg = (e as Error).message;
      set({ isScanning: false, scanError: msg });
      return [];
    }
  },

  saveConnection: async (conn) => {
    try {
      const res = await fetch('/api/v1/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conn),
      });
      if (res.ok) {
        await get().fetchConnections();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  deleteConnection: async (id) => {
    try {
      const res = await fetch(`/api/v1/connections/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await get().fetchConnections();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  testConnection: async (conn) => {
    try {
      const res = await fetch('/api/v1/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conn),
      });
      const data = await res.json();
      if (conn.id) {
        set((state) => ({
          testResults: { ...state.testResults, [conn.id!]: data },
        }));
      }
      return data;
    } catch (e: unknown) {
      const err = { success: false, message: (e as Error).message, latencyMs: 0 };
      if (conn.id) {
        set((state) => ({
          testResults: { ...state.testResults, [conn.id!]: err },
        }));
      }
      return err;
    }
  },
}));
