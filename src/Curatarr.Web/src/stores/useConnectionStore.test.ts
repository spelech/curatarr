import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConnectionStore } from './useConnectionStore';

describe('useConnectionStore', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connections: [],
      discoveredServices: [],
      isScanning: false,
      scanError: undefined,
    });
    vi.restoreAllMocks();
  });

  it('discoverServices populates discoveredServices on success', async () => {
    const mockServices = [
      {
        id: 'docker-sonarr4k',
        connectionType: 0,
        name: 'sonarr4k',
        baseUrl: 'http://sonarr4k:8989',
        discoverySource: 'Docker',
        isConfigured: false,
        tierTag: '4K',
        containerName: 'sonarr4k',
        port: 8989,
      },
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockServices,
    } as Response);

    const result = await useConnectionStore.getState().discoverServices();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('sonarr4k');
    expect(useConnectionStore.getState().discoveredServices).toHaveLength(1);
    expect(useConnectionStore.getState().isScanning).toBe(false);
  });
});
