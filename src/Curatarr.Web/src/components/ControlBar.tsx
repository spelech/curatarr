import React from 'react';
import { Search, Film, Tv, LayoutGrid, List, ArrowUpDown, User } from 'lucide-react';
import { useCatalogStore } from '../stores/useCatalogStore';

export const ControlBar: React.FC = () => {
  const {
    users,
    selectedUserId,
    setSelectedUserId,
    selectedMediaType,
    setSelectedMediaType,
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

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Left side: Search & Multi-User filter */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search titles..."
            className="w-full pl-8 pr-3 py-1.5 min-h-[28px] bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs"
          />
        </div>

        {/* Multi-User Profile Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-0.5 text-slate-300">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedUserId || ''}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            className="bg-transparent border-none text-slate-200 focus:outline-none text-xs cursor-pointer py-1.5 min-h-[28px]"
          >
            <option value="" className="bg-slate-900 text-slate-200">
              All Users (Combined)
            </option>
            {users.map((u) => (
              <option key={u.userId} value={u.userId} className="bg-slate-900 text-slate-200">
                {u.friendlyName || u.username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right side: Media Type toggle, Sort, View mode & Select All */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Media type buttons */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-md p-0.5">
          <button
            onClick={() => setSelectedMediaType('all')}
            className={`px-2.5 py-1.5 min-h-[28px] rounded text-xs font-medium transition ${
              selectedMediaType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedMediaType('movie')}
            className={`px-2.5 py-1.5 min-h-[28px] rounded text-xs font-medium flex items-center gap-1 transition ${
              selectedMediaType === 'movie' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3 h-3" />
            Movies
          </button>
          <button
            onClick={() => setSelectedMediaType('series')}
            className={`px-2.5 py-1.5 min-h-[28px] rounded text-xs font-medium flex items-center gap-1 transition ${
              selectedMediaType === 'series' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-3 h-3" />
            TV Shows
          </button>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-md px-2 py-0.5">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent border-none text-slate-200 focus:outline-none text-xs cursor-pointer py-1.5 min-h-[28px]"
          >
            <option value="size" className="bg-slate-900 text-slate-200">Sort by Size</option>
            <option value="added" className="bg-slate-900 text-slate-200">Sort by Date Added</option>
            <option value="title" className="bg-slate-900 text-slate-200">Sort by Title</option>
          </select>
          <button
            onClick={toggleSortDesc}
            title={sortDesc ? 'Descending' : 'Ascending'}
            className="text-slate-400 hover:text-slate-200 min-w-[28px] min-h-[28px] flex items-center justify-center p-1 rounded"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-md p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
            title="Poster Grid"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
            title="Compact Table"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Select all toggle */}
        <button
          onClick={() => (isAllSelected ? clearSelection() : selectAll())}
          className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 text-xs font-medium transition"
        >
          {isAllSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>
    </div>
  );
};
