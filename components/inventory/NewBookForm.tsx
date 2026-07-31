"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CategorySelect from "./CategorySelect";

export default function NewBookForm({ categoryOptions }: { categoryOptions: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", bookCode: "", category: "", unitPrice: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không thể tạo sách.");
      return;
    }

    setForm({ name: "", bookCode: "", category: "", unitPrice: "" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        + Thêm sách/giáo trình
      </button>
    );
  }

  return (
    <div className="w-full rounded-[28px] border border-[#dbe7ff] bg-white/95 p-5 shadow-[0_18px_50px_-32px_rgba(14,116,144,0.35)] lg:w-[920px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Khai báo đầu sách</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">Thêm sách / giáo trình mới</h3>
          <p className="mt-1 text-sm text-ink-muted48">Nên gắn danh mục để sau này lọc theo nhóm sách. Nếu để trống, hệ thống sẽ hiểu là `Sách khác`.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Đóng
        </button>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="form-group md:col-span-2">
            <span className="label-sm">Tên sách *</span>
            <input required className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>

          <label className="form-group">
            <span className="label-sm">Mã sách</span>
            <input className="input" value={form.bookCode} onChange={(event) => setForm((current) => ({ ...current, bookCode: event.target.value }))} />
          </label>

          <label className="form-group">
            <span className="label-sm">Danh mục sách</span>
            <CategorySelect
              categoryOptions={categoryOptions}
              value={form.category}
              onChange={(next) => setForm((current) => ({ ...current, category: next }))}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
          <label className="form-group">
            <span className="label-sm">Đơn giá *</span>
            <input required type="number" min="0" className="input" value={form.unitPrice} onChange={(event) => setForm((current) => ({ ...current, unitPrice: event.target.value }))} />
          </label>
          <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
            <p className="font-semibold text-ink">Mẹo nhập liệu</p>
            <p className="mt-1">Danh mục nên là tên nhóm chung, ví dụ `Everybody Up 1`, `Ngữ pháp 7`, `Sách bổ trợ`. Sách cụ thể giữ ở trường tên sách.</p>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
            Hủy
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Đang lưu..." : "Lưu đầu sách"}
          </button>
        </div>
      </form>
    </div>
  );
}
