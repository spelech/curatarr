import React, { useState, useRef, useEffect } from 'react';
import {
  HelpCircle,
  ShieldAlert,
  Shield,
  Clock,
  Tv,
  Film,
  AlertTriangle,
  HardDrive,
  FileQuestion,
  Layers,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useSettingsStore } from '../stores/useSettingsStore';

export const CategoryTabs: React.FC = () => {
  const { categories, selectedCategory, setSelectedCategory, setIsCriteriaModalOpen } = useCatalogStore();
  const settings = useSettingsStore((s) => s.settings);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes <= 0) return '';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
  };

  const getCategoryTooltip = (categoryId: string) => {
    const neverWatchedDays = settings?.neverWatchedMinAgeDays ?? 90;
    const staleDays = settings?.staleDays ?? 180;
    const abandonedDays = settings?.abandonedDays ?? 90;
    const sub720pYear = settings?.sub720pCutoffYear ?? 2000;

    switch (categoryId) {
      case 'never_watched':
        return `0 plays across all users; added >= ${neverWatchedDays} days ago`;
      case 'stale':
        return `Previously watched; no plays by any user in > ${staleDays} days`;
      case 'abandoned':
        return `TV show with >= 1 episode watched; no plays in > ${abandonedDays} days`;
      case 'sub_720p':
        return sub720pYear > 0
          ? `Media files below 720p (SD) released >= ${sub720pYear}`
          : 'Media files below 720p (SD) across all years';
      case 'cutoff_unmet':
        return 'Downloaded quality does not meet the Arr quality profile cutoff';
      case 'space_hogs':
        return 'Oversized titles exceeding movie or series episode size thresholds';
      case 'missing':
        return 'Monitored entries in Sonarr/Radarr with no file on disk';
      case 'protection_requested':
        return 'Items requested by shared library users awaiting admin review';
      case 'protected':
        return 'Manually protected / whitelisted items (immune to deletion)';
      default:
        return '';
    }
  };

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'never_watched':
      case 'stale':
        return Clock;
      case 'abandoned':
        return Tv;
      case 'sub_720p':
        return Film;
      case 'cutoff_unmet':
        return AlertTriangle;
      case 'space_hogs':
        return HardDrive;
      case 'missing':
        return FileQuestion;
      case 'protection_requested':
        return ShieldAlert;
      case 'protected':
        return Shield;
      default:
        return Layers;
    }
  };

  // Find active category summary object
  const activeCategorySummary = categories.find((c) => c.categoryId === selectedCategory);
  const activeName = selectedCategory === 'all' ? 'All Items' : activeCategorySummary?.name || 'Categories';
  const activeSizeStr = activeCategorySummary ? formatSize(activeCategorySummary.reclaimableSizeBytes) : '';
  const ActiveIcon = getCategoryIcon(selectedCategory);
  const isProtReqActive = selectedCategory === 'protection_requested';

  // Check if pending protection requests exist
  const protReqCategory = categories.find((c) => c.categoryId === 'protection_requested');
  const hasPendingProtection = (protReqCategory?.count ?? 0) > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      {/* Left side: Category Selector Dropdown & Pending Triage shortcut */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative" ref={dropdownRef}>
          {/* Main Dropdown Trigger */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-label="Select Category"
            title={getCategoryTooltip(selectedCategory)}
            className={`min-h-[32px] px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2.5 border shadow-sm ${
              isProtReqActive
                ? 'bg-violet-600 text-white border-violet-500 hover:bg-violet-500'
                : selectedCategory === 'all'
                ? 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-600'
                : 'bg-sky-600 text-white border-sky-500 hover:bg-sky-500'
            }`}
          >
            <ActiveIcon className="w-4 h-4 shrink-0 opacity-90" />
            <span className="font-medium tracking-wide">{activeName}</span>

            {activeCategorySummary && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                  isProtReqActive
                    ? 'bg-violet-700 text-white'
                    : selectedCategory === 'all'
                    ? 'bg-slate-800 text-slate-300'
                    : 'bg-sky-700 text-white'
                }`}
              >
                {activeCategorySummary.count}
              </span>
            )}

            {activeSizeStr && (
              <span className="text-[10px] opacity-85 font-mono hidden xs:inline">
                {activeSizeStr}
              </span>
            )}

            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 opacity-75 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu Flyout */}
          {isOpen && (
            <div
              role="listbox"
              aria-label="Category list"
              className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 backdrop-blur-md max-h-[75vh] overflow-y-auto animate-fade-in"
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
                Filter by Smart Category
              </div>

              <div className="py-1">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.categoryId;
                  const sizeStr = formatSize(cat.reclaimableSizeBytes);
                  const isProtReq = cat.categoryId === 'protection_requested';
                  const Icon = getCategoryIcon(cat.categoryId);
                  const tooltip = getCategoryTooltip(cat.categoryId);

                  return (
                    <button
                      key={cat.categoryId}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedCategory(cat.categoryId);
                        setIsOpen(false);
                      }}
                      title={tooltip}
                      className={`w-full px-3 py-2 text-left text-xs transition flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? isProtReq
                            ? 'bg-violet-600/20 text-violet-200 border-l-2 border-violet-500 font-semibold'
                            : 'bg-sky-600/20 text-sky-200 border-l-2 border-sky-500 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isProtReq
                              ? 'text-violet-400'
                              : isSelected
                              ? 'text-sky-400'
                              : 'text-slate-400'
                          }`}
                        />
                        <div className="truncate">
                          <div className="truncate font-medium">{cat.name}</div>
                          {tooltip && (
                            <div className="text-[10px] text-slate-500 truncate">{tooltip}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {sizeStr && (
                          <span className="text-[10px] text-slate-400 font-mono">{sizeStr}</span>
                        )}
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected
                              ? isProtReq
                                ? 'bg-violet-700 text-white'
                                : 'bg-sky-700 text-white'
                              : isProtReq
                              ? 'bg-violet-900/60 text-violet-200'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {cat.count}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })}

                {/* All Items Option */}
                <div className="border-t border-slate-800/80 my-1 pt-1">
                  <button
                    role="option"
                    aria-selected={selectedCategory === 'all'}
                    onClick={() => {
                      setSelectedCategory('all');
                      setIsOpen(false);
                    }}
                    title="Show all library items regardless of category"
                    className={`w-full px-3 py-2 text-left text-xs transition flex items-center justify-between gap-2.5 ${
                      selectedCategory === 'all'
                        ? 'bg-sky-600/20 text-sky-200 border-l-2 border-sky-500 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <div className="font-medium">All Items</div>
                        <div className="text-[10px] text-slate-500">Show complete library catalog</div>
                      </div>
                    </div>
                    {selectedCategory === 'all' && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Protection Requests Quick Triage Button (visible when pending requests exist) */}
        {hasPendingProtection && selectedCategory !== 'protection_requested' && (
          <button
            type="button"
            onClick={() => setSelectedCategory('protection_requested')}
            title="Jump to pending protection requests awaiting review"
            className="px-2.5 py-1.5 min-h-[32px] rounded-lg text-xs font-semibold bg-violet-950/40 text-violet-300 hover:text-violet-100 border border-violet-800/50 hover:border-violet-600 flex items-center gap-1.5 transition shadow-sm animate-pulse"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-violet-400" />
            <span>Triage Requests</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-violet-800 text-white font-bold">
              {protReqCategory?.count}
            </span>
          </button>
        )}

        {/* All Items Quick Shortcut (when not already on All Items) */}
        {selectedCategory !== 'all' && (
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            title="View entire library catalog"
            className="px-2.5 py-1.5 min-h-[32px] rounded-lg text-xs font-medium bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 transition hidden sm:inline-flex items-center gap-1"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Items</span>
          </button>
        )}
      </div>

      {/* Right side: Criteria Rules Guide Button */}
      <button
        type="button"
        onClick={() => setIsCriteriaModalOpen(true)}
        className="px-2.5 py-1.5 min-h-[32px] rounded-lg text-xs font-medium bg-slate-900/60 text-slate-400 hover:text-sky-300 border border-slate-800 hover:border-slate-700 flex items-center gap-1.5 shrink-0 transition"
        title="View Smart Category Rules & Thresholds Guide"
        aria-label="Category criteria guide"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span>Rules Guide</span>
      </button>
    </div>
  );
};
