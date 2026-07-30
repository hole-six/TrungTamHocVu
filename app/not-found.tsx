import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted48">404</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Không tìm thấy trang</h1>
        <p className="text-ink-muted48">
          Liên kết có thể đã thay đổi, hoặc bạn chưa có quyền vào khu vực này.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/dashboard" className="btn-primary">
          Về tổng quan
        </Link>
        <Link href="/" className="btn-ghost">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
