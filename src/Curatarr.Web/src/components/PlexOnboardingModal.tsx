import React, { useEffect, useState } from 'react';
import { Server, CheckCircle2, AlertCircle, Loader2, X, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useConnectionStore } from '../stores/useConnectionStore';
import { PlexServerResource } from '../types/api';

interface PlexOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlexOnboardingModal: React.FC<PlexOnboardingModalProps> = ({ isOpen, onClose }) => {
  const {
    discoveredPlexServers,
    isFetchingPlexServers,
    isBindingPlex,
    fetchDiscoveredPlexServers,
    bindPlexServer,
    fetchPlexStatus,
  } = useSettingsStore();

  const fetchConnections = useConnectionStore((s) => s.fetchConnections);

  const [selectedServer, setSelectedServer] = useState<PlexServerResource | null>(null);
  const [serverName, setServerName] = useState('');
  const [machineId, setMachineId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isManual, setIsManual] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDiscoveredPlexServers();
    }
  }, [isOpen, fetchDiscoveredPlexServers]);

  // When servers are fetched, auto-select the first owned server or first server
  useEffect(() => {
    if (discoveredPlexServers.length > 0 && !selectedServer && !isManual) {
      const best = discoveredPlexServers.find((s) => s.owned) || discoveredPlexServers[0];
      handleSelectServer(best);
    }
  }, [discoveredPlexServers, selectedServer, isManual]);

  const handleSelectServer = (server: PlexServerResource) => {
    setSelectedServer(server);
    setServerName(server.name);
    setMachineId(server.clientIdentifier);
    setApiKey(server.accessToken || '');

    // Select the best connection URI: prefer local HTTP, then any local, then first
    const localHttp = server.connections.find((c) => c.local && c.protocol === 'http');
    const localAny = server.connections.find((c) => c.local);
    const chosenConn = localHttp || localAny || server.connections[0];

    if (chosenConn) {
      setBaseUrl(chosenConn.uri);
    } else {
      setBaseUrl('http://localhost:32400');
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!baseUrl || !apiKey) {
      setStatusMessage({ type: 'error', text: 'Base URL and Plex Token are required.' });
      return;
    }

    const result = await bindPlexServer({
      machineIdentifier: machineId || undefined,
      name: serverName || 'Plex Media Server',
      baseUrl,
      apiKey,
    });

    if (result.success) {
      setStatusMessage({ type: 'success', text: `Successfully connected & bound to ${serverName || 'Plex Media Server'}!` });
      await fetchConnections();
      await fetchPlexStatus();
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setStatusMessage({ type: 'error', text: result.message || 'Failed to connect to Plex Media Server.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plex-onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-xl bg-[#070c09] border border-[#14231a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#14231a] flex items-center justify-between bg-[#040705]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 id="plex-onboarding-title" className="text-base font-bold text-white tracking-tight">
                Connect Your Plex Media Server
              </h2>
              <p className="text-xs text-slate-400">
                Overseerr-style server discovery and library binding
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0f1a14] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleConnect} className="p-6 space-y-5">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Mode Switcher: Discovered vs Manual */}
          <div className="flex items-center justify-between text-xs border-b border-[#14231a] pb-3">
            <span className="text-slate-300 font-medium">
              {isManual ? 'Manual Server Configuration' : 'Discovered Plex Servers'}
            </span>
            <div className="flex items-center gap-3">
              {!isManual && (
                <button
                  type="button"
                  onClick={() => fetchDiscoveredPlexServers()}
                  disabled={isFetchingPlexServers}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetchingPlexServers ? 'animate-spin' : ''}`} />
                  <span>Re-scan</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsManual(!isManual)}
                className="text-xs text-slate-400 hover:text-white underline transition cursor-pointer"
              >
                {isManual ? 'Use Discovered Servers' : 'Enter Manually'}
              </button>
            </div>
          </div>

          {/* Discovered Server Selector */}
          {!isManual && (
            <div className="space-y-2">
              {isFetchingPlexServers ? (
                <div className="p-8 border border-dashed border-[#14231a] rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs gap-2 bg-[#040705]/50">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  <span>Querying Plex.tv for your media servers...</span>
                </div>
              ) : discoveredPlexServers.length === 0 ? (
                <div className="p-5 border border-dashed border-[#14231a] rounded-xl text-center text-xs text-slate-400 bg-[#040705]/50 space-y-2">
                  <p>No Plex Media Servers found on your Plex account.</p>
                  <button
                    type="button"
                    onClick={() => setIsManual(true)}
                    className="text-emerald-400 hover:underline font-medium"
                  >
                    Switch to manual configuration
                  </button>
                </div>
              ) : (
                <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                  {discoveredPlexServers.map((server) => {
                    const isSelected = selectedServer?.clientIdentifier === server.clientIdentifier;
                    return (
                      <button
                        type="button"
                        key={server.clientIdentifier}
                        onClick={() => handleSelectServer(server)}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                            : 'bg-[#040705] border-[#14231a] hover:border-[#1e3827] text-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{server.name}</span>
                            {server.owned ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Owner
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                Shared
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                            ID: {server.clientIdentifier.slice(0, 16)}...
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Connection Details Form */}
          <div className="space-y-3.5 bg-[#040705] border border-[#14231a] p-4 rounded-xl">
            <div>
              <label htmlFor="plex-name-input" className="block text-xs font-semibold text-slate-300 mb-1">
                Server Display Name
              </label>
              <input
                id="plex-name-input"
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Plex Media Server"
                className="w-full bg-[#070c09] border border-[#14231a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label htmlFor="plex-url-input" className="block text-xs font-semibold text-slate-300 mb-1">
                Base URL (IP / Hostname with Port)
              </label>
              <input
                id="plex-url-input"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://192.168.1.50:32400"
                className="w-full bg-[#070c09] border border-[#14231a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500 transition"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                For Docker containers on the same host, use your LAN IP (e.g. <code>http://192.168.1.x:32400</code>).
              </p>
            </div>

            <div>
              <label htmlFor="plex-token-input" className="block text-xs font-semibold text-slate-300 mb-1">
                Plex Auth Token (X-Plex-Token)
              </label>
              <input
                id="plex-token-input"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Auto-populated from Plex.tv"
                className="w-full bg-[#070c09] border border-[#14231a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500 transition"
                required
              />
            </div>

            {machineId && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-0.5">
                  Machine Identifier (Authoritative Server ID)
                </label>
                <div className="text-[11px] font-mono text-slate-300 bg-[#070c09] px-3 py-1.5 rounded-lg border border-[#14231a] truncate">
                  {machineId}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
            >
              Configure Later
            </button>
            <button
              type="submit"
              disabled={isBindingPlex || !baseUrl || !apiKey}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/40 transition flex items-center gap-1.5 cursor-pointer"
            >
              {isBindingPlex ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save & Connect Server</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
