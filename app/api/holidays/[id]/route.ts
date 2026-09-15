import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { removeHolidayAndRestore } from "@/lib/server/session-cancellation";

// Xóa ngày nghỉ = các lớp học lại ngày đó: khôi phục đúng các buổi đã cho nghỉ vì ngày này
// và bỏ những buổi đã nối thêm ở cuối khóa.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa ngày nghỉ" }, { status: 403 });
  }

  const existing = await prisma.holiday.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy ngày nghỉ" }, { status: 404 });
  if (!(await canAccessBranch(existing.branchId))) {
    return NextResponse.json({ error: "Không có quyền truy cập cơ sở này" }, { status: 403 });
  }

  const result = await removeHolidayAndRestore(params.id);
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: existing.branchId,
      action: "holiday_remove",
      entityType: "Holiday",
      entityId: existing.id,
      before: JSON.stringify({ date: existing.date.toISOString().slice(0, 10), name: existing.name }),
      after: JSON.stringify(result),
    },
  });
  return NextResponse.json({ ok: true, ...result });
}
