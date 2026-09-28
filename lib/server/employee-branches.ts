// MỘT NHÂN SỰ — NHIỀU CƠ SỞ (chốt với chủ trung tâm 9/2026).
//
// Quy ước của cả hệ thống, mọi chỗ phải dùng chung đúng 3 hàm dưới đây:
//   - `employee.branchId` = CƠ SỞ CHÍNH: nơi giữ hồ sơ, mặc định cho ngày công.
//   - `EmployeeBranch`     = TẤT CẢ cơ sở người đó được phép làm (có thể là full cơ sở).
//   - Gắn nhiều cơ sở KHÔNG có nghĩa là gộp số: lương, ngày công, buổi dạy vẫn thống kê
//     RIÊNG từng cơ sở. Bảng nối chỉ quyết định người đó XUẤT HIỆN ở cơ sở nào.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Điều kiện "nhân sự này có làm ở cơ sở đang xem không".
 *
 * Nhận cả cơ sở chính lẫn cơ sở gắn thêm: dữ liệu cũ (và mọi đường tạo nhân sự lỡ quên
 * ghi bảng nối) vẫn còn nguyên cơ sở chính, nên không ai bị biến mất khỏi danh sách.
 * `branchId = null` (xem "Tất cả cơ sở") thì không lọc gì.
 *
 * Trả về một mảnh `where` có khóa `OR` — nơi gọi đã có `OR` riêng thì phải gộp qua
 * `AND: [branchFilter, ...]`, đừng spread đè lên nhau.
 */
export function employeeBranchFilter(branchId: string | null | undefined): Prisma.EmployeeWhereInput {
  if (!branchId) return {};
  return { OR: [{ branchId }, { branchLinks: { some: { branchId } } }] };
}

/**
 * Điều kiện "ngày công này thuộc cơ sở đang xem".
 *
 * Ngày công ghi thẳng cơ sở làm việc hôm đó. Bản ghi cũ chưa có cột này thì quy về cơ sở
 * chính của người đó — đúng cách bảng lương vẫn tính từ trước, nên số không nhảy.
 */
export function timesheetBranchFilter(branchId: string | null | undefined): Prisma.TimesheetEntryWhereInput {
  if (!branchId) return {};
  return {
    OR: [{ branchId }, { AND: [{ branchId: null }, { employee: { branchId } }] }],
  };
}

/** Danh sách id cơ sở của một nhân sự, cơ sở chính luôn đứng đầu. */
export async function listEmployeeBranchIds(employeeId: string): Promise<string[]> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { branchId: true, branchLinks: { select: { branchId: true } } },
  });
  if (!employee) return [];
  return orderWithPrimaryFirst(
    employee.branchId,
    employee.branchLinks.map((link) => link.branchId),
  );
}

/** Cơ sở chính luôn đứng đầu, phần còn lại giữ thứ tự đã có, không trùng lặp. */
export function orderWithPrimaryFirst(primaryBranchId: string, branchIds: string[]): string[] {
  const rest = branchIds.filter((id) => id !== primaryBranchId);
  return [primaryBranchId, ...Array.from(new Set(rest))];
}

/**
 * Đặt lại danh sách cơ sở của một nhân sự.
 *
 * Cơ sở chính LUÔN nằm trong danh sách — bỏ nó ra thì hồ sơ mất khỏi chính nơi đang giữ
 * nó. Muốn đổi cơ sở chính thì sửa `employee.branchId` (hàm này tự gắn theo giá trị mới).
 */
export async function setEmployeeBranches(
  employeeId: string,
  branchIds: string[],
  tx: Prisma.TransactionClient = prisma,
): Promise<string[]> {
  const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!employee) return [];

  const wanted = orderWithPrimaryFirst(employee.branchId, branchIds);
  const existing = await tx.employeeBranch.findMany({ where: { employeeId }, select: { branchId: true } });
  const existingIds = new Set(existing.map((link) => link.branchId));

  const toAdd = wanted.filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !wanted.includes(id));

  if (toAdd.length > 0) {
    await tx.employeeBranch.createMany({ data: toAdd.map((branchId) => ({ employeeId, branchId })) });
  }
  if (toRemove.length > 0) {
    await tx.employeeBranch.deleteMany({ where: { employeeId, branchId: { in: toRemove } } });
  }
  return wanted;
}

/** Gắn cơ sở chính cho nhân sự vừa tạo — gọi ngay sau `employee.create`. */
export async function ensurePrimaryBranchLink(
  employeeId: string,
  branchId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  await tx.employeeBranch.upsert({
    where: { employeeId_branchId: { employeeId, branchId } },
    create: { employeeId, branchId },
    update: {},
  });
}

/**
 * Ngày công vừa chấm thuộc cơ sở nào.
 *
 * Lấy cơ sở đang xem nếu người đó thực sự có làm ở đó, còn không thì về cơ sở chính —
 * không bao giờ ghi ngày công vào một cơ sở người ta không thuộc về.
 */
export async function resolveTimesheetBranchId(
  employeeId: string,
  requestedBranchId: string | null | undefined,
  tx: Prisma.TransactionClient = prisma,
): Promise<string | null> {
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: { branchId: true, branchLinks: { select: { branchId: true } } },
  });
  if (!employee) return null;
  if (!requestedBranchId) return employee.branchId;
  const allowed = new Set([employee.branchId, ...employee.branchLinks.map((link) => link.branchId)]);
  return allowed.has(requestedBranchId) ? requestedBranchId : employee.branchId;
}
