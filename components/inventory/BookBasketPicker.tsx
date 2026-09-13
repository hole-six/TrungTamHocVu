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

const COMBINING_MARKS = /[̀-ͯ]/g;

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

// CHỌN NHIỀU ĐẦU SÁCH CÙNG LÚC, nhóm theo danh mục và hiện tất cả danh mục cùng một chỗ.
// Trước đây form xuất sách chỉ chọn được 1 cuốn mỗi lần và phải mở thêm 1 lớp drawer nữa
// để lọc danh mục — phát cả bộ giáo trình đầu khóa phải làm lại 3–4 lượt.
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
      const key = book.category?.trim() || "Sách khác";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi"));
  }, [books]);

  const groups = useMemo(() => {
    const keyword = normalize(q);
    const matched = books.filter((book) => {
      const cat = book.category?.trim() || "Sách khác";
      if (category && cat !== category) return false;
      if (onlyInStock && (book.quantityOnHand ?? 0) <= 0 && !basket[book.id]) return false;
      if (!keyword) return true;
      return normalize([book.name, book.bookCode ?? "", cat].join(" ")).includes(keyword);
    });
    const map = new Map<string, BookOption[]>();
    for (const book of matched) {
      const key = book.category?.trim() || "Sách khác";
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

      {/* Danh mục hiện cùng lúc, bấm để lọc nhanh — không phải mở thêm drawer chọn danh mục. */}
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
        {groups.map(([name, items]) => (
          <div key={name}>
            <p className="sticky top-0 z-10 border-b border-[#e2e8f0] bg-[#f1f5f9] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#334155]">
              {name} · {items.length} đầu sách
            </p>
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
                        −
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
        ))}
      </div>

      <div className="rounded-xl border border-[#e2e8f0] px-3 py-2.5">
        {picked.length === 0 ? (
          <p className="text-sm text-[#64748b]">Chưa chọn sách nào — bấm vào tên sách hoặc dấu + để thêm.</p>
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
                    {item.book?.name ?? "Sách"} <span className="text-[#64748b]">× {item.quantity}</span>
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
