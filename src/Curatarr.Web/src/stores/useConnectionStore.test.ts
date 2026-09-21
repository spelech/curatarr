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

  it('fetchConnections sets connections and toggles isLoading', async () => {
    const mockConnections = [
      {
        id: 'conn-1',
        connectionType: 1,
        name: 'Radarr Main',
        baseUrl: 'http://radarr:7878',
        apiKey: 'key1',
        isEnabled: true,
      },
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnections,
    } as Response);

    await useConnectionStore.getState().fetchConnections();

    expect(useConnectionStore.getState().connections).toEqual(mockConnections);
    expect(useConnectionStore.getState().isLoading).toBe(false);
  });

  it('saveConnection posts connection data and re-fetches connections', async () => {
    let postBody: { name?: string } | null = null;
    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url === '/api/v1/connections' && opts?.method === 'POST') {
        postBody = JSON.parse(opts?.body as string);
        return { ok: true } as Response;
      }
      if (url === '/api/v1/connections' && (!opts || !opts.method)) {
        return { ok: true, json: async () => [{ id: 'conn-new', name: 'New Conn' }] } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    const success = await useConnectionStore.getState().saveConnection({
      name: 'New Conn',
      baseUrl: 'http://localhost:7878',
    });

    expect(success).toBe(true);
    expect((postBody as { name?: string } | null)?.name).toBe('New Conn');
    expect(useConnectionStore.getState().connections).toHaveLength(1);
  });

  it('deleteConnection sends DELETE request and re-fetches connections', async () => {
    let deletedUrl = '';
    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (opts?.method === 'DELETE') {
        deletedUrl = url;
        return { ok: true } as Response;
      }
      return { ok: true, json: async () => [] } as Response;
    });

    const success = await useConnectionStore.getState().deleteConnection('conn-delete-1');

    expect(success).toBe(true);
    expect(deletedUrl).toBe('/api/v1/connections/conn-delete-1');
  });

  it('testConnection returns test outcome and stores result for connection', async () => {
    const mockResult = {
      success: true,
      version: '5.1.0',
      message: 'Connection successful',
      latencyMs: 42,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult,
    } as Response);

    const res = await useConnectionStore.getState().testConnection({
      id: 'conn-test-1',
      baseUrl: 'http://radarr:7878',
    });

    expect(res.success).toBe(true);
    expect(res.latencyMs).toBe(42);
    expect(useConnectionStore.getState().testResults['conn-test-1']).toEqual(mockResult);
  });

  it('handles error states across fetch, discover, save, delete, and test', async () => {
    // 1. fetchConnections error
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false } as Response);
    await useConnectionStore.getState().fetchConnections();
    expect(useConnectionStore.getState().isLoading).toBe(false);

    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Fetch failed'));
    await useConnectionStore.getState().fetchConnections();
    expect(useConnectionStore.getState().isLoading).toBe(false);

    // 2. discoverServices error
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const discFail = await useConnectionStore.getState().discoverServices();
    expect(discFail).toHaveLength(0);
    expect(useConnectionStore.getState().scanError).toBe('Failed to scan: HTTP 500');

    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Discovery timeout'));
    await useConnectionStore.getState().discoverServices();
    expect(useConnectionStore.getState().scanError).toBe('Discovery timeout');

    // 3. saveConnection error
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false } as Response);
    const saveFail1 = await useConnectionStore.getState().saveConnection({});
    expect(saveFail1).toBe(false);

    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Save error'));
    const saveFail2 = await useConnectionStore.getState().saveConnection({});
    expect(saveFail2).toBe(false);

    // 4. deleteConnection error
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false } as Response);
    const delFail1 = await useConnectionStore.getState().deleteConnection('bad-id');
    expect(delFail1).toBe(false);

    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Delete error'));
    const delFail2 = await useConnectionStore.getState().deleteConnection('bad-id');
    expect(delFail2).toBe(false);

    // 5. testConnection error
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'));
    const testFail = await useConnectionStore.getState().testConnection({ id: 'bad-conn' });
    expect(testFail.success).toBe(false);
    expect(testFail.message).toBe('Connection refused');
    expect(useConnectionStore.getState().testResults['bad-conn']?.success).toBe(false);
  });
});
