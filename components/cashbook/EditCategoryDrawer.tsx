"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Category = {
  id: string;
  type: string;
  name: string;
  detail: string | null;
};

type EditCategoryDrawerProps = {
  category: Category;
  trigger: React.ReactNode;
};

export default function EditCategoryDrawer({ category, trigger }: EditCategoryDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: category.name, detail: category.detail ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/cash-categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không thể lưu danh mục.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    const response = await fetch(`/api/cash-categories/${category.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "Không thể xóa danh mục.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  function handleClose() {
    setOpen(false);
    setForm({ name: category.name, detail: category.detail ?? "" });
    setError(null);
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>

      <ResponsiveDrawer open={open} onClose={handleClose} title="Chỉnh sửa danh mục" widthClassName="max-w-md">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-4">
            <div className="form-group">
              <span className="label">Loại danh mục</span>
              <div className="rounded-lg border border-hairline bg-[#f8fafc] px-4 py-3">
                <span className={`badge ${category.type === "THU" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {category.type === "THU" ? "Thu" : "Chi"}
                </span>
              </div>
              <p className="hint">Không thể đổi loại danh mục sau khi tạo.</p>
            </div>

            <label className="form-group">
              <span className="label">
                Tên danh mục <span className="text-red-600">*</span>
              </span>
              <input
                required
                placeholder="VD: Thu học phí ngoài hệ thống, chi mua vật tư..."
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <p className="hint">Tên ngắn gọn, dễ hiểu để phân loại giao dịch.</p>
            </label>

            <label className="form-group">
              <span className="label">Chi tiết loại</span>
              <input
                placeholder="Mô tả ngắn để người nhập tiền hiểu đúng"
                className="input"
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
              />
              <p className="hint">Thông tin bổ sung giúp phân biệt các danh mục tương tự.</p>
            </label>
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-hairline pt-4">
            <ConfirmActionButton
              title="Xác nhận xóa danh mục?"
              description={`Xóa danh mục "${category.name}"${category.detail ? ` (${category.detail})` : ""}. Chỉ xóa được khi chưa có giao dịch nào dùng danh mục này.`}
              confirmLabel="Xóa danh mục"
              tone="danger"
              className="btn-ghost text-red-600"
              onConfirm={handleDelete}
            >
              Xóa danh mục
            </ConfirmActionButton>

            <div className="flex gap-3">
              <button type="button" onClick={handleClose} className="btn-ghost">
                Hủy
              </button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </form>
      </ResponsiveDrawer>
    </>
  );
}
