import React from 'react';
import { useCatalogStore } from '../stores/useCatalogStore';

export const CategoryTabs: React.FC = () => {
  const { categories, selectedCategory, setSelectedCategory } = useCatalogStore();

  const formatSize = (bytes: number) => {
    if (bytes <= 0) return '';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1000 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`;
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.categoryId;
        const sizeStr = formatSize(cat.reclaimableSizeBytes);

        return (
          <button
            key={cat.categoryId}
            onClick={() => setSelectedCategory(cat.categoryId)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 whitespace-nowrap ${
              isSelected
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <span>{cat.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isSelected ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {cat.count}
            </span>
            {sizeStr && (
              <span className={`text-[10px] opacity-80 ${isSelected ? 'text-sky-200' : 'text-slate-400'}`}>
                {sizeStr}
              </span>
            )}
          </button>
        );
      })}

      {/* All Items tab */}
      <button
        onClick={() => setSelectedCategory('all')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
          selectedCategory === 'all'
            ? 'bg-sky-600 text-white shadow-sm'
            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
        }`}
      >
        All Items
      </button>
    </div>
  );
};
