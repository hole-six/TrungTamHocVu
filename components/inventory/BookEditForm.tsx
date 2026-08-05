"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CategorySelect from "./CategorySelect";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { formatVnd } from "@/lib/export-utils";

type BookProfile = {
  id: string;
  bookCode: string | null;
  category: string | null;
  name: string;
  purchasePrice: number;
  unitPrice: number;
  usageStatus: string | null;
  notes: string | null;
};

export default function BookEditForm({ book, categoryOptions }: { book: BookProfile; categoryOptions: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: book.name,
    category: book.category ?? "",
    purchasePrice: String(book.purchasePrice),
    unitPrice: String(book.unitPrice),
    usageStatus: book.usageStatus ?? "",
    notes: book.notes ?? "",
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không lưu được thông tin sách.");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  async function remove() {
    const response = await fetch(`/api/books/${book.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error ?? "Không thể xóa sách.");
      return;
    }
    router.push("/inventory");
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Thông tin sách</h2>
          <p className="mt-1 text-sm text-ink-muted48">Sửa nhanh tên, danh mục, giá nhập, giá bán và trạng thái sử dụng.</p>
        </div>
        {!editing ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} className="btn-ghost text-sm">
              Sửa
            </button>
            <ConfirmActionButton
              title="Xác nhận xóa sách?"
              description={`Sách "${book.name}" sẽ bị xóa khỏi kho. Thao tác này không thể hoàn tác.`}
              confirmLabel="Xóa sách"
              tone="danger"
              className="btn-danger-sm"
              onConfirm={remove}
            >
              Xóa sách
            </ConfirmActionButton>
          </div>
        ) : null}
      </div>

      {!editing ? (
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-hairline/60 py-1">
            <dt className="text-ink-muted48">Mã sách</dt>
            <dd className="font-medium">{book.bookCode ?? "—"}</dd>
          </div>
          <div className="flex justify-between border-b border-hairline/60 py-1">
            <dt className="text-ink-muted48">Danh mục</dt>
            <dd className="font-medium">{book.category ?? "Sách khác"}</dd>
          </div>
          <div className="flex justify-between border-b border-hairline/60 py-1">
            <dt className="text-ink-muted48">Đơn giá nhập</dt>
            <dd className="font-medium">{book.purchasePrice.toLocaleString("vi-VN")}đ</dd>
          </div>
          <div className="flex justify-between border-b border-hairline/60 py-1">
            <dt className="text-ink-muted48">Đơn giá bán</dt>
            <dd className="font-medium">{book.unitPrice.toLocaleString("vi-VN")}đ</dd>
          </div>
          <div className="flex justify-between border-b border-hairline/60 py-1">
            <dt className="text-ink-muted48">Tình trạng sử dụng</dt>
            <dd className="font-medium">{book.usageStatus ?? "—"}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-ink-muted48">Ghi chú</dt>
            <dd className="font-medium">{book.notes ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <form onSubmit={save} className="mt-4 space-y-3">
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Tên sách/giáo trình</span>
            <input required className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Danh mục sách</span>
            <CategorySelect
              categoryOptions={categoryOptions}
              value={form.category}
              onChange={(next) => setForm((current) => ({ ...current, category: next }))}
            />
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Đơn giá nhập</span>
            <input required type="number" min="0" className="input" value={form.purchasePrice} onChange={(event) => setForm((current) => ({ ...current, purchasePrice: event.target.value }))} />
            <p className="form-hint">{form.purchasePrice ? formatVnd(Number(form.purchasePrice) || 0) : ""}</p>
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Đơn giá bán</span>
            <input required type="number" min="0" className="input" value={form.unitPrice} onChange={(event) => setForm((current) => ({ ...current, unitPrice: event.target.value }))} />
            <p className="form-hint">{form.unitPrice ? formatVnd(Number(form.unitPrice) || 0) : ""}</p>
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Tình trạng sử dụng</span>
            <input className="input" placeholder="VD: Còn dùng, Ngừng dùng..." value={form.usageStatus} onChange={(event) => setForm((current) => ({ ...current, usageStatus: event.target.value }))} />
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Ghi chú</span>
            <textarea className="input resize-none" rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2 border-t border-hairline pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
