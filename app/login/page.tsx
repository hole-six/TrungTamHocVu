"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Đăng nhập thất bại.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function fillDemoAccount() {
    setEmail("admin@demo.vn");
    setPassword("Demo@123");
    setError(null);
  }

  return (
    <AuthShell
      eyebrow="Đăng nhập hệ thống"
      title="Đăng nhập nhanh, đúng vai trò, vào là làm việc được."
      subtitle="Màn hình đăng nhập được tối ưu cho đội vận hành ERP: rõ ràng, ít thao tác, dễ xử lý lỗi và sẵn sàng cho từng cơ sở."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-semibold text-primary">
              Đăng ký
            </Link>
          </span>
          <Link href="/" className="font-medium text-[#5b6f99] transition hover:text-primary">
            Xem lại landing page
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="inline-flex rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#4f46e5]">
            Tài khoản ERP
          </div>
          <div>
            <h2 className="text-3xl font-black text-transparent">Chào mừng quay lại</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Nhập email và mật khẩu để truy cập dashboard, phân hệ nghiệp vụ và dữ liệu theo quyền của bạn.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-[#dbe7ff] bg-[#f8fbff] p-4 text-sm text-[#475569]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[#0f172a]">Demo nhanh để kiểm tra giao diện</p>
              <p className="mt-1 text-xs text-[#6b7aa1]">Admin demo: `admin@demo.vn` / `Demo@123`</p>
            </div>
            <button type="button" onClick={fillDemoAccount} className="btn-ghost-sm">
              Điền tài khoản demo
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-semibold text-[#24324d]">
              Email đăng nhập
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input h-14 rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="password" className="text-sm font-semibold text-[#24324d]">
                Mật khẩu
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="text-sm font-medium text-[#5b6f99] transition hover:text-primary"
              >
                {showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              </button>
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Nhập mật khẩu của bạn"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input h-14 rounded-2xl"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl border border-[#e5eaf7] bg-[#fafcff] px-4 py-4 text-sm text-[#5d6d88]">
            Sau khi đăng nhập, hệ thống sẽ điều hướng bạn vào dashboard và các phân hệ phù hợp với quyền hiện có.
          </div>

          <button type="submit" disabled={loading} className="btn-primary h-14 w-full rounded-2xl text-base">
            {loading ? "Đang xác thực..." : "Đăng nhập vào ERP"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
