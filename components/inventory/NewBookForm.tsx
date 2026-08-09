"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CategorySelect from "./CategorySelect";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import { formatVnd } from "@/lib/export-utils";

const NEW_BOOK_GUIDE_SECTIONS = [
  {
    title: "Khi nào thêm đầu sách mới?",
    items: [
      "Dùng khi kho bắt đầu quản lý một đầu sách/giáo trình mới chưa từng có trong hệ thống.",
      "Mỗi đầu sách nên là một mặt hàng rõ ràng, không gộp nhiều loại sách khác nhau vào chung một mã.",
      "Đơn giá nhập và đơn giá bán là dữ liệu nền rất quan trọng cho đối chiếu kho và học phí sách.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách nhập đúng",
    items: [
      "Tên sách nên đủ rõ để người vận hành khác nhìn là nhận ra ngay.",
      "Danh mục sách giúp lọc và gom nhóm dễ hơn về sau.",
      "Đơn giá nhập là giá vốn tham chiếu, đơn giá bán là giá dự kiến thu ra cho học viên/phụ huynh.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi hay gặp",
    items: [
      "Tạo trùng đầu sách chỉ vì khác chút cách viết tên.",
      "Nhập nhầm đơn giá nhập thành đơn giá bán hoặc ngược lại.",
      "Không gắn danh mục khi kho đã có cấu trúc phân loại rõ ràng.",
    ],
    tone: "warning" as const,
  },
];

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

    const data = await response.json().catch(() => ({}));
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

      <ResponsiveDrawer 
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm sách / giáo trình mới"
        description="Gắn danh mục để dễ lọc về sau. Nếu để trống, hệ thống sẽ hiểu là Sách khác."
        widthClassName="max-w-3xl"
        guide={<FormGuide title="Hướng dẫn thêm đầu sách mới" summary="Đây là form khởi tạo một đầu sách mới trong kho. Nếu nhập chuẩn tên, danh mục và đơn giá từ đầu thì các bước nhập kho, xuất kho, thu sách về sau sẽ rất gọn." sections={NEW_BOOK_GUIDE_SECTIONS} position="inline" />}
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
              <CategorySelect categoryOptions={categoryOptions} value={form.category} onChange={(next) => setForm((current) => ({ ...current, category: next }))} />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group">
              <span className="label-sm">Đơn giá nhập *</span>
              <input required type="number" min="0" className="input" value={form.purchasePrice} onChange={(event) => setForm((current) => ({ ...current, purchasePrice: event.target.value }))} />
              <p className="form-hint">{form.purchasePrice ? formatVnd(Number(form.purchasePrice) || 0) : ""}</p>
            </label>
            <label className="form-group">
              <span className="label-sm">Đơn giá bán *</span>
              <input required type="number" min="0" className="input" value={form.unitPrice} onChange={(event) => setForm((current) => ({ ...current, unitPrice: event.target.value }))} />
              <p className="form-hint">{form.unitPrice ? formatVnd(Number(form.unitPrice) || 0) : ""}</p>
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
      </ResponsiveDrawer>
    </>
  );
}
