import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import UserRoleEditor from "@/components/admin/UserRoleEditor";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

function formatDateTime(d: Date | null) {
  return d ? new Date(d).toLocaleString("vi-VN") : "—";
}

const USERS_PAGE_SIZE = 20;
const LOGS_PAGE_SIZE = 25;

function buildQuery(base: Record<string, string | undefined>, overrides: Record<string, string | number>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...overrides })) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { userQuery?: string; userPage?: string; logEntity?: string; logPage?: string };
}) {
  const currentUser = await getCurrentUser();

  const userQuery = searchParams.userQuery?.trim() ?? "";
  const userPage = Math.max(1, Number(searchParams.userPage) || 1);
  const logEntity = searchParams.logEntity?.trim() ?? "";
  const logPage = Math.max(1, Number(searchParams.logPage) || 1);

  const userWhere: Prisma.UserWhereInput = userQuery
    ? { OR: [{ fullName: { contains: userQuery } }, { email: { contains: userQuery } }] }
    : {};
  const logWhere: Prisma.AuditLogWhereInput = logEntity ? { entityType: logEntity } : {};

  const [branches, roles, userTotal, users, logTotal, auditLogs, entityTypes] = await Promise.all([
    prisma.branch.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { users: true, students: true } } } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.user.count({ where: userWhere }),
    prisma.user.findMany({
      where: userWhere,
      orderBy: { createdAt: "asc" },
      include: { branch: true },
      skip: (userPage - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
    }),
    prisma.auditLog.count({ where: logWhere }),
    prisma.auditLog.findMany({
      where: logWhere,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { fullName: true } } },
      skip: (logPage - 1) * LOGS_PAGE_SIZE,
      take: LOGS_PAGE_SIZE,
    }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);

  const userPageCount = Math.max(1, Math.ceil(userTotal / USERS_PAGE_SIZE));
  const logPageCount = Math.max(1, Math.ceil(logTotal / LOGS_PAGE_SIZE));
  const userBaseQuery = { userQuery: searchParams.userQuery, logEntity: searchParams.logEntity, logPage: searchParams.logPage };
  const logBaseQuery = { userQuery: searchParams.userQuery, userPage: searchParams.userPage, logEntity: searchParams.logEntity };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quản trị</h1>
        <p className="mt-1 text-sm text-ink-muted48">Chi nhánh, người dùng, vai trò và nhật ký hệ thống.</p>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Chi nhánh & vai trò</h2>
            <p className="mt-1 text-sm text-ink-muted48">
              {branches.length} cơ sở · {branches.reduce((s, b) => s + b._count.users, 0)} người dùng ·{" "}
              {branches.reduce((s, b) => s + b._count.students, 0)} học viên · {roles.length} vai trò
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/branches" className="btn-primary">
              Quản lý chi nhánh
            </Link>
            <Link href="/admin/roles" className="btn-ghost">
              Quản lý vai trò
            </Link>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex flex-col gap-3 border-b border-hairline px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Người dùng <span className="text-sm font-normal text-ink-muted48">({userTotal})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <form action="/admin" method="GET" className="flex items-center gap-2">
              {logEntity && <input type="hidden" name="logEntity" value={logEntity} />}
              <input
                type="search"
                name="userQuery"
                defaultValue={userQuery}
                placeholder="Tìm tên hoặc email..."
                className="rounded-md border-hairline text-xs"
              />
              <button type="submit" className="btn-ghost text-xs">
                Tìm
              </button>
            </form>
            <Link href="/admin/users/new" className="btn-primary text-xs">
              + Tạo người dùng
            </Link>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Họ tên</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Đăng nhập gần nhất</th>
              <th className="px-4 py-3 font-medium">Vai trò / Chi nhánh / Trạng thái</th>
              <th className="px-4 py-3 font-medium"></th>
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
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/users/${u.id}`} className="text-xs text-primary">
                    Chi tiết →
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted48">
                  Không tìm thấy người dùng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {userPageCount > 1 && (
          <div className="flex items-center justify-between border-t border-hairline px-4 py-3 text-xs text-ink-muted48">
            <span>
              Trang {userPage}/{userPageCount}
            </span>
            <div className="flex gap-2">
              {userPage > 1 && (
                <Link href={`/admin${buildQuery(userBaseQuery, { userPage: userPage - 1 })}`} className="btn-ghost">
                  ← Trước
                </Link>
              )}
              {userPage < userPageCount && (
                <Link href={`/admin${buildQuery(userBaseQuery, { userPage: userPage + 1 })}`} className="btn-ghost">
                  Sau →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex flex-col gap-3 border-b border-hairline px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Nhật ký hệ thống <span className="text-sm font-normal text-ink-muted48">({logTotal})</span>
          </h2>
          <form action="/admin" method="GET" className="flex items-center gap-2">
            {userQuery && <input type="hidden" name="userQuery" value={userQuery} />}
            <select name="logEntity" defaultValue={logEntity} className="rounded-md border-hairline text-xs">
              <option value="">Tất cả đối tượng</option>
              {entityTypes.map((e) => (
                <option key={e.entityType} value={e.entityType}>
                  {e.entityType}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-ghost text-xs">
              Lọc
            </button>
          </form>
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
                <td className="px-4 py-3 text-ink-muted80">{log.user?.fullName ?? "Hệ thống (tự động)"}</td>
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
        {logPageCount > 1 && (
          <div className="flex items-center justify-between border-t border-hairline px-4 py-3 text-xs text-ink-muted48">
            <span>
              Trang {logPage}/{logPageCount}
            </span>
            <div className="flex gap-2">
              {logPage > 1 && (
                <Link href={`/admin${buildQuery(logBaseQuery, { logPage: logPage - 1 })}`} className="btn-ghost">
                  ← Trước
                </Link>
              )}
              {logPage < logPageCount && (
                <Link href={`/admin${buildQuery(logBaseQuery, { logPage: logPage + 1 })}`} className="btn-ghost">
                  Sau →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
