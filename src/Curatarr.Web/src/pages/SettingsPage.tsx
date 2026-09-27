import React, { useEffect, useState } from 'react';
import {
  Settings,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Radio,
  Loader2,
  Sparkles,
  SlidersHorizontal,
  Pencil,
} from 'lucide-react';
import { useConnectionStore } from '../stores/useConnectionStore';
import { DiscoveredService, ServiceConnection } from '../types/api';
import { ThresholdSettingsTab } from '../components/ThresholdSettingsTab';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connections' | 'thresholds'>('connections');
  const {
    connections,
    fetchConnections,
    saveConnection,
    deleteConnection,
    testConnection,
    testResults,
    discoveredServices,
    isScanning,
    scanError,
    discoverServices,
  } = useConnectionStore();

  const [editingConn, setEditingConn] = useState<Partial<ServiceConnection> | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleScan = async () => {
    setHasScanned(true);
    await discoverServices();
  };

  const handleAddDiscovered = (discovered: DiscoveredService) => {
    setEditingConn({
      connectionType: discovered.connectionType,
      name: discovered.name,
      baseUrl: discovered.baseUrl,
      apiKey: '',
      tierTag: discovered.tierTag || '',
      isEnabled: true,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConn) return;
    const ok = await saveConnection(editingConn);
    if (ok) setEditingConn(null);
  };

  const getTypeName = (type: number) => {
    switch (type) {
      case 0: return 'Sonarr';
      case 1: return 'Radarr';
      case 2: return 'Tautulli';
      case 3: return 'Plex Media Server';
      case 4: return 'Overseerr / Jellyseerr';
      default: return 'Service';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Hero */}
      <div className="bg-[#070c09] border border-[#14231a] rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Settings & Governance Rules
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Configure Arr media servers, Plex/Tautulli activity watchers, and retention rule thresholds.
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-[#040705] border border-[#14231a] rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('connections')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'connections'
                  ? 'bg-emerald-500 text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Service Connections</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('thresholds')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'thresholds'
                  ? 'bg-emerald-500 text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Rules & Thresholds</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'thresholds' ? (
        <div className="bg-[#070c09] border border-[#14231a] rounded-2xl p-6 shadow-sm">
          <ThresholdSettingsTab />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Actions: Add New & Auto Discover */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleScan}
                disabled={isScanning}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#070c09] hover:bg-[#0f1a14] text-emerald-400 border border-[#14231a] hover:border-emerald-500/40 transition flex items-center gap-2 disabled:opacity-50 min-h-[34px]"
              >
                {isScanning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Auto-Discover Local Services</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                setEditingConn({
                  connectionType: 0,
                  name: '',
                  baseUrl: '',
                  apiKey: '',
                  tierTag: '',
                  isEnabled: true,
                })
              }
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition flex items-center gap-1.5 shadow-sm min-h-[34px]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Connection</span>
            </button>
          </div>

          {/* Auto-Discovery Results */}
          {hasScanned && (
            <div className="bg-[#070c09] border border-[#14231a] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Network Discovery Results
                </span>
                {isScanning && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
                    <Loader2 className="w-3 h-3 animate-spin" /> Probing Docker & localhost...
                  </span>
                )}
              </div>

              {scanError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                  {scanError}
                </div>
              )}

              {!isScanning && discoveredServices.length === 0 && !scanError && (
                <div className="text-xs text-slate-400 italic">
                  No new services discovered on standard local ports. You can still add them manually.
                </div>
              )}

              {discoveredServices.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                  {discoveredServices.map((svc) => (
                    <div
                      key={svc.baseUrl}
                      className="bg-[#040705] border border-[#14231a] p-3 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{svc.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{svc.baseUrl}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddDiscovered(svc)}
                        className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-md font-semibold text-xs transition"
                      >
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Connection Editor Form */}
          {editingConn && (
            <form
              onSubmit={handleSave}
              className="bg-[#070c09] border border-[#14231a] rounded-2xl p-5 space-y-4 text-xs shadow-md"
            >
              <div className="font-bold text-sm text-white">
                {editingConn.id ? 'Edit Connection' : 'Add New Connection'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-slate-400 block mb-1">Service Type</label>
                  <select
                    value={editingConn.connectionType ?? 0}
                    onChange={(e) =>
                      setEditingConn({ ...editingConn, connectionType: parseInt(e.target.value) })
                    }
                    className="w-full bg-[#040705] border border-[#14231a] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={0}>Sonarr</option>
                    <option value={1}>Radarr</option>
                    <option value={2}>Tautulli</option>
                    <option value={3}>Plex Media Server</option>
                    <option value={4}>Overseerr / Jellyseerr</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Friendly Name</label>
                  <input
                    type="text"
                    required
                    value={editingConn.name || ''}
                    onChange={(e) => setEditingConn({ ...editingConn, name: e.target.value })}
                    placeholder="e.g. Sonarr 4K, Radarr HD"
                    className="w-full bg-[#040705] border border-[#14231a] rounded-lg p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-slate-400 block mb-1">Base URL</label>
                  <input
                    type="url"
                    required
                    value={editingConn.baseUrl || ''}
                    onChange={(e) => setEditingConn({ ...editingConn, baseUrl: e.target.value })}
                    placeholder="http://sonarr4k:8989"
                    className="w-full bg-[#040705] border border-[#14231a] rounded-lg p-2.5 text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">API Key / Token</label>
                  <input
                    type="password"
                    required
                    value={editingConn.apiKey || ''}
                    onChange={(e) => setEditingConn({ ...editingConn, apiKey: e.target.value })}
                    placeholder="API Key or Plex Token"
                    className="w-full bg-[#040705] border border-[#14231a] rounded-lg p-2.5 text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  Tier / Tag Label (e.g. HD, 4K, Anime)
                </label>
                <input
                  type="text"
                  value={editingConn.tierTag || ''}
                  onChange={(e) => setEditingConn({ ...editingConn, tierTag: e.target.value })}
                  placeholder="e.g. HD, 4K"
                  className="w-full max-w-xs bg-[#040705] border border-[#14231a] rounded-lg p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#14231a]">
                <button
                  type="button"
                  onClick={() => setEditingConn(null)}
                  className="px-4 py-2 rounded-lg bg-[#040705] border border-[#14231a] text-slate-300 hover:text-white hover:bg-[#0f1a14] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition shadow-sm"
                >
                  Save Connection
                </button>
              </div>
            </form>
          )}

          {/* Active Connections List */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white">Configured Service Connections</h2>

            {connections.length === 0 ? (
              <div className="border border-dashed border-[#17261e] rounded-2xl p-12 text-center text-slate-400 text-xs bg-[#070c09]/40">
                No connections configured yet. Use "Auto-Discover" or click "Add Connection" to connect your Arr, Plex, or Overseerr instances.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {connections.map((conn) => {
                  const testRes = testResults[conn.id];
                  return (
                    <div
                      key={conn.id}
                      className="bg-[#070c09] border border-[#14231a] rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-emerald-500/30 transition shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{conn.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0b130e] text-emerald-400 border border-emerald-900/40">
                              {getTypeName(conn.connectionType)}
                            </span>
                            {conn.tierTag && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                {conn.tierTag}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-1">{conn.baseUrl}</div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingConn(conn)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0f1a14] border border-transparent transition"
                            title="Edit connection"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteConnection(conn.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent transition"
                            title="Delete connection"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#14231a] text-xs">
                        <div className="flex items-center gap-1.5">
                          {testRes && (
                            <div className="flex items-center gap-1">
                              {testRes.success ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                              )}
                              <span
                                className={`text-[11px] font-medium ${
                                  testRes.success ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {testRes.message}
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => testConnection(conn)}
                          className="px-3 py-1 bg-[#040705] hover:bg-[#0f1a14] border border-[#14231a] hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 rounded-lg font-semibold text-xs transition"
                        >
                          Test Connection
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
