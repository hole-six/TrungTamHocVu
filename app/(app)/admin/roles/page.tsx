import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Quản lý Vai trò",
};

export default async function RolesPage() {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const roles = await prisma.role.findMany({
    include: {
      _count: {
        select: {
          users: true,
          rolePermissions: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Quản lý Vai trò</h1>
          <p className="mt-1 text-sm text-ink-muted48">Quản lý roles và permissions trong hệ thống</p>
        </div>
        <Link href="/admin" className="btn-ghost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại Admin
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-ink-muted48">Tổng vai trò</p>
              <p className="text-2xl font-bold text-ink">{roles.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-ink-muted48">Tổng users</p>
              <p className="text-2xl font-bold text-ink">{roles.reduce((sum, role) => sum + role._count.users, 0)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-ink-muted48">Tổng quyền</p>
              <p className="text-2xl font-bold text-ink">{roles.reduce((sum, role) => sum + role._count.rolePermissions, 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <div key={role.id} className="card transition-shadow hover:shadow-lg">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/30">
                  <span className="text-lg font-bold text-white">{role.code.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-ink">{role.name}</h3>
                  <p className="text-xs font-mono text-ink-muted48">{role.code}</p>
                </div>
              </div>
              {role.code === "SUPER_ADMIN" && <span className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">🔒 Toàn quyền</span>}
            </div>

            {role.description && <p className="mb-4 text-sm text-ink-muted64">{role.description}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#e8edf5] bg-[#fafbff] p-3">
                <div className="mb-1 flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                  <p className="text-xs text-ink-muted48">Users</p>
                </div>
                <p className="text-lg font-bold text-ink">{role._count.users}</p>
              </div>

              <div className="rounded-lg border border-[#e8edf5] bg-[#fafbff] p-3">
                <div className="mb-1 flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <p className="text-xs text-ink-muted48">Permissions</p>
                </div>
                <p className="text-lg font-bold text-ink">{role._count.rolePermissions}</p>
              </div>
            </div>

            <div className="mt-4 border-t border-[#e8edf5] pt-4">
              <Link href={`/admin/roles/${role.id}`} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-focus">
                Xem chi tiết & Permissions
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="card border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div>
            <h4 className="mb-1 text-sm font-bold text-ink">💡 Thông tin về Roles</h4>
            <ul className="space-y-1 text-xs text-ink-muted64">
              <li>• <strong>DIRECTOR:</strong> Toàn quyền hệ thống, xem tất cả cơ sở</li>
              <li>• <strong>ACCOUNTANT:</strong> Quản lý tài chính, học phí, lương</li>
              <li>• <strong>RECEPTIONIST:</strong> Tuyển sinh, ghi danh, thu tiền</li>
              <li>• <strong>TEACHER:</strong> Xem lịch dạy, điểm danh lớp mình; công dạy lấy từ buổi học đã phân công</li>
              <li>• <strong>BRANCH_MANAGER:</strong> Quản lý toàn bộ cơ sở của mình</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
