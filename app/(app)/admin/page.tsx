import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import NewBranchForm from "@/components/admin/NewBranchForm";
import UserRoleEditor from "@/components/admin/UserRoleEditor";
import Link from "next/link";

function formatDateTime(d: Date | null) {
  return d ? new Date(d).toLocaleString("vi-VN") : "—";
}

export default async function AdminPage() {
  const currentUser = await getCurrentUser();

  const [branches, users, auditLogs, roles] = await Promise.all([
    prisma.branch.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { users: true, students: true } } } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { branch: true } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { fullName: true } } } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quản trị</h1>
        <p className="mt-1 text-sm text-ink-muted48">Chi nhánh, người dùng và nhật ký hệ thống.</p>
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Import workbook ERP</h2>
            <p className="mt-1 text-sm text-ink-muted48">
              Theo dõi tiến độ import từ Excel vào ERP, dữ liệu nào đã lên DB và dữ liệu nào còn bị chặn.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/imports" className="btn-primary">
              Xem ImportJob
            </Link>
            <Link href="/admin/imports/remediation" className="btn-ghost">
              Mở Remediation
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold tracking-tight">Chi nhánh</h2>
        <div className="mt-3 space-y-2">
          {branches.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
              <span>
                <strong>{b.code}</strong> — {b.name}
              </span>
              <span className="text-ink-muted48">
                {b._count.users} người dùng · {b._count.students} học viên
              </span>
            </div>
          ))}
        </div>
        <NewBranchForm />
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-hairline px-4 py-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">Người dùng</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Họ tên</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Đăng nhập gần nhất</th>
              <th className="px-4 py-3 font-medium">Vai trò / Chi nhánh / Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-hairline last:border-0">
                <td className="px-4 py-3 font-medium">
                  {u.fullName} {u.id === currentUser?.id && <span className="text-xs text-ink-muted48">(bạn)</span>}
                </td>
                <td className="px-4 py-3 text-ink-muted80">{u.email}</td>
                <td className="px-4 py-3 text-ink-muted80">{formatDateTime(u.lastLoginAt)}</td>
                <td className="px-4 py-3">
                  <UserRoleEditor
                    userId={u.id}
                    roleId={u.roleId}
                    branchId={u.branchId}
                    isActive={u.isActive}
                    branches={branches}
                    roles={roles}
                    isSelf={u.id === currentUser?.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-hairline px-4 py-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">Nhật ký hệ thống</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Thời gian</th>
              <th className="px-4 py-3 font-medium">Người dùng</th>
              <th className="px-4 py-3 font-medium">Hành động</th>
              <th className="px-4 py-3 font-medium">Đối tượng</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id} className="border-b border-hairline last:border-0">
                <td className="px-4 py-3 text-ink-muted80">{formatDateTime(log.createdAt)}</td>
                <td className="px-4 py-3 text-ink-muted80">{log.user?.fullName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-ink/5 text-ink-muted80">{log.action}</span>
                </td>
                <td className="px-4 py-3 text-ink-muted80">
                  {log.entityType} · {log.entityId.slice(0, 8)}
                </td>
              </tr>
            ))}
            {auditLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa có nhật ký nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
