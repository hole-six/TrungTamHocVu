"use client";

import { useState, useEffect, useRef } from "react";

type DataTableHeaderProps = {
  searchable: boolean;
  searchPlaceholder: string;
  onSearch?: (query: string) => void;
  totalCount: number;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  defaultSearchValue?: string;
};

const SEARCH_DEBOUNCE_MS = 400;

export default function DataTableHeader({
  searchable,
  searchPlaceholder,
  onSearch,
  totalCount,
  title,
  description,
  actions,
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
    <div className="rounded-[28px] border border-[#e4ebf8] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff] text-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h18v18H3z"/>
                <path d="M3 9h18"/>
                <path d="M9 21V9"/>
              </svg>
            </div>
            <div>
              {title ? <p className="text-base font-bold text-[#0f172a]">{title}</p> : null}
              {description ? <p className="text-sm text-[#64748b]">{description}</p> : null}
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dbe7ff] bg-white px-4 py-2 text-sm font-semibold text-[#4f46e5]">
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#eef4ff] px-2 text-xs font-bold">
              {totalCount.toLocaleString()}
            </span>
            bản ghi
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {searchable ? (
            <div className="relative w-full sm:w-[340px]">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted48">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <input
                type="text"
                className="input h-12 rounded-2xl border-[#dce5f5] bg-white pl-10 pr-10"
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              ) : null}
            </div>
          ) : null}

          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
