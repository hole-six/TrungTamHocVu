"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CategorySelect from "./CategorySelect";
import SlideOver from "@/components/ui/SlideOver";

export default function NewBookForm({ categoryOptions }: { categoryOptions: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", bookCode: "", category: "", purchasePrice: "", unitPrice: "" });
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

    setForm({ name: "", bookCode: "", category: "", purchasePrice: "", unitPrice: "" });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        + Thêm sách/giáo trình
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm sách / giáo trình mới"
        description="Gắn danh mục để dễ lọc về sau. Nếu để trống, hệ thống sẽ hiểu là Sách khác."
        widthClassName="max-w-3xl"
      >
        <form onSubmit={submit} className="grid gap-4">
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

          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group">
              <span className="label-sm">Đơn giá nhập *</span>
              <input
                required
                type="number"
                min="0"
                className="input"
                value={form.purchasePrice}
                onChange={(event) => setForm((current) => ({ ...current, purchasePrice: event.target.value }))}
              />
            </label>
            <label className="form-group">
              <span className="label-sm">Đơn giá bán *</span>
              <input required type="number" min="0" className="input" value={form.unitPrice} onChange={(event) => setForm((current) => ({ ...current, unitPrice: event.target.value }))} />
            </label>
         
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
      </SlideOver>
    </>
  );
}
