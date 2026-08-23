"use client";

import { useState, useEffect, useRef } from "react";

type DataTableHeaderProps = {
  searchable: boolean;
  searchPlaceholder: string;
  onSearch?: (query: string) => void;
  totalCount: number;
  showCountBadge?: boolean;
  actions?: React.ReactNode;
  filterChips?: React.ReactNode;
  defaultSearchValue?: string;
};

const SEARCH_DEBOUNCE_MS = 400;

export default function DataTableHeader({
  searchable,
  searchPlaceholder,
  onSearch,
  totalCount,
  showCountBadge = true,
  actions,
  filterChips,
  defaultSearchValue = "",
}: DataTableHeaderProps) {
  const [searchQuery, setSearchQuery] = useState(defaultSearchValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchQuery(defaultSearchValue);
  }, [defaultSearchValue]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch?.(value), SEARCH_DEBOUNCE_MS);
  };

  const handleClear = () => {
    setSearchQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearch?.("");
  };

  return (
    <div
      data-dt="header"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 shadow-sm"
    >
      {searchable ? (
        <div data-dt="search" className="relative min-w-[220px] flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted48">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input
            type="text"
            className="input pl-9 pr-9"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-muted48 hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}

      <div data-dt="toolbar" className="flex shrink-0 flex-wrap items-center gap-2">
        {showCountBadge ? (
          <div
            data-dt="count"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1.5 text-xs font-semibold text-[#4f46e5]"
          >
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#eef4ff] px-1.5 text-[11px] font-bold">
              {totalCount.toLocaleString()}
            </span>
            bản ghi
          </div>
        ) : null}

        {filterChips ? <div data-dt="chips" className="flex flex-wrap items-center gap-1.5">{filterChips}</div> : null}
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
