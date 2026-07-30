"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Branch = { id: string; code: string; name: string };
type Role = { id: string; code: string; name: string };

export default function NewUserForm({ branches, roles }: { branches: Branch[]; roles: Role[] }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, roleId: roleId || null, branchId: branchId || null }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Không thể tạo tài khoản.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="form-group">
          <label className="label">
            Họ và tên <span className="text-red-500">*</span>
          </label>
          <input
            required
            className="input"
            placeholder="Nguyễn Văn A"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="label">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="email"
            className="input"
            placeholder="ten@trungtam.vn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="label">
            Mật khẩu ban đầu <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="text"
            className="input font-mono"
            placeholder="Tối thiểu 6 ký tự"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-muted48">Gửi mật khẩu này cho nhân viên qua kênh riêng tư, không qua nhóm chat chung.</p>
        </div>
        <div className="form-group">
          <label className="label">Vai trò</label>
          <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">— Chưa gán vai trò —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Chi nhánh</label>
          <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">— Chưa gán chi nhánh —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert-danger">{error}</div>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => router.back()} className="btn-ghost">
          Hủy
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Đang tạo..." : "Tạo tài khoản"}
        </button>
      </div>
    </form>
  );
}
