"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Đăng nhập</h1>
        <p className="mt-1 text-sm text-ink-muted48">Hệ thống quản lý trung tâm</p>
      </div>
      <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        <input
          type="password"
          required
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-1">
          {loading ? "Đang xử lý..." : "Đăng nhập"}
        </button>
      </form>
      <p className="text-center text-sm text-ink-muted48">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="text-primary">
          Đăng ký
        </Link>
      </p>
      <p className="text-center text-xs text-ink-muted48/70">Demo: admin@demo.vn / Demo@123</p>
    </main>
  );
}
