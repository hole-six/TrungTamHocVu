/**
 * Branch Filter Utilities
 * 
 * Giúp lọc dữ liệu theo cơ sở (branch) của user hiện tại.
 * Admin có thể xem tất cả cơ sở, user thường chỉ xem cơ sở của mình.
 */

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Cookie đọc/ghi bởi BranchSelector.tsx — "cơ sở đang xem" của phiên làm việc hiện
// tại, KHÔNG phải quyền hạn (quyền hạn vẫn kiểm bằng hasAllBranchAccess bên dưới).
// Chỉ có tác dụng khi requestedBranchId không được truyền tường minh (query string
// vẫn luôn được ưu tiên hơn, giữ đúng hành vi của các route đã dùng từ trước).
const ACTIVE_BRANCH_COOKIE = "active_branch_id";

function getActiveBranchCookie(): string | null {
  try {
    return cookies().get(ACTIVE_BRANCH_COOKIE)?.value || null;
  } catch {
    return null;
  }
}

/**
 * Lấy branchId từ session hoặc query parameter
 * - Admin: có thể chọn branchId từ URL (?branchId=xxx), cookie "cơ sở đang xem", hoặc xem tất cả
 * - User thường: chỉ xem branchId của mình
 */
export async function getCurrentBranchId(requestedBranchId?: string | null): Promise<string | null> {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const effectiveRequestedBranchId = requestedBranchId ?? getActiveBranchCookie();

  // Lấy thông tin user đầy đủ từ DB
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      branchId: true,
      role: true,
      roleRef: {
        select: {
          code: true,
          rolePermissions: {
            select: {
              permission: {
                select: {
                  scope: true,
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    return null;
  }

  // Kiểm tra nếu user có quyền xem "all" branches
  const hasAllBranchAccess = 
    user.role === "admin" || 
    user.roleRef?.rolePermissions.some(
      rp => rp.permission.scope === "all"
    );

  // Nếu là admin và có effectiveRequestedBranchId (query string hoặc cookie), cho phép xem branch đó
  if (hasAllBranchAccess && effectiveRequestedBranchId) {
    // Verify branch exists
    const branchExists = await prisma.branch.findUnique({
      where: { id: effectiveRequestedBranchId },
      select: { id: true }
    });

    if (branchExists) {
      return effectiveRequestedBranchId;
    }
  }

  // Nếu là admin nhưng không chọn branch cụ thể, return null (xem tất cả)
  if (hasAllBranchAccess && !effectiveRequestedBranchId) {
    return null; // null = xem tất cả
  }

  // User thường chỉ xem branch của mình
  return user.branchId;
}

/**
 * Tạo where clause để lọc theo branch
 * Usage trong API:
 * 
 * const branchWhere = await getBranchWhereClause(searchParams.get("branchId"));
 * const students = await prisma.student.findMany({
 *   where: {
 *     ...branchWhere,
 *     // ... other conditions
 *   }
 * });
 */
export async function getBranchWhereClause(
  requestedBranchId?: string | null
): Promise<{ branchId?: string } | {}> {
  const branchId = await getCurrentBranchId(requestedBranchId);
  
  // null = admin xem tất cả, không filter
  if (branchId === null) {
    return {};
  }
  
  // Có branchId = filter theo branch đó
  return { branchId };
}

/**
 * Kiểm tra user có quyền truy cập resource thuộc branch nào đó không
 */
export async function canAccessBranch(branchId: string): Promise<boolean> {
  const session = await auth();
  
  if (!session?.user) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      branchId: true,
      role: true,
      roleRef: {
        select: {
          rolePermissions: {
            select: {
              permission: {
                select: {
                  scope: true,
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    return false;
  }

  // Admin có thể truy cập tất cả branch
  const hasAllBranchAccess = 
    user.role === "admin" || 
    user.roleRef?.rolePermissions.some(
      rp => rp.permission.scope === "all"
    );

  if (hasAllBranchAccess) {
    return true;
  }

  // User thường chỉ truy cập branch của mình
  return user.branchId === branchId;
}

/**
 * Lấy danh sách branches mà user có quyền xem
 */
export async function getAccessibleBranches(): Promise<{
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  _count: {
    users: number;
    employees: number;
    students: number;
    classes: number;
  };
}[]> {
  const session = await auth();
  
  if (!session?.user) {
    return [];
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      branchId: true,
      role: true,
      roleRef: {
        select: {
          rolePermissions: {
            select: {
              permission: {
                select: {
                  scope: true,
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    return [];
  }

  // Admin xem tất cả branches
  const hasAllBranchAccess = 
    user.role === "admin" || 
    user.roleRef?.rolePermissions.some(
      rp => rp.permission.scope === "all"
    );

  if (hasAllBranchAccess) {
    return await prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        phone: true,
        isActive: true,
        _count: {
          select: {
            users: true,
            employees: true,
            students: true,
            classes: true,
          },
        },
      },
      orderBy: { code: "asc" }
    });
  }

  // User thường chỉ xem branch của mình
  if (user.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: user.branchId },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        phone: true,
        isActive: true,
        _count: {
          select: {
            users: true,
            employees: true,
            students: true,
            classes: true,
          },
        },
      }
    });
    
    return branch ? [branch] : [];
  }

  return [];
}

/**
 * Validate và trả về branchId hợp lệ khi tạo mới resource
 * Ưu tiên: requestedBranchId > user's branchId > first active branch
 */
export async function getValidBranchIdForCreation(
  requestedBranchId?: string | null
): Promise<string | null> {
  const session = await auth();
  
  if (!session?.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      branchId: true,
      role: true,
    }
  });

  if (!user) {
    return null;
  }

  const effectiveRequestedBranchId = requestedBranchId ?? getActiveBranchCookie();

  // Nếu request có branchId (tường minh hoặc từ cookie "cơ sở đang xem") và user có quyền access
  if (effectiveRequestedBranchId) {
    const canAccess = await canAccessBranch(effectiveRequestedBranchId);
    if (canAccess) {
      return effectiveRequestedBranchId;
    }
  }

  // Nếu user có branchId, dùng branch đó
  if (user.branchId) {
    return user.branchId;
  }

  // Admin không có branchId mặc định, lấy branch đầu tiên
  if (user.role === "admin") {
    const firstBranch = await prisma.branch.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: { code: "asc" }
    });
    
    return firstBranch?.id || null;
  }

  return null;
}
