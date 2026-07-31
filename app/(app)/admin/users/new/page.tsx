import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/current-user";
import { prisma } from "@/lib/prisma";
import NewUserForm from "@/components/admin/NewUserForm";

export const metadata = { title: "Tạo người dùng mới" };

export default async function NewUserPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    redirect("/dashboard");
  }

  const [branches, roles] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
  ]);

  return (
    <div className="page-shell page-shell-compact">
      <div className="flex items-center gap-3">
        <a
          href="/admin"
          className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-hairline bg-white transition-all hover:border-primary/50 hover:shadow-md"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </a>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Tạo người dùng mới</h1>
          <p className="mt-1 text-sm text-ink-muted48">Cấp tài khoản đăng nhập cho nhân viên — chỉ Super Admin thực hiện được.</p>
        </div>
      </div>

      <NewUserForm branches={branches} roles={roles} />
    </div>
  );
}
