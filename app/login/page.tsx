"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";

const DEMO_ACCOUNTS = [
  { role: "Giám đốc",          email: "admin@demo.vn" },
  { role: "Quản lý cơ sở",    email: "manager.demo@tach.vn" },
  { role: "Kế toán",           email: "accountant.demo@tach.vn" },
  { role: "Lễ tân",            email: "receptionist.demo@tach.vn" },
  { role: "Nhân sự",           email: "hr.demo@tach.vn" },
  { role: "Giáo vụ",          email: "registrar.demo@tach.vn" },
  { role: "Tư vấn tuyển sinh", email: "admissions.demo@tach.vn" },
  { role: "Ban Giám Đốc",      email: "board.demo@tach.vn" },
  { role: "Giáo viên",         email: "teacher.demo@tach.vn" },
  { role: "Trợ giảng",        email: "assistant.demo@tach.vn" },
];
const DEMO_PASSWORD = "Demo@123";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember]         = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [showDemo, setShowDemo]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res  = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Đăng nhập thất bại."); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="space-y-6">

        {/* Logo + heading */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-20 w-20 items-center justify-center">
            <img
              src="/img/logoTACH.png"
              alt="TACH Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-[0.12em] text-[#f97316] uppercase">ĐĂNG NHẬP</h1>
            <p className="mt-1 text-sm text-[#64748b]">Vui lòng đăng nhập để tiếp tục</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email field */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Tên đăng nhập"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-13 w-full rounded-xl border border-[#e5eaf7] bg-white pl-11 pr-4 py-3.5 text-sm text-[#0f1729] placeholder:text-[#94a3b8] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 transition"
            />
          </div>

          {/* Password field */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-13 w-full rounded-xl border border-[#e5eaf7] bg-white pl-11 pr-12 py-3.5 text-sm text-[#0f1729] placeholder:text-[#94a3b8] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#f97316] transition"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-[#e5eaf7] accent-[#f97316]"
              />
              <span className="text-sm text-[#475569]">Ghi nhớ đăng nhập</span>
            </label>
            <button type="button" className="text-sm font-semibold text-[#f97316] hover:text-[#ea580c] transition">
              Quên mật khẩu?
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-semibold text-[#b91c1c]">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="h-13 w-full rounded-xl border-2 border-[#f97316] bg-[#f97316] text-sm font-black uppercase tracking-wider text-white shadow-xl hover:border-[#ea580c] hover:bg-[#ea580c] hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Đang xác thực...
              </span>
            ) : "ĐĂNG NHẬP"}
          </button>
        </form>

        {/* Demo admin hint */}
        <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3">
          <p className="text-xs font-bold text-[#9a3412] mb-1.5">Tài khoản demo (Admin)</p>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-[#7c2d12] font-mono">admin@demo.vn</p>
              <p className="text-xs text-[#7c2d12] font-mono">Demo@123</p>
            </div>
            <button
              type="button"
              onClick={() => { setEmail("admin@demo.vn"); setPassword(DEMO_PASSWORD); setError(null); }}
              className="rounded-xl bg-[#f97316] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#ea580c] transition"
            >
              Dùng ngay
            </button>
          </div>
        </div>

        {/* Demo accounts section */}
        <div>
          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-[#e5eaf7]" />
            <span className="text-xs text-[#94a3b8]">tài khoản demo</span>
            <div className="h-px flex-1 bg-[#e5eaf7]" />
          </div>

          <button
            type="button"
            onClick={() => setShowDemo((v) => !v)}
            className="mt-3 w-full rounded-xl border-2 border-[#e5eaf7] bg-white px-4 py-2.5 text-sm font-bold text-[#475569] hover:border-[#f97316] hover:text-[#f97316] transition-all"
          >
            {showDemo ? "Ẩn danh sách demo" : "Xem tài khoản demo"}
          </button>

          {showDemo && (
            <div className="mt-3 rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
              <p className="mb-2 text-xs text-[#94a3b8]">
                Mật khẩu chung: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[#f97316] border border-[#e5eaf7]">{DEMO_PASSWORD}</code>
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => { setEmail(acc.email); setPassword(DEMO_PASSWORD); setError(null); setShowDemo(false); }}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                      email === acc.email
                        ? "border-[#f97316] bg-[#fff7ed]"
                        : "border-[#e5eaf7] bg-white hover:border-[#f97316]/50"
                    }`}
                  >
                    <span className="block font-bold text-[#0f1729]">{acc.role}</span>
                    <span className="block text-[#94a3b8] truncate">{acc.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </AuthShell>
  );
}
