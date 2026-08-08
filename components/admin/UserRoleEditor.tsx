"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type Branch = { id: string; name: string };
type Role = { id: string; code: string; name: string };

export default function UserRoleEditor({
  userId,
  roleId,
  branchId,
  isActive,
  branches,
  roles,
  isSelf,
}: {
  userId: string;
  roleId: string | null;
  branchId: string | null;
  isActive: boolean;
  branches: Branch[];
  roles: Role[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{ field: "roleId" | "branchId"; value: string; label: string } | null>(null);

  async function update(data: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Không thể cập nhật.");
      return;
    }
    router.refresh();
  }

  async function confirmPendingChange() {
    if (!pendingChange) return;
    await update({ [pendingChange.field]: pendingChange.value });
    setPendingChange(null);
  }

  const roleLabel = roleId ? roles.find((r) => r.id === roleId)?.name ?? "Chưa gán vai trò" : "Chưa gán vai trò";
  const branchLabel = branchId ? branches.find((b) => b.id === branchId)?.name ?? "Chưa gán chi nhánh" : "Chưa gán chi nhánh";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded-md border-hairline text-xs"
        value={roleId ?? ""}
        disabled={loading || isSelf}
        title={isSelf ? "Không thể tự đổi vai trò của chính mình — nhờ một Super Admin khác thực hiện" : ""}
        onChange={(e) => {
          const nextRole = roles.find((r) => r.id === e.target.value);
          setPendingChange({ field: "roleId", value: e.target.value, label: nextRole?.name ?? "Chưa gán vai trò" });
        }}
      >
        <option value="">— Chưa gán vai trò —</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select
        className="rounded-md border-hairline text-xs"
        value={branchId ?? ""}
        disabled={loading}
        onChange={(e) => {
          const nextBranch = branches.find((b) => b.id === e.target.value);
          setPendingChange({ field: "branchId", value: e.target.value, label: nextBranch?.name ?? "Chưa gán chi nhánh" });
        }}
      >
        <option value="">— Chưa gán chi nhánh —</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <ConfirmActionButton
        title={isActive ? "Xác nhận khóa tài khoản?" : "Xác nhận mở khóa tài khoản?"}
        description={
          isActive
            ? "Người dùng này sẽ không thể đăng nhập cho đến khi được mở khóa lại."
            : "Người dùng này sẽ có thể đăng nhập và sử dụng lại hệ thống ngay sau khi xác nhận."
        }
        confirmLabel={isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
        tone={isActive ? "danger" : "default"}
        disabled={loading || (isSelf && isActive)}
        className={`text-xs ${isActive ? "text-red-600" : "text-primary"}`}
        onConfirm={() => update({ isActive: !isActive })}
      >
        {isActive ? "Khóa" : "Mở khóa"}
      </ConfirmActionButton>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}

      <ConfirmDialog
        open={!!pendingChange}
        title={pendingChange?.field === "roleId" ? "Xác nhận đổi vai trò?" : "Xác nhận đổi chi nhánh?"}
        description={
          pendingChange?.field === "roleId"
            ? `Đổi vai trò từ "${roleLabel}" sang "${pendingChange.label}" — quyền truy cập của người dùng này sẽ thay đổi ngay sau khi xác nhận.`
            : pendingChange
              ? `Đổi chi nhánh từ "${branchLabel}" sang "${pendingChange.label}" — phạm vi dữ liệu người dùng này thấy được sẽ thay đổi ngay sau khi xác nhận.`
              : undefined
        }
        confirmLabel="Xác nhận đổi"
        tone="danger"
        loading={loading}
        onConfirm={confirmPendingChange}
        onClose={() => {
          if (!loading) setPendingChange(null);
        }}
      />
    </div>
  );
}
