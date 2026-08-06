"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Branch = { id: string; name: string };
type Role = { id: string; code: string; name: string };

type UserItem = {
  id: string;
  email: string;
  fullName: string;
  roleId: string | null;
  branchId: string | null;
  isActive: boolean;
};

export default function UserEditDrawer({
  user,
  branches,
  roles,
  triggerClassName,
}: {
  user: UserItem;
  branches: Branch[];
  roles: Role[];
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: user.email,
    fullName: user.fullName,
    roleId: user.roleId ?? "",
    branchId: user.branchId ?? "",
    isActive: user.isActive,
    password: "",
  });

  async function save() {
    setError(null);

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        fullName: form.fullName,
        roleId: form.roleId || null,
        branchId: form.branchId || null,
        isActive: form.isActive,
        password: form.password || undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Không thể lưu người dùng.");
      throw new Error(data.error ?? "save_failed");
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex items-center justify-center rounded-xl border border-[#dbe7ff] px-4 py-2 text-sm font-semibold text-[#235f9d] transition hover:bg-[#f7fbff]"
        }
      >
        Sửa
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Sửa người dùng"
        description="Cập nhật thông tin, vai trò, chi nhánh, trạng thái hoạt động và mật khẩu nếu cần."
        widthClassName="max-w-3xl"
      >
        <div className="space-y-6">
          <div className="grid gap-3 rounded-[24px] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8aa0ba]">Tài khoản</p>
              <p className="mt-1 text-sm font-semibold text-[#16324a]">{user.email}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8aa0ba]">Vai trò hiện tại</p>
              <p className="mt-1 text-sm font-semibold text-[#16324a]">{roles.find((role) => role.id === form.roleId)?.name ?? "Chưa gán"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8aa0ba]">Trạng thái</p>
              <p className="mt-1 text-sm font-semibold text-[#16324a]">{form.isActive ? "Đang hoạt động" : "Đã khóa"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="form-group">
              <span className="label">Họ và tên</span>
              <input className="input" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Email đăng nhập</span>
              <input className="input" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Vai trò</span>
              <select className="input" value={form.roleId} onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}>
                <option value="">— Chưa gán vai trò —</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-group">
              <span className="label">Chi nhánh</span>
              <select className="input" value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}>
                <option value="">— Chưa gán chi nhánh —</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-group sm:col-span-2">
              <span className="label">Mật khẩu mới</span>
              <input
                className="input"
                type="text"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Để trống nếu không đổi"
              />
              <p className="form-hint">Chỉ nhập khi cần cấp lại mật khẩu cho người dùng này.</p>
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-[#e8eef8] bg-white px-4 py-4">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-5 w-5 rounded border-2 border-gray-300 text-primary"
            />
            <div>
              <p className="text-sm font-semibold text-[#12304a]">Kích hoạt tài khoản</p>
              <p className="mt-1 text-xs text-[#6b7a8c]">Tắt tùy chọn này nếu muốn khóa đăng nhập của người dùng.</p>
            </div>
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1">
              Hủy
            </button>
            <ConfirmActionButton
              title="Xác nhận lưu thay đổi?"
              description={`Bạn có chắc chắn muốn cập nhật tài khoản ${user.fullName}? Các thay đổi về vai trò, chi nhánh hoặc mật khẩu sẽ có hiệu lực ngay.`}
              confirmLabel="Lưu thay đổi"
              className="btn-primary flex-1"
              onConfirm={save}
            >
              Lưu thay đổi
            </ConfirmActionButton>
          </div>
        </div>
      </ResponsiveDrawer>
    </>
  );
}
