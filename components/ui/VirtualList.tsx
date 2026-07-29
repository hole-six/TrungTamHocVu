"use client";

import { useRef, useState, useEffect, CSSProperties } from "react";

type VirtualListProps<T> = {
  items: T[];
  itemHeight: number; // Fixed height for each item in pixels
  containerHeight: number; // Height of the visible container in pixels
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // Number of items to render outside visible area (default: 3)
  className?: string;
  emptyState?: React.ReactNode;
  loadingState?: React.ReactNode;
  loading?: boolean;
  onEndReached?: () => void; // Infinite scroll callback
  endReachedThreshold?: number; // Pixels from bottom to trigger onEndReached (default: 100)
};

export default function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = "",
  emptyState,
  loadingState,
  loading = false,
  onEndReached,
  endReachedThreshold = 100,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate total height
  const totalHeight = items.length * itemHeight;

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // Get visible items
  const visibleItems = items.slice(startIndex, endIndex + 1);

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    // Check if near bottom for infinite scroll
    if (onEndReached) {
      const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (scrollBottom < endReachedThreshold && !loading) {
        onEndReached();
      }
    }
  };

  // Empty state
  if (items.length === 0 && !loading) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height: containerHeight }}
      >
        {emptyState || (
          <div className="text-center" style={{ color: "var(--text-muted)" }}>
            <p className="text-sm">Không có dữ liệu</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto scrollbar-thin ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* Spacer for total height */}
      <div style={{ height: totalHeight, position: "relative" }}>
        {/* Visible items */}
        {visibleItems.map((item, index) => {
          const actualIndex = startIndex + index;
          const style: CSSProperties = {
            position: "absolute",
            top: actualIndex * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
          };

          return (
            <div key={actualIndex} style={style}>
              {renderItem(item, actualIndex)}
            </div>
          );
        })}

        {/* Loading indicator at bottom */}
        {loading && onEndReached && (
          <div
            style={{
              position: "absolute",
              top: totalHeight,
              left: 0,
              right: 0,
              height: 60,
            }}
          >
            {loadingState || (
              <div className="flex items-center justify-center h-full">
                <svg
                  className="animate-spin h-5 w-5 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"
                  />
                </svg>
                <span className="ml-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  Đang tải...
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for managing virtual list state with infinite scroll
export function useVirtualListInfinite<T>(
  fetchPage: (page: number) => Promise<T[]>,
  initialItems: T[] = []
) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const newItems = await fetchPage(page + 1);
      
      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => [...prev, ...newItems]);
        setPage((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error loading more items:", error);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setItems(initialItems);
    setPage(1);
    setHasMore(true);
  };

  return {
    items,
    loading,
    hasMore,
    loadMore,
    reset,
    setItems,
  };
}

// Virtual Grid for card layouts
type VirtualGridProps<T> = {
  items: T[];
  itemHeight: number;
  itemsPerRow: number;
  gap: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  emptyState?: React.ReactNode;
};

export function VirtualGrid<T>({
  items,
  itemHeight,
  itemsPerRow,
  gap,
  containerHeight,
  renderItem,
  overscan = 2,
  className = "",
  emptyState,
}: VirtualGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate rows
  const rowCount = Math.ceil(items.length / itemsPerRow);
  const rowHeight = itemHeight + gap;
  const totalHeight = rowCount * rowHeight;

  // Visible rows
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endRow = Math.min(
    rowCount - 1,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
  );

  // Get visible items
  const visibleRows: T[][] = [];
  for (let row = startRow; row <= endRow; row++) {
    const rowItems = items.slice(row * itemsPerRow, (row + 1) * itemsPerRow);
    if (rowItems.length > 0) {
      visibleRows.push(rowItems);
    }
  }

  if (items.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height: containerHeight }}
      >
        {emptyState || (
          <div className="text-center" style={{ color: "var(--text-muted)" }}>
            <p className="text-sm">Không có dữ liệu</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`overflow-auto scrollbar-thin ${className}`}
      style={{ height: containerHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleRows.map((rowItems, rowIndex) => {
          const actualRow = startRow + rowIndex;
          const style: CSSProperties = {
            position: "absolute",
            top: actualRow * rowHeight,
            left: 0,
            right: 0,
            height: itemHeight,
            display: "grid",
            gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
            gap: `${gap}px`,
          };

          return (
            <div key={actualRow} style={style}>
              {rowItems.map((item, colIndex) => {
                const actualIndex = actualRow * itemsPerRow + colIndex;
                return <div key={actualIndex}>{renderItem(item, actualIndex)}</div>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
