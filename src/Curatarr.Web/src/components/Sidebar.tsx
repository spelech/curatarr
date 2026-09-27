import React from 'react';
import {
  Layers,
  ShieldAlert,
  History,
  Settings,
  RefreshCw,
  LogOut,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Film,
} from 'lucide-react';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useAuthStore } from '../stores/useAuthStore';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSettings: () => void;
  onOpenAudit: () => void;
  onOpenProtectionRequests: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onOpenSettings,
  onOpenAudit,
  onOpenProtectionRequests,
}) => {
  const isSyncing = useCatalogStore((s) => s.isSyncing);
  const triggerSync = useCatalogStore((s) => s.triggerSync);
  const pendingProtectionRequests = useCatalogStore((s) => s.pendingProtectionRequests);

  const user = useAuthStore((s) => s.user);
  const isPreviewingAsGuest = useAuthStore((s) => s.isPreviewingAsGuest);
  const setPreviewAsGuest = useAuthStore((s) => s.setPreviewAsGuest);
  const logout = useAuthStore((s) => s.logout);

  const isAdmin = (!user || user.role === 'Admin') && !isPreviewingAsGuest;
  const pendingCount = pendingProtectionRequests.length;

  const navItems = [
    {
      id: 'library',
      label: 'Library Curation',
      icon: Film,
      action: () => {
        onCloseMobile();
      },
      isActive: true,
      badge: null,
    },
    ...(isAdmin
      ? [
          {
            id: 'protection_requests',
            label: 'Protection Triage',
            icon: ShieldAlert,
            action: () => {
              onOpenProtectionRequests();
              onCloseMobile();
            },
            isActive: false,
            badge: pendingCount > 0 ? pendingCount : null,
            badgeColor: 'bg-emerald-500 text-black',
          },
          {
            id: 'audit',
            label: 'Audit History',
            icon: History,
            action: () => {
              onOpenAudit();
              onCloseMobile();
            },
            isActive: false,
            badge: null,
          },
          {
            id: 'settings',
            label: 'Settings & Rules',
            icon: Settings,
            action: () => {
              onOpenSettings();
              onCloseMobile();
            },
            isActive: false,
            badge: null,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          role="presentation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Container */}
      <aside
        aria-label="Sidebar navigation"
        className={`fixed md:sticky top-0 left-0 z-50 h-screen bg-[#070c09] border-r border-[#14231a] flex-col justify-between transition-all duration-300 ease-in-out ${
          isMobileOpen
            ? 'flex translate-x-0'
            : 'hidden md:flex md:translate-x-0'
        } ${isCollapsed ? 'md:w-[68px]' : 'md:w-60'} w-64`}
      >
        {/* Top: Brand Header */}
        <div>
          <div className="h-16 border-b border-[#14231a] px-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-extrabold shadow-lg shadow-emerald-950/40 shrink-0">
                <Layers className="w-5 h-5 text-[#070c09]" />
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm tracking-tight text-white">
                      Curatarr
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      v{__APP_VERSION__}
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-medium tracking-wide truncate">
                    Library Intelligence
                  </div>
                </div>
              )}
            </div>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0f1a14] md:hidden transition"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5" aria-label="Main menu">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition group ${
                    item.isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-950/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1a14] border border-transparent'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition ${
                      item.isActive
                        ? 'text-emerald-400'
                        : 'text-slate-400 group-hover:text-emerald-400'
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  )}
                  {!isCollapsed && item.badge !== null && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        item.badgeColor || 'bg-emerald-500 text-black'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Sync, User Profile, Collapse Toggle */}
        <div className="p-3 border-t border-[#14231a] space-y-3 bg-[#050806]/60">
          {/* Sync Now Action */}
          <button
            onClick={() => triggerSync()}
            disabled={isSyncing}
            title="Trigger catalog sync from Arr and Plex"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#0f1a14] hover:bg-[#14231a] text-emerald-400 border border-emerald-900/40 transition disabled:opacity-60 ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin text-emerald-300' : ''}`}
            />
            {!isCollapsed && (
              <span className="truncate">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            )}
          </button>

          {/* User Account Info */}
          {user && (
            <div
              className={`p-2 rounded-xl bg-[#0b130e] border border-[#14231a] flex items-center gap-2.5 ${
                isCollapsed ? 'justify-center p-1.5' : ''
              }`}
            >
              {user.thumbUrl ? (
                <img
                  src={user.thumbUrl}
                  alt={user.username}
                  className="w-7 h-7 rounded-lg object-cover border border-[#17261e] shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-900/60 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
                  {user.username.substring(0, 2).toUpperCase()}
                </div>
              )}

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white text-xs truncate">
                    {user.username}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        isAdmin
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isPreviewingAsGuest ? 'Guest (Preview)' : user.role}
                    </span>
                  </div>
                </div>
              )}

              {!isCollapsed && (
                <div className="flex items-center gap-1">
                  {user.role === 'Admin' && (
                    <button
                      type="button"
                      onClick={() => setPreviewAsGuest(!isPreviewingAsGuest)}
                      title={isPreviewingAsGuest ? 'Exit Guest View' : 'View as Guest'}
                      className={`p-1.5 rounded-lg border transition ${
                        isPreviewingAsGuest
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'text-slate-400 hover:text-white border-transparent hover:bg-[#14231a]'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => logout()}
                    title="Sign out"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Desktop Collapse / Expand Toggle */}
          <div className="hidden md:flex justify-end pt-1">
            <button
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-[#0f1a14] border border-transparent transition"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
