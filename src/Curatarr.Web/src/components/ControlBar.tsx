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

  const hasActiveFilters = Boolean(
    selectedUserId ||
    selectedResolution ||
    selectedCutoffUnmet ||
    selectedPre2017Filter !== 'all' ||
    onlyMyRequests ||
    searchQuery
  );

  const resetFilters = () => {
    setSelectedUserId(null);
    setSelectedResolution(null);
    setSelectedCutoffUnmet(null);
    setSelectedPre2017Filter('all');
    setOnlyMyRequests(false);
    setSearchQuery('');
  };

  return (
    <div className="bg-[#090e0b]/90 border border-[#14231a] rounded-xl p-3 flex flex-col gap-2.5 text-xs shadow-sm">
      {/* Tier 1: Primary Search, Media Scope, Sort, View Mode & Batch Selection */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-[#14231a]">
        {/* Search & Media Scope */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search titles..."
              aria-label="Search titles"
              className="w-full h-8 pl-8 pr-3 bg-[#050806] border border-[#14231a] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs transition"
            />
          </div>

          {/* Media type toggle */}
          <div className="flex items-center bg-[#050806] border border-[#14231a] rounded-lg p-0.5 h-8">
            <button
              onClick={() => setSelectedMediaType('all')}
              className={`px-3 h-full rounded-md text-xs font-medium transition ${
                selectedMediaType === 'all'
                  ? 'bg-emerald-500 text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedMediaType('movie')}
              className={`px-3 h-full rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                selectedMediaType === 'movie'
                  ? 'bg-emerald-500 text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Movies
            </button>
            <button
              onClick={() => setSelectedMediaType('series')}
              className={`px-3 h-full rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                selectedMediaType === 'series'
                  ? 'bg-emerald-500 text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              TV Shows
            </button>
          </div>
        </div>

        {/* Sort, View mode & Selection */}
        <div className="flex items-center gap-2">
          {/* Sort selector */}
          <div className="flex items-center h-8 bg-[#050806] border border-[#14231a] rounded-lg px-2 gap-1 text-slate-300">
            <span className="text-slate-500 text-[11px] font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent border-none text-slate-200 focus:outline-none text-xs cursor-pointer h-full"
            >
              <option value="size" className="bg-[#070c09] text-slate-200">Size</option>
              <option value="added" className="bg-[#070c09] text-slate-200">Date Added</option>
              <option value="title" className="bg-[#070c09] text-slate-200">Title</option>
            </select>
            <button
              onClick={toggleSortDesc}
              title={sortDesc ? 'Descending' : 'Ascending'}
              className="text-slate-400 hover:text-emerald-400 w-6 h-6 flex items-center justify-center rounded transition"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-[#050806] border border-[#14231a] rounded-lg p-0.5 h-8">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2 h-full rounded-md transition flex items-center justify-center ${
                viewMode === 'grid' ? 'bg-[#0f1a14] text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Poster Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2 h-full rounded-md transition flex items-center justify-center ${
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
            className="h-8 px-3 rounded-lg bg-[#050806] border border-[#14231a] text-slate-300 hover:bg-[#0f1a14] hover:text-white hover:border-[#1c3024] text-xs font-medium transition"
          >
            {isAllSelected ? 'Deselect All' : items.length > 0 ? `Select Loaded (${items.length})` : 'Select All'}
          </button>
        </div>
      </div>

      {/* Tier 2: Refinement Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">
            Filter:
          </span>

          {/* Multi-User Profile Dropdown */}
          <div className="flex items-center h-8 bg-[#050806] border border-[#14231a] rounded-lg px-2.5 gap-1.5 text-slate-300">
            <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
              className="bg-transparent border-none text-slate-200 focus:outline-none text-xs cursor-pointer h-full"
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
          <div className="flex items-center h-8 bg-[#050806] border border-[#14231a] rounded-lg px-2.5 gap-1.5 text-slate-300">
            <span className="text-slate-500 text-[11px] font-medium hidden md:inline">Res:</span>
            <select
              value={selectedResolution || ''}
              onChange={(e) => setSelectedResolution(e.target.value || null)}
              aria-label="Filter resolution"
              className="bg-transparent border-none text-slate-200 focus:outline-none text-xs cursor-pointer h-full"
            >
              <option value="" className="bg-[#070c09] text-slate-200">All Resolutions</option>
              <option value="SD" className="bg-[#070c09] text-slate-200">SD (&lt; 720p)</option>
              <option value="720p" className="bg-[#070c09] text-slate-200">720p</option>
              <option value="1080p" className="bg-[#070c09] text-slate-200">1080p</option>
              <option value="4K" className="bg-[#070c09] text-slate-200">4K (2160p)</option>
            </select>
          </div>

          {/* Pre-2017 Watch History Dropdown */}
          <div className="flex items-center h-8 bg-[#050806] border border-[#14231a] rounded-lg px-2.5 gap-1.5 text-slate-300">
            <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedPre2017Filter}
              onChange={(e) => setSelectedPre2017Filter(e.target.value as 'all' | 'exclude' | 'only')}
              aria-label="Filter watch history era"
              className="bg-transparent border-none text-slate-200 focus:outline-none text-xs cursor-pointer h-full"
            >
              <option value="all" className="bg-[#070c09] text-slate-200">All History</option>
              <option value="exclude" className="bg-[#070c09] text-slate-200">Hide Pre-2017</option>
              <option value="only" className="bg-[#070c09] text-slate-200">Only Pre-2017</option>
            </select>
          </div>

          {/* Cutoff Unmet Toggle Button */}
          <button
            onClick={() => setSelectedCutoffUnmet(selectedCutoffUnmet ? null : true)}
            className={`h-8 px-2.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
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
            className={`h-8 px-2.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
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
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>My Requests</span>
          </button>
        </div>

        {/* Status / Reset Filters indicator */}
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
          <div className="text-[11px] text-slate-500 font-medium">
            {items.length === 1 ? '1 candidate' : `${items.length} candidates`}
          </div>
        </div>
      </div>
    </div>
  );
};
