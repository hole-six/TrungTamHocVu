"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Branch = {
  id?: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
};

type Props = {
  mode: "create" | "edit";
  branch?: Branch;
  organizationId?: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function BranchDrawer({ mode, branch, organizationId, isOpen, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Branch>(
    branch ?? {
      code: "",
      name: "",
      address: "",
      phone: "",
      isActive: true,
    }
  );

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset form when branch changes or closed
  useEffect(() => {
    if (branch) {
      setForm(branch);
    } else {
      setForm({
        code: "",
        name: "",
        address: "",
        phone: "",
        isActive: true,
      });
    }
    setError(null);
  }, [branch, isOpen]);

  async function handleDelete() {
    if (!branch?.id) return;
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/branches/${branch.id}`, { method: "DELETE" });
    setLoading(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Không thể xóa cơ sở");
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "edit" && branch?.id) {
        const response = await fetch(`/api/branches/${branch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Không thể cập nhật cơ sở");
        }
      } else {
        const response = await fetch("/api/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, organizationId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Không thể tạo cơ sở");
        }
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="slideover-root">
      {/* Backdrop */}
      <div className="slideover-backdrop" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="slideover-panel max-w-2xl">
        {/* Header */}
        <div className="slideover-header">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] shadow-lg shadow-orange-500/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-ink">
                  {mode === "edit" ? "Sửa cơ sở" : "Tạo cơ sở mới"}
                </h3>
                <p className="text-sm text-ink-muted48">
                  {mode === "edit" ? "Cập nhật thông tin cơ sở" : "Thêm địa điểm mới vào hệ thống"}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-white text-ink-muted48 transition-all hover:border-[#f97316] hover:bg-orange-50 hover:text-[#f97316]"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="slideover-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Info box */}
            <div className="rounded-xl border border-orange-100 bg-orange-50/50 px-4 py-3">
              <p className="text-sm text-orange-800">
                💡 Mã cơ sở nên ngắn gọn và dễ nhớ (VD: HN01, SG01). Thông tin này sẽ được sử dụng để phân loại học viên và nhân viên.
              </p>
            </div>

            <div className="grid gap-5">
              {/* Code & Name */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-group">
                  <span className="label-sm">Mã cơ sở *</span>
                  <input
                    required
                    type="text"
                    className="input"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="VD: HN01"
                    maxLength={10}
                  />
                  <p className="text-xs text-ink-muted48 mt-1">Chữ in hoa, không dấu</p>
                </label>

                <label className="form-group">
                  <span className="label-sm">Tên cơ sở *</span>
                  <input
                    required
                    type="text"
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="VD: Chi nhánh Hà Nội"
                  />
                </label>
              </div>

              {/* Phone */}
              <label className="form-group">
                <span className="label-sm">Số điện thoại</span>
                <input
                  type="tel"
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="VD: 0901234567"
                />
              </label>

              {/* Address */}
              <label className="form-group">
                <span className="label-sm">Địa chỉ</span>
                <textarea
                  className="input min-h-[100px] resize-none"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Nhập địa chỉ đầy đủ của cơ sở"
                />
              </label>

              {/* Active Status */}
              <label className="flex items-start gap-3 rounded-xl border border-hairline bg-white px-4 py-4 cursor-pointer hover:border-[#f97316] hover:bg-orange-50/30 transition-all">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="mt-0.5 h-5 w-5 rounded border-2 border-[#cbd5e1] text-[#f97316] focus:ring-2 focus:ring-[#f97316]/20"
                />
                <div className="flex-1">
                  <p className="font-semibold text-ink">Cơ sở đang hoạt động</p>
                  <p className="text-sm text-ink-muted48 mt-1">
                    Bỏ tích nếu cơ sở tạm ngưng và không muốn hiển thị trong hệ thống
                  </p>
                </div>
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex flex-col gap-3 border-t border-hairline pt-6">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-50"
              >
                {loading ? "Đang lưu..." : mode === "edit" ? "Cập nhật cơ sở" : "Tạo cơ sở"}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost w-full py-3">
                Hủy bỏ
              </button>
            </div>

            {mode === "edit" && branch?.id ? (
              <div className="mt-2 rounded-xl border border-red-200 bg-red-50/50 px-4 py-4">
                <p className="text-sm font-semibold text-red-700">Xóa cơ sở</p>
                <p className="mt-1 text-xs leading-5 text-red-700/80">
                  Chỉ xóa được khi cơ sở chưa có nhân viên, học viên, lớp học hoặc user nào gắn vào. Thao tác không thể hoàn tác.
                </p>
                <div className="mt-3">
                  <ConfirmActionButton
                    title="Xác nhận xóa cơ sở?"
                    description={`Xóa cơ sở "${form.name}" (${form.code}) khỏi hệ thống. Thao tác này không thể hoàn tác.`}
                    confirmLabel="Xóa cơ sở"
                    tone="danger"
                    disabled={loading}
                    className="btn-danger-sm"
                    onConfirm={handleDelete}
                  >
                    {loading ? "Đang xóa..." : "Xóa cơ sở"}
                  </ConfirmActionButton>
                </div>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
