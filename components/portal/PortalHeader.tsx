"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PortalHeader({ fullName }: { fullName: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-hairline bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/portal" className="font-display text-lg font-bold tracking-tight text-ink">
          Cổng phụ huynh
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-muted48">{fullName}</span>
          <button type="button" onClick={logout} className="btn-ghost-sm">
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
