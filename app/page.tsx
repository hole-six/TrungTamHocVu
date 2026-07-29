import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-display text-4xl font-semibold tracking-tight">TACH</h1>
      <p className="text-ink-muted48">
        Hệ thống quản lý trung tâm: tuyển sinh, học viên, lớp học, học phí, kho giáo trình, thu chi, nhân sự & lương.
      </p>

      {session ? (
        <div className="flex flex-col items-center gap-3">
          <p>
            Xin chào, <strong>{session.fullName}</strong> ({session.role})
          </p>
          <Link href="/dashboard" className="btn-primary">
            Vào hệ thống
          </Link>
        </div>
      ) : (
        <div className="flex gap-3">
          <Link href="/login" className="btn-primary">
            Đăng nhập
          </Link>
          <Link href="/register" className="btn-secondary">
            Đăng ký
          </Link>
        </div>
      )}
    </main>
  );
}
