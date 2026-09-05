/**
 * Permission Utilities
 * 
 * Helper functions để check permissions của user
 */

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { ModuleKey, AccessLevel } from "@/lib/server/role-matrix";

/**
 * Lấy tất cả permissions của user hiện tại
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleRef: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!user?.roleRef) {
    return [];
  }

  return user.roleRef.rolePermissions.map((rp) => rp.permission.key);
}

/**
 * Check xem user có permission cụ thể không
 */
export async function hasPermission(
  userId: string,
  permissionKey: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permissionKey);
}

/**
 * Check xem user có ít nhất 1 trong các permissions không
 */
export async function hasAnyPermission(
  userId: string,
  permissionKeys: string[]
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissionKeys.some((key) => permissions.includes(key));
}

/**
 * Check xem user có tất cả permissions không
 */
export async function hasAllPermissions(
  userId: string,
  permissionKeys: string[]
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissionKeys.every((key) => permissions.includes(key));
}

/**
 * Lấy override quyền theo module (nếu Giám đốc/Admin đã cấp thêm riêng cho user này) —
 * null nghĩa là không có override, dùng thuần quyền theo Role.
 */
export async function getUserModuleOverride(userId: string, module: ModuleKey): Promise<AccessLevel | null> {
  const row = await prisma.userModuleOverride.findUnique({
    where: { userId_module: { userId, module } },
  });
  return (row?.level as AccessLevel) ?? null;
}

/**
 * Lấy đồng thời role + override cho 1 module — dùng ở API route thay cho
 * getUserRole() đơn thuần khi module đó đã hỗ trợ override (xem
 * OVERRIDE_AWARE_MODULES trong lib/server/role-matrix.ts).
 */
export async function getUserRoleAndOverride(
  userId: string,
  module: ModuleKey
): Promise<{ role: string | null; override: AccessLevel | null }> {
  const [role, override] = await Promise.all([getUserRole(userId), getUserModuleOverride(userId, module)]);
  return { role, override };
}

/**
 * Get role code của user
 */
export async function getUserRole(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleRef: true,
    },
  });

  return user?.roleRef?.code || null;
}

/**
 * Check xem user có role cụ thể không
 */
export async function hasRole(userId: string, roleCode: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === roleCode;
}

/**
 * Lấy scope cao nhất của user cho resource cụ thể
 * Returns: "all" | "branch" | "own" | null
 */
export async function getUserScope(
  userId: string,
  resource: string,
  action: string
): Promise<"all" | "branch" | "own" | null> {
  const permissions = await getUserPermissions(userId);

  // Check theo thứ tự ưu tiên: all > branch > own
  if (permissions.includes(`${resource}.${action}.all`)) {
    return "all";
  }
  if (permissions.includes(`${resource}.${action}.branch`)) {
    return "branch";
  }
  if (permissions.includes(`${resource}.${action}.own`)) {
    return "own";
  }

  return null;
}

/**
 * Require permission - throw error nếu không có quyền
 */
export async function requirePermission(
  userId: string,
  permissionKey: string
): Promise<void> {
  const has = await hasPermission(userId, permissionKey);
  if (!has) {
    throw new Error(`Permission denied: ${permissionKey}`);
  }
}

/**
 * Middleware helper: Check permission từ session
 */
export async function checkPermissionFromSession(
  permissionKey: string
): Promise<{ allowed: boolean; user?: any }> {
  const session = await auth();

  if (!session?.user) {
    return { allowed: false };
  }

  const allowed = await hasPermission(session.user.id, permissionKey);

  return { allowed, user: session.user };
}

/**
 * Get navigation items filtered by user permissions
 */
// Route theo vai trò — PHẢI liệt kê đủ MỌI role_code đang tồn tại trong bảng roles.
// Role nào bị thiếu ở đây sẽ rơi vào "|| []" và thấy sidebar TRẮNG (không điều hướng
// được gì) dù vẫn đăng nhập được — đây là lỗi im lặng rất khó phát hiện qua UI thường,
// nên khi thêm role mới ở seed phải cập nhật map này cùng lúc.
const ROLE_ROUTES: Record<string, string[]> = {
  // Toàn quyền / điều hành — thấy hết mọi module (ghi/sửa vẫn bị chặn riêng qua permission)
  SUPER_ADMIN: ["*"],
  BOARD: ["*"], // Ban Giám Đốc — chủ yếu xem tổng hợp, quyền ghi vẫn theo permission.branch/all
  DIRECTOR: ["*"],
  BRANCH_MANAGER: ["*"], // Toàn quyền trong phạm vi cơ sở (lọc theo branch ở tầng dữ liệu)

  // Giáo vụ / Học vụ — vận hành lớp học, học viên, không đụng tài chính/lương
  REGISTRAR: ["/dashboard", "/leads", "/students", "/session-credits", "/classes", "/calendar", "/timesheets", "/reports"],

  // Tư vấn tuyển sinh — CRM là chính
  ADMISSIONS: ["/dashboard", "/leads", "/students", "/session-credits", "/calendar"],

  // Lễ tân — CRM + hỗ trợ học vụ + thu học phí cơ bản (không truy cập lương/thu-chi)
  RECEPTIONIST: ["/dashboard", "/leads", "/students", "/session-credits", "/classes", "/calendar", "/tuition", "/inventory"],

  // Kế toán / Thu ngân — tài chính là chính, thêm lịch để xem lịch tổng (đã có quyền
  // xem "schedule" ở role-matrix từ trước nhưng bị chặn nhầm ở đây, không vào được trang)
  ACCOUNTANT: ["/dashboard", "/students", "/session-credits", "/tuition", "/inventory", "/assets", "/cashbook", "/employees", "/payroll", "/teacher-tasks", "/reports", "/calendar"],

  // Nhân sự / HR — chấm công, lương, hợp đồng, thêm lịch để xem lịch tổng (lý do như trên)
  HR: ["/dashboard", "/employees", "/timesheets", "/payroll", "/teacher-tasks", "/assets", "/reports", "/calendar"],

  // Giáo viên / Trợ giảng — lịch dạy, học viên lớp mình, lương của mình
  TEACHER: ["/dashboard", "/students", "/classes", "/calendar", "/payroll", "/teacher-tasks"],
  TEACHING_ASSISTANT: ["/dashboard", "/classes", "/calendar", "/payroll", "/teacher-tasks"],
};

export async function getFilteredNavItems(userId: string) {
  const role = await getUserRole(userId);

  const allowedRoutes = role ? ROLE_ROUTES[role] || [] : [];

  // If user can access all routes
  if (allowedRoutes.includes("*")) {
    return null; // null = show all
  }

  return allowedRoutes;
}

/**
 * Check if user can access a specific route
 */
export async function canAccessRoute(userId: string, route: string): Promise<boolean> {
  const allowedRoutes = await getFilteredNavItems(userId);

  // null means can access all
  if (allowedRoutes === null) {
    return true;
  }

  // Check if route is in allowed list
  return allowedRoutes.some((allowed) => route.startsWith(allowed));
}
