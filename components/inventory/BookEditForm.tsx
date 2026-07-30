"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BookProfile = {
  id: string;
  bookCode: string | null;
  name: string;
  unitPrice: number;
  usageStatus: string | null;
  notes: string | null;
};

export default function BookEditForm({ book }: { book: BookProfile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: book.name,
    unitPrice: String(book.unitPrice),
    usageStatus: book.usageStatus ?? "",
    notes: book.notes ?? "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không lưu được thông tin sách.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Thông tin sách</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost text-sm">
            Sửa
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between border-b border-hairline/60 py-1">
            <dt className="text-ink-muted48">Mã sách</dt>
            <dd className="font-medium">{book.bookCode ?? "—"}</dd>
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
        <form onSubmit={save} className="mt-3 space-y-3">
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Tên sách/giáo trình</span>
            <input required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Đơn giá</span>
            <input required type="number" className="input" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} />
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Tình trạng sử dụng</span>
            <input className="input" placeholder="VD: Còn dùng, Ngừng dùng..." value={form.usageStatus} onChange={(e) => setForm((f) => ({ ...f, usageStatus: e.target.value }))} />
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Ghi chú</span>
            <textarea className="input resize-none" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
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
