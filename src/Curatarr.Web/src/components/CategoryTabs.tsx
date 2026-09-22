import React from 'react';
import { HelpCircle, ShieldAlert } from 'lucide-react';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useSettingsStore } from '../stores/useSettingsStore';

export const CategoryTabs: React.FC = () => {
  const { categories, selectedCategory, setSelectedCategory, setIsCriteriaModalOpen } = useCatalogStore();
  const settings = useSettingsStore((s) => s.settings);

  const formatSize = (bytes: number) => {
    if (bytes <= 0) return '';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
  };

  const getCategoryTooltip = (categoryId: string) => {
    const neverWatchedDays = settings?.neverWatchedMinAgeDays ?? 90;
    const staleDays = settings?.staleDays ?? 180;
    const abandonedDays = settings?.abandonedDays ?? 90;

    switch (categoryId) {
      case 'never_watched':
        return `0 plays across all users; added >= ${neverWatchedDays} days ago`;
      case 'stale':
        return `Previously watched; no plays by any user in > ${staleDays} days`;
      case 'abandoned':
        return `TV show with >= 1 episode watched; no plays in > ${abandonedDays} days`;
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

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.categoryId;
        const sizeStr = formatSize(cat.reclaimableSizeBytes);
        const isProtReq = cat.categoryId === 'protection_requested';
        const tooltip = getCategoryTooltip(cat.categoryId);

        return (
          <button
            key={cat.categoryId}
            onClick={() => setSelectedCategory(cat.categoryId)}
            title={tooltip}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 whitespace-nowrap ${
              isSelected
                ? isProtReq
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-sky-600 text-white shadow-sm'
                : isProtReq
                ? 'bg-violet-950/30 text-violet-300 hover:text-violet-200 border border-violet-800/40 hover:border-violet-700'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
            }`}
          >
            {isProtReq && <ShieldAlert className="w-3.5 h-3.5 text-violet-400" />}
            <span>{cat.name}</span>
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
            {sizeStr && (
              <span
                className={`text-[10px] opacity-80 ${
                  isSelected ? 'text-white' : isProtReq ? 'text-violet-300' : 'text-slate-400'
                }`}
              >
                {sizeStr}
              </span>
            )}
          </button>
        );
      })}

      {/* All Items tab */}
      <button
        onClick={() => setSelectedCategory('all')}
        title="Show all library items regardless of category"
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
          selectedCategory === 'all'
            ? 'bg-sky-600 text-white shadow-sm'
            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
        }`}
      >
        All Items
      </button>

      {/* Criteria Info Guide Button */}
      <button
        onClick={() => setIsCriteriaModalOpen(true)}
        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/60 text-slate-400 hover:text-sky-300 border border-slate-800 hover:border-slate-700 flex items-center gap-1.5 shrink-0 transition"
        title="View Smart Category Rules & Thresholds Guide"
        aria-label="Category criteria guide"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Rules Guide</span>
      </button>
    </div>
  );
};
