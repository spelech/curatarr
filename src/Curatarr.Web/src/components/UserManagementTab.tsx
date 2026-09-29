import React, { useEffect, useState } from 'react';
import { Users, User as UserIcon, Trash2, RefreshCw, Loader2, Search, CheckCircle2 } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useAuthStore } from '../stores/useAuthStore';

export const UserManagementTab: React.FC = () => {
  const { users, isFetchingUsers, fetchUsers, updateUserRole, deleteUser } = useSettingsStore();
  const currentUser = useAuthStore((s) => s.user);

  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.plexId.includes(q)
    );
  });

  const handleRoleChange = async (id: string, newRole: 'Admin' | 'Guest') => {
    setUpdatingId(id);
    const ok = await updateUserRole(id, newRole);
    setUpdatingId(null);
    if (ok) {
      setActionSuccess(`Role updated to ${newRole}`);
      setTimeout(() => setActionSuccess(null), 2500);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (id === currentUser?.id) {
      alert('You cannot delete your own active administrator account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove user "${username}"? They will lose access unless they re-authenticate.`)) {
      return;
    }

    setDeletingId(id);
    const ok = await deleteUser(id);
    setDeletingId(null);
    if (ok) {
      setActionSuccess(`User "${username}" removed.`);
      setTimeout(() => setActionSuccess(null), 2500);
    }
  };

  return (
    <div className="bg-[#070c09] border border-[#14231a] rounded-2xl p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#14231a] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Plex User Management
            </h2>
            <p className="text-xs text-slate-400">
              Manage accounts, assign Admin vs. Guest roles, and govern media access
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchUsers()}
          disabled={isFetchingUsers}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#040705] hover:bg-[#0f1a14] text-slate-300 hover:text-white border border-[#14231a] transition flex items-center gap-2 self-start sm:self-auto cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetchingUsers ? 'animate-spin' : ''}`} />
          <span>Refresh Users</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter users by username, email, or Plex ID..."
          className="w-full bg-[#040705] border border-[#14231a] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
        />
      </div>

      {/* Users Table */}
      {isFetchingUsers && users.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-[#14231a] rounded-xl flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading user accounts...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-[#14231a] rounded-xl bg-[#040705]/40">
          No users found matching your search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#14231a]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#040705] border-b border-[#14231a] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Plex ID</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#14231a] bg-[#070c09]">
              {filteredUsers.map((u) => {
                const isCurrent = u.id === currentUser?.id;
                const isUpdating = updatingId === u.id;
                const isDeleting = deletingId === u.id;

                return (
                  <tr key={u.id} className="hover:bg-[#0f1a14]/60 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {u.thumbUrl ? (
                          <img
                            src={u.thumbUrl}
                            alt={u.username}
                            className="w-7 h-7 rounded-full object-cover border border-[#14231a]"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-[#14231a]">
                            <UserIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white truncate">{u.username}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                You
                              </span>
                            )}
                          </div>
                          {u.email && (
                            <span className="text-[11px] text-slate-400 block truncate">{u.email}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {u.plexId}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label={`Role for ${u.username}`}
                          value={u.role}
                          disabled={isUpdating || isCurrent}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as 'Admin' | 'Guest')}
                          className={`bg-[#040705] border border-[#14231a] rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-emerald-500 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            u.role === 'Admin'
                              ? 'text-amber-400 border-amber-500/30'
                              : 'text-slate-300'
                          }`}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Guest">Guest</option>
                        </select>
                        {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id, u.username)}
                          disabled={isDeleting}
                          aria-label={`Remove user ${u.username}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer disabled:opacity-50"
                          title="Remove user"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
