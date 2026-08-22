"use client";

import Link from "next/link";
import { formatVnd } from "@/lib/export-utils";

type Book = {
  id: string;
  isbn?: string;
  title: string;
  author?: string;
  category?: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  minStockLevel?: number;
};

export default function BookCard({ book }: { book: Book }) {
  const isLowStock = (book.minStockLevel ?? 0) > 0 && book.currentStock <= (book.minStockLevel ?? 0);
  const isOutOfStock = book.currentStock === 0;
  const profitMargin = book.sellingPrice > 0 
    ? (((book.sellingPrice - book.costPrice) / book.sellingPrice) * 100).toFixed(0)
    : "0";

  return (
    <Link
      href={`/inventory/${book.id}`}
      className="group card hover:shadow-xl hover:scale-[1.02] transition-all duration-200 hover:border-primary/30"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 transition-shadow shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-bold text-ink group-hover:text-primary transition-colors line-clamp-2 mb-1">
            {book.title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {book.category && (
              <span className="inline-flex items-center rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {book.category}
              </span>
            )}
            {book.author && (
              <span className="text-xs text-ink-muted48 truncate">
                {book.author}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ISBN */}
      {book.isbn && (
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-blue-50 shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="18" height="14" rx="2"/>
              <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </div>
          <span className="text-xs font-mono text-ink-muted64">{book.isbn}</span>
        </div>
      )}

      {/* Stock status */}
      <div className={`rounded-xl border-2 p-3 mb-3 ${
        isOutOfStock
          ? "border-red-200 bg-red-50"
          : isLowStock
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={
              isOutOfStock ? "#dc2626" : isLowStock ? "#d97706" : "#059669"
            } strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <div>
              <p className={`text-xs font-semibold ${
                isOutOfStock ? "text-red-700" : isLowStock ? "text-amber-700" : "text-emerald-700"
              }`}>
                {isOutOfStock ? "❌ Hết hàng" : isLowStock ? "⚠️ Tồn kho thấp" : "✅ Còn hàng"}
              </p>
              <p className={`text-xs ${
                isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-emerald-600"
              }`}>
                Tồn: <strong>{book.currentStock}</strong> {book.minStockLevel && `/ Min: ${book.minStockLevel}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg border border-[#e8edf5] bg-white p-2.5">
          <p className="text-xs text-ink-muted48 mb-0.5">Giá nhập</p>
          <p className="text-sm font-bold text-ink">{formatVnd(book.costPrice)}</p>
        </div>
        <div className="rounded-lg border border-[#e8edf5] bg-white p-2.5">
          <p className="text-xs text-ink-muted48 mb-0.5">Giá bán</p>
          <p className="text-sm font-bold text-ink">{formatVnd(book.sellingPrice)}</p>
        </div>
      </div>

      {/* Profit margin */}
      <div className="flex items-center justify-between rounded-lg border border-[#e8edf5] bg-[#fafbff] px-3 py-2">
        <p className="text-xs text-ink-muted48">Biên lợi nhuận</p>
        <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold ${
          Number(profitMargin) > 20
            ? "bg-emerald-100 text-emerald-700"
            : Number(profitMargin) > 10
            ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-700"
        }`}>
          {profitMargin}%
        </span>
      </div>

      {/* Hover indicator */}
      <div className="mt-3 flex items-center justify-end">
        <span className="text-xs font-semibold text-primary flex items-center gap-1">
          Xem chi tiết
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
      </div>
    </Link>
  );
}
