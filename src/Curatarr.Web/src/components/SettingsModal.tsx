import React, { useEffect, useState } from 'react';
import { Settings, Plus, Trash2, CheckCircle2, XCircle, X, Radio, Loader2, Sparkles, SlidersHorizontal } from 'lucide-react';
import { useConnectionStore } from '../stores/useConnectionStore';
import { DiscoveredService, ServiceConnection } from '../types/api';
import { ThresholdSettingsTab } from './ThresholdSettingsTab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
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
    if (isOpen) {
      fetchConnections();
    }
  }, [isOpen, fetchConnections]);

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

  if (!isOpen) return null;

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
      case 3: return 'Plex';
      case 4: return 'Overseerr';
      default: return 'Service';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Settings</h2>
              <p className="text-xs text-slate-400">Configure service connections, storage limits, and curation rules</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('connections')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'connections'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Service Connections</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('thresholds')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'thresholds'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Rules & Thresholds</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {activeTab === 'thresholds' ? (
            <ThresholdSettingsTab />
          ) : editingConn ? (
            <form onSubmit={handleSave} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3.5 text-xs">
              <div className="font-semibold text-white">
                {editingConn.id ? 'Edit Connection' : 'Add New Connection'}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Service Type</label>
                  <select
                    value={editingConn.connectionType ?? 0}
                    onChange={(e) => setEditingConn({ ...editingConn, connectionType: parseInt(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-md p-2 text-slate-200"
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
                    placeholder="e.g. Sonarr 4K"
                    className="w-full bg-slate-900 border border-slate-800 rounded-md p-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Base URL</label>
                  <input
                    type="url"
                    required
                    value={editingConn.baseUrl || ''}
                    onChange={(e) => setEditingConn({ ...editingConn, baseUrl: e.target.value })}
                    placeholder="http://sonarr4k:8989"
                    className="w-full bg-slate-900 border border-slate-800 rounded-md p-2 text-slate-200"
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
                    className="w-full bg-slate-900 border border-slate-800 rounded-md p-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Tier / Tag (e.g. HD, 4K, Anime)</label>
                <input
                  type="text"
                  value={editingConn.tierTag || ''}
                  onChange={(e) => setEditingConn({ ...editingConn, tierTag: e.target.value })}
                  placeholder="HD"
                  className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-md p-2 text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingConn(null)}
                  className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium"
                >
                  Save Connection
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Auto-Discovery Section */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-400">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                        Auto-Discovery
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                          Docker & Network
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Scan Docker containers and candidate media network hosts
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white text-xs font-medium transition shadow-sm"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Scan Services
                      </>
                    )}
                  </button>
                </div>

                {scanError && (
                  <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
                    {scanError}
                  </div>
                )}

                {hasScanned && !isScanning && discoveredServices.length === 0 && (
                  <div className="p-3 border border-slate-800 rounded-lg text-center text-[11px] text-slate-500">
                    No unconfigured services detected on Docker socket or default network hostnames.
                  </div>
                )}

                {discoveredServices.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-medium text-slate-400">
                      Detected Services ({discoveredServices.length})
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {discoveredServices.map((svc) => (
                        <div
                          key={svc.id}
                          className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-white text-xs">{svc.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                                {getTypeName(svc.connectionType)} {svc.tierTag ? `(${svc.tierTag})` : ''}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                                {svc.discoverySource}
                              </span>
                              {svc.isConfigured && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                                  Configured
                                </span>
                              )}
                            </div>
                            <div className="text-slate-500 font-mono text-[11px]">
                              {svc.baseUrl}
                              {svc.containerName && ` • container: ${svc.containerName}`}
                            </div>
                          </div>

                          <div>
                            {svc.isConfigured ? (
                              <span className="text-[11px] text-emerald-400 font-medium px-2 py-1">
                                Already Added
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddDiscovered(svc)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-medium transition"
                              >
                                <Plus className="w-3 h-3" />
                                Add Connection
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-slate-300">Active Connections ({connections.length})</span>
                <button
                  onClick={() => setEditingConn({ connectionType: 0, isEnabled: true, name: '', baseUrl: '', apiKey: '' })}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600/20 text-sky-300 border border-sky-500/30 hover:bg-sky-600/30 text-xs font-medium transition"
                >
                  <Plus className="w-3 h-3" />
                  Add Manual Connection
                </button>
              </div>

              {connections.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
                  No connections configured yet. Click "Scan Services" above or "Add Manual Connection".
                </div>
              ) : (
                connections.map((c) => {
                  const testRes = testResults[c.id];

                  return (
                    <div
                      key={c.id}
                      className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{c.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                            {getTypeName(c.connectionType)} {c.tierTag ? `(${c.tierTag})` : ''}
                          </span>
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">{c.baseUrl}</div>
                        {testRes && (
                          <div className={`flex items-center gap-1 text-[11px] mt-1 ${testRes.success ? 'text-emerald-400' : 'text-red-400'}`}>
                            {testRes.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span>{testRes.message || (testRes.success ? `Connected (${testRes.latencyMs}ms)` : 'Failed')}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => testConnection(c)}
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition"
                        >
                          Test
                        </button>
                        <button
                          onClick={() => setEditingConn(c)}
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteConnection(c.id)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
