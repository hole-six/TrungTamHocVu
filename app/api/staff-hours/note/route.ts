import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";

// Ghi chú giải trình chênh lệch giờ dự kiến / thực tế của 1 nhân sự trong 1 tuần hoặc 1 tháng.
// periodKey: "2026-09" (cả tháng) hoặc "2026-09-14" (tuần bắt đầu thứ Hai 14/9).
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("timesheet", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền ghi chú bảng công" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const employeeId = String(body.employeeId ?? "").trim();
  const periodKey = String(body.periodKey ?? "").trim();
  const note = String(body.note ?? "").trim().slice(0, 500);
  if (!employeeId || !/^\d{4}-\d{2}(-\d{2})?$/.test(periodKey)) {
    return NextResponse.json({ error: "Thiếu nhân sự hoặc kỳ ghi chú" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });
  if (!(await canAccessBranch(employee.branchId))) {
    return NextResponse.json({ error: "Không có quyền truy cập cơ sở của nhân sự này" }, { status: 403 });
  }

  if (!note) {
    await prisma.staffHoursNote.deleteMany({ where: { employeeId, periodKey } });
    return NextResponse.json({ ok: true, note: null });
  }

  const saved = await prisma.staffHoursNote.upsert({
    where: { employeeId_periodKey: { employeeId, periodKey } },
    create: { employeeId, periodKey, note, updatedById: user.id },
    update: { note, updatedById: user.id },
  });
  return NextResponse.json({ ok: true, note: saved.note });
}
