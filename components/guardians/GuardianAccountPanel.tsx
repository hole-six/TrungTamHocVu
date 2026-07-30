"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GuardianAccountPanel({
  guardianId,
  account,
  defaultEmail,
}: {
  guardianId: string;
  account: { email: string; isActive: boolean } | null;
  defaultEmail: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(account?.email ?? defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function grantOrReset() {
    setLoading(true);
    setError(null);
    setTempPassword(null);
    const res = await fetch(`/api/guardians/${guardianId}/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể cấp tài khoản.");
      return;
    }
    setTempPassword(data.tempPassword);
    router.refresh();
  }

  async function revoke() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/guardians/${guardianId}/account`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể thu hồi tài khoản.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Tài khoản cổng phụ huynh</h2>
      <p className="mt-1 text-xs text-ink-muted48">
        Cấp tài khoản để phụ huynh tự đăng nhập xem học phí, nhật ký lớp học và lịch học của con.
      </p>

      {account && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
          <div>
            <p className="font-medium text-ink">{account.email}</p>
            <span className={`badge ${account.isActive ? "bg-primary/10 text-primary" : "bg-ink/5 text-ink-muted48"}`}>
              {account.isActive ? "Đang hoạt động" : "Đã thu hồi"}
            </span>
          </div>
          {account.isActive && (
            <button type="button" onClick={revoke} disabled={loading} className="text-xs font-semibold text-red-600">
              Thu hồi
            </button>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <label className="label-sm">Email đăng nhập</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="phuhuynh@email.com"
          className="input-sm"
          disabled={loading}
        />
        <button type="button" onClick={grantOrReset} disabled={loading || !email} className="btn-primary-sm w-full">
          {account ? "Cấp lại mật khẩu mới" : "Cấp tài khoản"}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {tempPassword && (
        <div className="alert-success mt-3">
          <p className="font-semibold">Đã cấp thành công — gửi thông tin này cho phụ huynh:</p>
          <p className="mt-1">
            Email: <strong>{email}</strong> · Mật khẩu tạm: <strong className="font-mono">{tempPassword}</strong>
          </p>
          <p className="mt-1 text-xs">Mật khẩu này chỉ hiện 1 lần — hãy sao chép/gửi ngay, hệ thống không lưu lại dạng chữ để xem sau.</p>
        </div>
      )}
    </div>
  );
}
