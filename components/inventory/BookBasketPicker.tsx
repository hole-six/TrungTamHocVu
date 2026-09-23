"use client";

import { useMemo, useState } from "react";
import { formatVnd } from "@/lib/export-utils";

export type BookOption = {
  id: string;
  name: string;
  bookCode?: string | null;
  category?: string | null;
  unitPrice: number;
  quantityOnHand?: number | null;
};

export type Basket = Record<string, number>;

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const UNCATEGORIZED = "Sách khác";

function normalize(value: string) {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

export function basketItems(basket: Basket, books: BookOption[]) {
  return Object.entries(basket)
    .filter(([, quantity]) => quantity > 0)
    .map(([bookId, quantity]) => {
      const book = books.find((item) => item.id === bookId);
      return { bookId, quantity, book, amount: (book?.unitPrice ?? 0) * quantity };
    });
}

export function basketTotal(basket: Basket, books: BookOption[]) {
  return basketItems(basket, books).reduce((sum, item) => sum + item.amount, 0);
}

export function basketQuantity(basket: Basket) {
  return Object.values(basket).reduce((sum, quantity) => sum + Math.max(0, quantity), 0);
}

function categoryName(book: BookOption) {
  return book.category?.trim() || UNCATEGORIZED;
}

export default function BookBasketPicker({
  books,
  basket,
  onChange,
  loading,
}: {
  books: BookOption[];
  basket: Basket;
  onChange: (next: Basket) => void;
  loading?: boolean;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const book of books) {
      const key = categoryName(book);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi"));
  }, [books]);

  const groups = useMemo(() => {
    const keyword = normalize(q);
    const matched = books.filter((book) => {
      const cat = categoryName(book);
      if (category && cat !== category) return false;
      if (onlyInStock && (book.quantityOnHand ?? 0) <= 0 && !basket[book.id]) return false;
      if (!keyword) return true;
      return normalize([book.name, book.bookCode ?? "", cat].join(" ")).includes(keyword);
    });
    const map = new Map<string, BookOption[]>();
    for (const book of matched) {
      const key = categoryName(book);
      map.set(key, [...(map.get(key) ?? []), book]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi"));
  }, [books, q, category, onlyInStock, basket]);

  function setQuantity(bookId: string, quantity: number) {
    const next = { ...basket };
    if (quantity <= 0) delete next[bookId];
    else next[bookId] = quantity;
    onChange(next);
  }

  function setGroupQuantity(items: BookOption[], quantity: number) {
    const next = { ...basket };
    for (const book of items) {
      if (quantity <= 0) delete next[book.id];
      else next[book.id] = Math.max(quantity, next[book.id] ?? 0);
    }
    onChange(next);
  }

  const picked = basketItems(basket, books);
  const total = picked.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="input min-w-[200px] flex-1"
          placeholder="Tìm sách theo tên, mã sách hoặc danh mục..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <button
          type="button"
          onClick={() => setOnlyInStock((current) => !current)}
          className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${onlyInStock ? "border-[#0f1729] bg-[#0f1729] text-white" : "border-[#e2e8f0] bg-white text-[#0f1729] hover:border-[#0f1729]"}`}
        >
          Còn hàng
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={`rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${!category ? "border-[#0f1729] bg-[#0f1729] text-white" : "border-[#e2e8f0] bg-white text-[#0f1729] hover:border-[#0f1729]"}`}
        >
          Tất cả <span className="tabular-nums opacity-70">{books.length}</span>
        </button>
        {categories.map(([name, count]) => (
          <button
            key={name}
            type="button"
            onClick={() => setCategory((current) => (current === name ? "" : name))}
            className={`rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${category === name ? "border-[#0f1729] bg-[#0f1729] text-white" : "border-[#e2e8f0] bg-white text-[#0f1729] hover:border-[#0f1729]"}`}
          >
            {name} <span className="tabular-nums opacity-70">{count}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-[#e2e8f0]">
        {loading ? <p className="px-3 py-6 text-center text-sm text-[#64748b]">Đang tải danh mục sách...</p> : null}
        {!loading && groups.length === 0 ? <p className="px-3 py-6 text-center text-sm text-[#64748b]">Không có đầu sách phù hợp.</p> : null}
        {groups.map(([name, items]) => {
          const selectedCount = items.filter((book) => (basket[book.id] ?? 0) > 0).length;
          const groupTotal = items.reduce((sum, book) => sum + (basket[book.id] ?? 0) * book.unitPrice, 0);
          const allSelected = selectedCount === items.length && items.length > 0;
          return (
            <div key={name}>
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] bg-[#f1f5f9] px-3 py-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#334155]">{name}</p>
                  <p className="text-xs text-[#64748b]">
                    {items.length} đầu sách · đã chọn {selectedCount}
                    {groupTotal > 0 ? ` · ${formatVnd(groupTotal)}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setGroupQuantity(items, 1)}
                    className={`rounded-md border px-2 py-1 text-[11px] font-bold transition-colors ${allSelected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#0f1729] bg-white text-[#0f1729] hover:bg-[#0f1729] hover:text-white"}`}
                  >
                    Chọn cả bộ
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupQuantity(items, 0)}
                    disabled={selectedCount === 0}
                    className="rounded-md border border-[#cbd5e1] bg-white px-2 py-1 text-[11px] font-bold text-[#64748b] hover:border-[#0f1729] hover:text-[#0f1729] disabled:opacity-40"
                  >
                    Bỏ bộ
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-[#f1f5f9]">
                {items.map((book) => {
                  const quantity = basket[book.id] ?? 0;
                  const stock = book.quantityOnHand ?? 0;
                  return (
                    <li key={book.id} className={`flex items-center gap-3 px-3 py-2 ${quantity > 0 ? "bg-[#f8fafc]" : ""}`}>
                      <button type="button" onClick={() => setQuantity(book.id, quantity + 1)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-semibold text-[#0f1729]">{book.name}</span>
                        <span className="text-xs text-[#64748b]">
                          {formatVnd(book.unitPrice)} ·{" "}
                          <span className={stock <= 0 ? "text-[#b45309]" : undefined}>{stock > 0 ? `còn ${stock}` : "hết kho"}</span>
                          {book.bookCode && book.bookCode.trim() !== "0" ? ` · ${book.bookCode}` : ""}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQuantity(book.id, quantity - 1)}
                          disabled={quantity === 0}
                          className="h-7 w-7 rounded-md border border-[#e2e8f0] text-sm font-bold text-[#0f1729] transition-colors hover:border-[#0f1729] disabled:opacity-40"
                          aria-label={`Bớt ${book.name}`}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={quantity || ""}
                          onChange={(event) => setQuantity(book.id, Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                          className="h-7 w-12 rounded-md border border-[#e2e8f0] text-center text-sm tabular-nums text-[#0f1729]"
                          aria-label={`Số lượng ${book.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity(book.id, quantity + 1)}
                          className="h-7 w-7 rounded-md border border-[#0f1729] bg-[#0f1729] text-sm font-bold text-white"
                          aria-label={`Thêm ${book.name}`}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-[#e2e8f0] px-3 py-2.5">
        {picked.length === 0 ? (
          <p className="text-sm text-[#64748b]">Chưa chọn sách nào · bấm Chọn cả bộ trong từng danh mục hoặc chọn lẻ từng đầu sách.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">
                Đã chọn {picked.length} đầu sách · {basketQuantity(basket)} cuốn
              </p>
              <p className="text-lg font-black tabular-nums text-[#0f1729]">{formatVnd(total)}</p>
            </div>
            <ul className="mt-1.5 space-y-1">
              {picked.map((item) => (
                <li key={item.bookId} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate text-[#0f1729]">
                    {item.book?.name ?? "Sách"} <span className="text-[#64748b]">x {item.quantity}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-[#0f1729]">{formatVnd(item.amount)}</span>
                    <button type="button" onClick={() => setQuantity(item.bookId, 0)} className="text-xs font-bold text-[#64748b] underline">
                      bỏ
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
