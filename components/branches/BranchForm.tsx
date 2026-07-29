"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Branch = {
  id?: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
};

export default function BranchForm({ 
  branch, 
  organizationId,
  mode = "create" 
}: { 
  branch?: Branch; 
  organizationId: string;
  mode?: "create" | "edit" 
}) {
  const router = useRouter();
  const [form, setForm] = useState<Branch>(
    branch ?? {
      code: "",
      name: "",
      address: "",
      phone: "",
      isActive: true,
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = mode === "edit" && branch?.id 
      ? `/api/branches/${branch.id}` 
      : "/api/branches";
    const method = mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, organizationId }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Không thể lưu thông tin cơ sở.");
      return;
    }

    if (mode === "create") {
      router.push(`/admin/branches`);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">
            {mode === "edit" ? "Chỉnh sửa cơ sở" : "Thêm cơ sở mới"}
          </h1>
          <p className="text-sm text-ink-muted48">Quản lý chi nhánh / cơ sở</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="rounded-xl border border-[#e8edf5] bg-gradient-to-br from-white to-[#fafbff] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
            </div>
            <h3 className="text-sm font-bold text-ink">Thông tin cơ sở</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="form-group">
              <label className="label">
                Mã cơ sở <span className="text-red-500">*</span>
              </label>
              <input
                required
                className="input font-mono"
                placeholder="CS1, CS2, CS3..."
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                disabled={mode === "edit"}
              />
              <p className="text-xs text-ink-muted48 mt-1">Mã duy nhất, không thể thay đổi sau khi tạo</p>
            </div>

            <div className="form-group">
              <label className="label">
                Tên cơ sở <span className="text-red-500">*</span>
              </label>
              <input
                required
                className="input"
                placeholder="VD: Cơ sở 1 - Quận 1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="label">Số điện thoại</label>
              <input
                type="tel"
                className="input font-mono"
                placeholder="0912345678"
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="label">Địa chỉ</label>
              <input
                className="input"
                placeholder="123 Đường ABC, Quận XYZ"
                value={form.address ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="rounded-xl border border-[#e8edf5] bg-gradient-to-br from-white to-[#fafbff] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <h3 className="text-sm font-bold text-ink">Trạng thái hoạt động</h3>
          </div>

          <label className="flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all hover:border-primary/50">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="h-5 w-5 rounded border-2 text-primary"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Cơ sở đang hoạt động</p>
              <p className="text-xs text-ink-muted48 mt-0.5">
                {form.isActive 
                  ? "Cơ sở này đang hoạt động và có thể nhận học viên mới" 
                  : "Cơ sở tạm ngưng, không hiển thị trong danh sách chọn"}
              </p>
            </div>
            {form.isActive ? (
              <span className="inline-flex items-center rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                ✅ Hoạt động
              </span>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                ⏸️ Tạm ngưng
              </span>
            )}
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="alert-danger flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-ghost"
          >
            Hủy
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
                </svg>
                Đang lưu...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                {mode === "edit" ? "Cập nhật" : "Tạo cơ sở"}
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
