import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

export const LoginModal: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isLoggingIn = useAuthStore((s) => s.isLoggingIn);
  const loginError = useAuthStore((s) => s.loginError);
  const activePin = useAuthStore((s) => s.activePin);
  const startPlexLogin = useAuthStore((s) => s.startPlexLogin);
  const claimPlexPin = useAuthStore((s) => s.claimPlexPin);

  const [pollStatus, setPollStatus] = useState<string>('');
  const pollTimerRef = useRef<number | null>(null);

  // Poll for PIN claim while activePin is present
  useEffect(() => {
    if (!activePin) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    setPollStatus('Waiting for authorization on Plex.tv...');

    pollTimerRef.current = window.setInterval(async () => {
      const success = await claimPlexPin(activePin.id);
      if (success) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    }, 1500);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [activePin, claimPlexPin]);

  if (isLoading || isAuthenticated) {
    return null;
  }

  const handleSignInClick = async () => {
    const authUrl = await startPlexLogin();
    if (authUrl) {
      const popup = window.open(authUrl, 'plex_auth_popup', 'width=600,height=700,menubar=no,toolbar=no,location=no');
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        setPollStatus('Popup was blocked by your browser. Please click the authorization link below.');
      }
    }
  };

  const handleCancel = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    useAuthStore.setState({ activePin: null, isLoggingIn: false, loginError: null });
    setPollStatus('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center">
        {/* Logo / Badge */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-6 shadow-inner">
          <svg className="w-9 h-9 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>

        <h2 id="login-modal-title" className="text-2xl font-bold tracking-tight text-white mb-2">
          {isInitialized ? 'Sign in to Curatarr' : 'Welcome to Curatarr'}
        </h2>

        <p className="text-sm text-slate-400 mb-8 max-w-xs">
          {isInitialized
            ? 'Sign in with your Plex account to browse your library and manage protections.'
            : 'Sign in with your Plex account to claim the primary Administrator account and configure your server.'}
        </p>

        {loginError && (
          <div className="w-full mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-left">
            {loginError}
          </div>
        )}

        {isLoggingIn && activePin ? (
          <div className="w-full flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-3 text-amber-400 text-sm font-medium">
              <svg className="animate-spin h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{pollStatus || 'Awaiting Authorization...'}</span>
            </div>

            <p className="text-xs text-slate-400">
              Complete the prompt in the Plex window. PIN code: <span className="font-mono text-slate-200 font-semibold">{activePin.code}</span>
            </p>

            <a
              href={activePin.authUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-400 hover:text-amber-300 underline"
            >
              Click here if the Plex login window did not open
            </a>

            <button
              type="button"
              onClick={handleCancel}
              className="mt-4 px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="w-full space-y-4">
            <button
              type="button"
              onClick={handleSignInClick}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              {/* Plex chevron icon */}
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0L1.5 6v12L12 24l10.5-6V6L12 0zm1.4 17.5l-4.9-5.5 4.9-5.5h3.6l-4.9 5.5 4.9 5.5h-3.6z" />
              </svg>
              <span>Sign in with Plex</span>
            </button>

            <p className="text-[11px] text-slate-400">
              Uses official Plex PIN authentication. No passwords are treated or stored by Curatarr.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
