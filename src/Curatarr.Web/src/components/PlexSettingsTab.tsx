import React, { useEffect, useState } from 'react';
import { Server, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Loader2, Save, Wrench } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useConnectionStore } from '../stores/useConnectionStore';
import { PlexOnboardingModal } from './PlexOnboardingModal';

export const PlexSettingsTab: React.FC = () => {
  const {
    settings,
    plexStatus,
    fetchSettings,
    saveSettings,
    fetchPlexStatus,
  } = useSettingsStore();

  const { connections, fetchConnections, testConnection, testResults } = useConnectionStore();

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [adminUsernames, setAdminUsernames] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSavingAuth, setIsSavingAuth] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchPlexStatus();
    fetchConnections();
  }, [fetchSettings, fetchPlexStatus, fetchConnections]);

  useEffect(() => {
    if (settings) {
      setAuthEnabled(settings.authEnabled ?? true);
      setAdminUsernames(settings.adminUsernames ?? '');
    }
  }, [settings]);

  const plexConn = connections.find((c) => c.connectionType === 3);
  const testResult = plexConn ? testResults[plexConn.id] : null;

  const handleTestPlex = async () => {
    if (plexConn) {
      await testConnection(plexConn);
    }
  };

  const handleSaveAuthSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSavingAuth(true);
    setSaveSuccess(false);

    const ok = await saveSettings({
      ...settings,
      authEnabled,
      adminUsernames,
    });

    setIsSavingAuth(false);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Bound Plex Media Server Status */}
      <div className="bg-[#070c09] border border-[#14231a] rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#14231a] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Plex Media Server Binding
              </h2>
              <p className="text-xs text-slate-400">
                Primary media server used for library matching, watch history, and user authentication
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOnboardingOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black transition flex items-center gap-1.5 shadow-sm self-start sm:self-auto cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>{plexStatus?.isBound ? 'Change / Reconfigure Server' : 'Connect Plex Server'}</span>
          </button>
        </div>

        {plexStatus?.isBound && plexConn ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#040705] border border-[#14231a] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Server Name</span>
                <span className="text-xs font-bold text-white">{plexStatus.serverName || plexConn.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Base URL</span>
                <span className="text-xs font-mono text-emerald-400">{plexConn.baseUrl}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Machine Identifier</span>
                <span className="text-xs font-mono text-slate-300 truncate max-w-[200px]" title={plexStatus.machineIdentifier || ''}>
                  {plexStatus.machineIdentifier || 'Configured via URL'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#14231a]">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Connection Status</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {plexConn.lastStatus || 'Connected'}
                  </span>
                  <button
                    type="button"
                    onClick={handleTestPlex}
                    className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
                    title="Test connection now"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#040705] border border-[#14231a] p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Access & History Governance</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Curatarr uses this Plex server to synchronize library sections and native watch history.
                  Only users who belong to this Plex server can sign in and manage protection requests.
                </p>
              </div>

              {testResult && (
                <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                  <span className="truncate">{testResult.message || (testResult.success ? 'Plex connection verified' : 'Connection failed')}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-[#14231a] rounded-xl p-8 text-center bg-[#040705]/50 space-y-3">
            <Server className="w-10 h-10 text-amber-400/50 mx-auto" />
            <div>
              <h3 className="text-sm font-semibold text-white">No Plex Server Bound</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Connect your Plex Media Server using the Overseerr-style discovery wizard to enable library matching and user authentication.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Launch Plex Setup Wizard</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Authentication Settings */}
      <div className="bg-[#070c09] border border-[#14231a] rounded-2xl p-6 shadow-sm space-y-5">
        <div className="border-b border-[#14231a] pb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Authentication & Admin Access Control</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Configure Plex OAuth enforcement and designated administrator usernames.
          </p>
        </div>

        <form onSubmit={handleSaveAuthSettings} className="space-y-4">
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Authentication settings saved successfully.</span>
            </div>
          )}

          {/* Auth Enabled Toggle */}
          <div className="flex items-center justify-between p-4 bg-[#040705] border border-[#14231a] rounded-xl">
            <div>
              <span className="text-xs font-bold text-white block">Require Plex Authentication</span>
              <span className="text-[11px] text-slate-400">
                When enabled, visitors must sign in via Plex. Disabling auth allows local unauthenticated admin access.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={authEnabled}
                onChange={(e) => setAuthEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#0f1a14] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Admin Usernames */}
          <div className="p-4 bg-[#040705] border border-[#14231a] rounded-xl space-y-2">
            <label htmlFor="admin-usernames-input" className="block text-xs font-bold text-white">
              Designated Administrator Usernames
            </label>
            <input
              id="admin-usernames-input"
              type="text"
              value={adminUsernames}
              onChange={(e) => setAdminUsernames(e.target.value)}
              placeholder="e.g. steven, admin@example.com (comma-separated)"
              className="w-full bg-[#070c09] border border-[#14231a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500 transition"
            />
            <p className="text-[11px] text-slate-400">
              Users with these Plex usernames or emails are automatically granted Administrator privileges on login.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingAuth}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSavingAuth ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Auth Settings</span>
            </button>
          </div>
        </form>
      </div>

      {/* Onboarding Wizard Modal */}
      <PlexOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => {
          setIsOnboardingOpen(false);
          fetchPlexStatus();
          fetchConnections();
        }}
      />
    </div>
  );
};
