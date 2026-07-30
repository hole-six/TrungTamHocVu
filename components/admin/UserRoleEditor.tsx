"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded-md border-hairline text-xs"
        value={roleId ?? ""}
        disabled={loading || isSelf}
        title={isSelf ? "Không thể tự đổi vai trò của chính mình — nhờ một Super Admin khác thực hiện" : ""}
        onChange={(e) => update({ roleId: e.target.value })}
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
        onChange={(e) => update({ branchId: e.target.value })}
      >
        <option value="">— Chưa gán chi nhánh —</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => update({ isActive: !isActive })}
        disabled={loading || (isSelf && isActive)}
        className={`text-xs ${isActive ? "text-red-600" : "text-primary"}`}
        title={isSelf && isActive ? "Không thể tự khóa tài khoản của chính mình" : ""}
      >
        {isActive ? "Khóa" : "Mở khóa"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
