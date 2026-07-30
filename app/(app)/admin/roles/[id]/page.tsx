import { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import PermissionToggle from "@/components/admin/PermissionToggle";

export const metadata: Metadata = { title: "Chi tiết vai trò" };

export default async function RoleDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const [role, allPermissions] = await Promise.all([
    prisma.role.findUnique({
      where: { id: params.id },
      include: {
        rolePermissions: { select: { permissionId: true } },
        users: { select: { id: true, fullName: true, email: true, isActive: true }, orderBy: { fullName: "asc" } },
      },
    }),
    prisma.permission.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }, { scope: "asc" }] }),
  ]);

  if (!role) notFound();

  // MỌI role đều có isSystem=true (role dựng sẵn, không xoá được) — chỉ riêng
  // SUPER_ADMIN mới thật sự bỏ qua hasPermission() nhờ cờ role="admin", nên chỉ
  // khoá sửa permission cho đúng role này, không dùng isSystem chung chung.
  const isSuperAdmin = role.code === "SUPER_ADMIN";
  const grantedIds = new Set(role.rolePermissions.map((rp) => rp.permissionId));
  const grouped = new Map<string, typeof allPermissions>();
  for (const p of allPermissions) {
    const list = grouped.get(p.resource) ?? [];
    list.push(p);
    grouped.set(p.resource, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            {role.name} <span className="font-mono text-base font-normal text-ink-muted48">({role.code})</span>
          </h1>
          {role.description && <p className="mt-1 text-sm text-ink-muted48">{role.description}</p>}
        </div>
        <Link href="/admin/roles" className="btn-ghost">
          ← Quay lại danh sách vai trò
        </Link>
      </div>

      {isSuperAdmin && (
        <div className="card border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-800">
            🔒 <strong>{role.name}</strong> luôn có toàn quyền trên mọi module (bỏ qua toàn bộ kiểm tra permission bên dưới)
            — vì vậy các ô chọn ở đây chỉ hiển thị để tham khảo và không thể chỉnh sửa.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="font-display text-base font-bold text-ink">
          Người dùng có vai trò này <span className="font-normal text-ink-muted48">({role.users.length})</span>
        </h2>
        {role.users.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted48">Chưa có ai được gán vai trò này.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {role.users.map((u) => (
              <span
                key={u.id}
                className={`rounded-lg border px-2.5 py-1 text-xs ${u.isActive ? "border-hairline" : "border-red-200 bg-red-50 text-red-700"}`}
              >
                {u.fullName} {!u.isActive && "(đã khoá)"}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-base font-bold text-ink">
          Permissions <span className="font-normal text-ink-muted48">({grantedIds.size}/{allPermissions.length} đã cấp)</span>
        </h2>
        {Array.from(grouped.entries()).map(([resource, perms]) => {
          const grantedInGroup = perms.filter((p) => grantedIds.has(p.id)).length;
          return (
            <details key={resource} className="card" open={grantedInGroup > 0}>
              <summary className="cursor-pointer select-none font-display text-sm font-bold text-ink">
                {resource} <span className="font-normal text-ink-muted48">({grantedInGroup}/{perms.length})</span>
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {perms.map((p) => (
                  <PermissionToggle
                    key={p.id}
                    roleId={role.id}
                    permissionId={p.id}
                    granted={grantedIds.has(p.id)}
                    disabled={isSuperAdmin}
                    label={p.key}
                    description={p.description}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
