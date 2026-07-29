"use client";

type DataTablePaginationProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export default function DataTablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always show first page
    pages.push(1);

    if (page > 3) {
      pages.push("...");
    }

    // Show pages around current page
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push("...");
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-ink-muted64">Hiển thị</label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="input w-20 py-1.5"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span className="text-sm text-ink-muted64">
          {startItem}-{endItem} của {total.toLocaleString()}
        </span>
      </div>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8edf5] bg-white text-ink-muted64 transition-all hover:bg-[#f8fafc] hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((pageNum, idx) =>
          pageNum === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-ink-muted48">
              ...
            </span>
          ) : (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum as number)}
              className={`flex h-9 min-w-[36px] items-center justify-center rounded-lg border px-2 text-sm font-semibold transition-all ${
                page === pageNum
                  ? "border-primary bg-primary text-white shadow-lg shadow-primary/30"
                  : "border-[#e8edf5] bg-white text-ink-muted64 hover:bg-[#f8fafc] hover:border-primary/50"
              }`}
            >
              {pageNum}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8edf5] bg-white text-ink-muted64 transition-all hover:bg-[#f8fafc] hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
