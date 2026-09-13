import React from 'react';
import { Search, RotateCcw } from 'lucide-react';

export default function FilterBar({ searchValue, onSearchChange, placeholder = 'Search...', onReset, children }) {
  return (
    <div className="bg-card-bg border border-slate-200/80 rounded-2xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-app-bg border border-slate-200 text-xs text-app-text focus:outline-none focus:border-primary"
        />
      </div>

      {/* Extra Dropdown Filters (Injected as children) */}
      <div className="flex items-center gap-2">
        {children}

        {onReset && (
          <button
            onClick={onReset}
            className="p-2 rounded-xl border border-slate-200 text-text-muted hover:text-app-text transition-colors"
            title="Reset Filters"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}