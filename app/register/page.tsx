"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Đăng ký thất bại.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="Khởi tạo tài khoản"
      title="Tạo tài khoản để bắt đầu vận hành trung tâm trên ERP."
      subtitle="Thiết lập tài khoản mới cho quản trị hoặc đội vận hành, sau đó hệ thống sẽ dẫn vào dashboard để tiếp tục cấu hình."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-semibold text-primary">
              Đăng nhập
            </Link>
          </span>
          <Link href="/" className="font-medium text-[#5b6f99] transition hover:text-primary">
            Về landing page
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="inline-flex rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#4f46e5]">
            Tạo tài khoản
          </div>
          <div>
            <h2 className="text-3xl font-black text-transparent">Sẵn sàng khởi động hệ thống</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Điền thông tin cơ bản để có tài khoản đầu tiên và bước vào luồng quản trị ERP.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-semibold text-[#24324d]">
              Họ và tên
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input h-14 rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-semibold text-[#24324d]">
              Email công việc
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
              autoComplete="new-password"
              placeholder="Tối thiểu 6 ký tự"
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
            Sau khi đăng ký thành công, hệ thống sẽ đăng nhập tự động và đưa bạn đến dashboard để tiếp tục cấu hình vận hành.
          </div>

          <button type="submit" disabled={loading} className="btn-primary h-14 w-full rounded-2xl text-base">
            {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản ERP"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
