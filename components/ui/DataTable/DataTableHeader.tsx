"use client";

import { useState, useEffect, useRef } from "react";

type DataTableHeaderProps = {
  searchable: boolean;
  searchPlaceholder: string;
  onSearch?: (query: string) => void;
  totalCount: number;
};

// Debounce khi gõ tìm kiếm — nếu gọi onSearch ngay mỗi phím bấm thì mỗi ký tự gõ sẽ bắn
// 1 request (và 1 router.push ở phía gọi), gõ "Nguyễn Văn A" ra cả chục request/lịch sử
// điều hướng. 400ms là mức đủ để không cảm thấy trễ nhưng vẫn gom được các lần gõ liên tiếp.
const SEARCH_DEBOUNCE_MS = 400;

export default function DataTableHeader({
  searchable,
  searchPlaceholder,
  onSearch,
  totalCount,
}: DataTableHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Count */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h18v18H3z"/>
            <path d="M3 9h18"/>
            <path d="M9 21V9"/>
          </svg>
        </div>
        <div>
          <p className="text-xs text-ink-muted48">Tổng số</p>
          <p className="text-sm font-bold text-ink">{totalCount.toLocaleString()}</p>
        </div>
      </div>

      {/* Search */}
      {searchable && (
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted48">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input
            type="text"
            className="input pl-10 pr-10"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={handleClear}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-muted48 hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
