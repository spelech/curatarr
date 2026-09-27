import React from 'react';
import { Search, Film, Tv, LayoutGrid, List, ArrowUpDown, User, History, Sparkles } from 'lucide-react';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useAuthStore } from '../stores/useAuthStore';

export const ControlBar: React.FC = () => {
  const {
    users,
    selectedUserId,
    setSelectedUserId,
    onlyMyRequests,
    setOnlyMyRequests,
    selectedMediaType,
    setSelectedMediaType,
    selectedResolution,
    setSelectedResolution,
    selectedCutoffUnmet,
    setSelectedCutoffUnmet,
    selectedPre2017Filter,
    setSelectedPre2017Filter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortDesc,
    toggleSortDesc,
    viewMode,
    setViewMode,
    items,
    selectedIds,
    selectAll,
    clearSelection,
  } = useCatalogStore();

  const currentUser = useAuthStore((s) => s.user);
  const selectedUser = users.find((u) => u.userId === selectedUserId);
  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <div className="bg-[#090e0b]/90 border border-[#14231a] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
      {/* Left side: Search & Multi-User filter & Resolution / Cutoff */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search titles..."
            aria-label="Search titles"
            className="w-full pl-8 pr-3 py-1.5 min-h-[28px] bg-[#050806] border border-[#14231a] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs transition"
          />
        </div>

        {/* Multi-User Profile Dropdown */}
        <div className="flex items-center gap-1.5 bg-[#050806] border border-[#14231a] rounded-lg px-2.5 py-0.5 text-slate-300">
          <User className="w-3.5 h-3.5 text-emerald-400" />
          <select
            value={selectedUserId || ''}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            className="bg-transparent border-none text-slate-200 focus:outline-none text-xs cursor-pointer py-1.5 min-h-[28px]"
          >
            <option value="" className="bg-[#070c09] text-slate-200">
              All Users (Combined)
            </option>
            {users.map((u) => (
              <option key={u.userId} value={u.userId} className="bg-[#070c09] text-slate-200">
                {u.friendlyName || u.username}
              </option>
            ))}
          </select>
        </div>

        {/* Resolution Dropdown */}
        <div className="flex items-center gap-1.5 bg-[#050806] border border-[#14231a] rounded-lg px-2.5 py-0.5 text-slate-300">
          <select
            value={selectedResolution || ''}
            onChange={(e) => setSelectedResolution(e.target.value || null)}
            aria-label="Filter resolution"
            className="bg-transparent border-none text-slate-200 focus:outline-none text-xs cursor-pointer py-1.5 min-h-[28px]"
          >
            <option value="" className="bg-[#070c09] text-slate-200">All Resolutions</option>
            <option value="SD" className="bg-[#070c09] text-slate-200">SD (&lt; 720p)</option>
            <option value="720p" className="bg-[#070c09] text-slate-200">720p</option>
            <option value="1080p" className="bg-[#070c09] text-slate-200">1080p</option>
            <option value="4K" className="bg-[#070c09] text-slate-200">4K (2160p)</option>
          </select>
        </div>

        {/* Pre-2017 Watch History Dropdown */}
        <div className="flex items-center gap-1.5 bg-[#050806] border border-[#14231a] rounded-lg px-2.5 py-0.5 text-slate-300">
          <History className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedPre2017Filter}
            onChange={(e) => setSelectedPre2017Filter(e.target.value as 'all' | 'exclude' | 'only')}
            aria-label="Filter watch history era"
            className="bg-transparent border-none text-slate-200 focus:outline-none text-xs cursor-pointer py-1.5 min-h-[28px]"
          >
            <option value="all" className="bg-[#070c09] text-slate-200">All History</option>
            <option value="exclude" className="bg-[#070c09] text-slate-200">Hide Pre-2017</option>
            <option value="only" className="bg-[#070c09] text-slate-200">Only Pre-2017</option>
          </select>
        </div>

        {/* Cutoff Unmet Toggle Button */}
        <button
          onClick={() => setSelectedCutoffUnmet(selectedCutoffUnmet ? null : true)}
          className={`px-2.5 py-1 min-h-[28px] rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
            selectedCutoffUnmet
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
              : 'bg-[#050806] text-slate-400 border-[#14231a] hover:text-slate-200'
          }`}
          title="Show only items where quality cutoff is unmet in Radarr/Sonarr"
        >
          <span>Cutoff Unmet</span>
        </button>

        {/* My Requests / Requester Filter Button */}
        <button
          onClick={() => setOnlyMyRequests(!onlyMyRequests)}
          className={`px-2.5 py-1 min-h-[28px] rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
            onlyMyRequests
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
              : 'bg-[#050806] text-slate-400 border-[#14231a] hover:text-slate-200'
          }`}
          title={
            selectedUser
              ? `Filter to items requested in Overseerr by ${selectedUser.friendlyName || selectedUser.username}`
              : currentUser?.username
              ? `Filter to items requested in Overseerr by you (${currentUser.username})`
              : 'Filter to items requested in Overseerr'
          }
          aria-label="Filter to my requests"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>My Requests</span>
        </button>
      </div>

      {/* Right side: Media Type toggle, Sort, View mode & Select All */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Media type buttons */}
        <div className="flex items-center bg-[#050806] border border-[#14231a] rounded-lg p-0.5">
          <button
            onClick={() => setSelectedMediaType('all')}
            className={`px-2.5 py-1.5 min-h-[28px] rounded-md text-xs font-medium transition ${
              selectedMediaType === 'all'
                ? 'bg-emerald-500 text-black font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedMediaType('movie')}
            className={`px-2.5 py-1.5 min-h-[28px] rounded-md text-xs font-medium flex items-center gap-1 transition ${
              selectedMediaType === 'movie'
                ? 'bg-emerald-500 text-black font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3 h-3" />
            Movies
          </button>
          <button
            onClick={() => setSelectedMediaType('series')}
            className={`px-2.5 py-1.5 min-h-[28px] rounded-md text-xs font-medium flex items-center gap-1 transition ${
              selectedMediaType === 'series'
                ? 'bg-emerald-500 text-black font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-3 h-3" />
            TV Shows
          </button>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1 bg-[#050806] border border-[#14231a] rounded-lg px-2 py-0.5">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent border-none text-slate-200 focus:outline-none text-xs cursor-pointer py-1.5 min-h-[28px]"
          >
            <option value="size" className="bg-[#070c09] text-slate-200">Sort by Size</option>
            <option value="added" className="bg-[#070c09] text-slate-200">Sort by Date Added</option>
            <option value="title" className="bg-[#070c09] text-slate-200">Sort by Title</option>
          </select>
          <button
            onClick={toggleSortDesc}
            title={sortDesc ? 'Descending' : 'Ascending'}
            className="text-slate-400 hover:text-emerald-400 min-w-[28px] min-h-[28px] flex items-center justify-center p-1 rounded transition"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-[#050806] border border-[#14231a] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition min-w-[28px] min-h-[28px] flex items-center justify-center ${
              viewMode === 'grid' ? 'bg-[#0f1a14] text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Poster Grid"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition min-w-[28px] min-h-[28px] flex items-center justify-center ${
              viewMode === 'table' ? 'bg-[#0f1a14] text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Compact Table"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Select all toggle */}
        <button
          onClick={() => (isAllSelected ? clearSelection() : selectAll())}
          className="px-2.5 py-1.5 min-h-[28px] rounded-lg bg-[#050806] border border-[#14231a] text-slate-300 hover:bg-[#0f1a14] hover:text-white hover:border-[#1c3024] text-xs font-medium transition"
        >
          {isAllSelected ? 'Deselect All' : items.length > 0 ? `Select Loaded (${items.length})` : 'Select All'}
        </button>
      </div>
    </div>
  );
};
