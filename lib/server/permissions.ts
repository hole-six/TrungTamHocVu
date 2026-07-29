import { prisma } from "@/lib/prisma";

// RBAC thật theo Role/Permission (Master Spec §10) — lớp trên cùng của session.role
// đơn giản ("admin"/"user") vốn chỉ dùng để gác /admin ở middleware. session.role
// "admin" vẫn là superuser (bypass toàn bộ) để không phá vỡ hành vi hiện có; các vai
// trò nghiệp vụ chi tiết hơn (Kế toán, Nhân viên vận hành...) đi qua roleId/Permission.
export async function getUserPermissionKeys(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roleRef: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  if (!user?.roleRef) return new Set();
  return new Set(user.roleRef.rolePermissions.map((rp) => rp.permission.key));
}

export async function hasPermission(
  currentUser: { id: string; role: string },
  resource: string,
  action: string
): Promise<boolean> {
  if (currentUser.role === "admin") return true;
  const keys = await getUserPermissionKeys(currentUser.id);
  for (const key of keys) {
    if (key.startsWith(`${resource}.${action}.`)) return true;
  }
  return false;
}
