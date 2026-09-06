import React, { useEffect, useState } from 'react';
import { Settings, Plus, Trash2, CheckCircle2, XCircle, X } from 'lucide-react';
import { useConnectionStore } from '../stores/useConnectionStore';
import { ServiceConnection } from '../types/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { connections, fetchConnections, saveConnection, deleteConnection, testConnection, testResults } =
    useConnectionStore();

  const [editingConn, setEditingConn] = useState<Partial<ServiceConnection> | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchConnections();
    }
  }, [isOpen, fetchConnections]);

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
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Service Connections</h2>
              <p className="text-xs text-slate-400">Connect your Arr instances, Plex, and Tautulli</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connections List or Form */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {editingConn ? (
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
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Active Connections ({connections.length})</span>
                <button
                  onClick={() => setEditingConn({ connectionType: 0, isEnabled: true, name: '', baseUrl: '', apiKey: '' })}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600/20 text-sky-300 border border-sky-500/30 hover:bg-sky-600/30 text-xs font-medium transition"
                >
                  <Plus className="w-3 h-3" />
                  Add Connection
                </button>
              </div>

              {connections.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
                  No connections configured yet. Click "Add Connection" to connect your first instance.
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
