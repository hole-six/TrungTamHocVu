import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { computeSessionBaseHours } from "@/lib/server/payroll-rules";
import { buildAssignmentPay } from "@/lib/server/class-default-assignments";
import { findStaffConflicts, describeOverlapBlock, describeOverlapConfirm, overlapDecision } from "@/lib/server/staff-schedule";
import { isEmployeeWorkingOn } from "@/lib/assignment-roles";

// Nhờ người dạy thay đột xuất cho ĐÚNG 1 phân công gốc — không phải sửa/xóa phân công
// gốc rồi tạo mới (mất dấu vết ai đáng lẽ dạy), mà tạo 1 bản ghi MỚI cho người dạy
// thay, trỏ substituteForId về bản ghi gốc, và trừ giờ công bản ghi gốc về 0 (người
// không dạy không được tính công buổi đó — người dạy thay được tính công đầy đủ
// trên bản ghi riêng của họ, snapshot đơn giá của chính họ chứ không phải của người
// bị thay).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sắp xếp dạy thay" }, { status: 403 });
  }

  const original = await prisma.sessionAssignment.findUnique({
    where: { id: params.id },
    include: { session: true, employee: true, substitutedBy: true },
  });
  if (!original) return NextResponse.json({ error: "Không tìm thấy phân công gốc" }, { status: 404 });
  if (original.substitutedBy) {
    return NextResponse.json({ error: "Buổi này đã có người dạy thay rồi, không thể gán thêm." }, { status: 409 });
  }

  const body = await req.json();
  const substituteEmployeeId = String(body.employeeId ?? "").trim();
  if (!substituteEmployeeId) return NextResponse.json({ error: "Thiếu người dạy thay" }, { status: 400 });
  if (substituteEmployeeId === original.employeeId) {
    return NextResponse.json({ error: "Người dạy thay phải khác người đang được phân công gốc." }, { status: 400 });
  }
  const reason = body.reason ? String(body.reason).trim() : null;

  const substituteEmployee = await prisma.employee.findUnique({ where: { id: substituteEmployeeId } });
  if (!substituteEmployee) return NextResponse.json({ error: "Không tìm thấy nhân viên dạy thay" }, { status: 404 });
  if (original.session.status === "CANCELLED" || original.session.status === "RESCHEDULED") {
    return NextResponse.json({ error: "Buổi này đã hủy hoặc đã dời, không sắp xếp dạy thay được." }, { status: 409 });
  }
  if (!isEmployeeWorkingOn(substituteEmployee, original.session.sessionDate)) {
    return NextResponse.json({ error: `${substituteEmployee.fullName} đã nghỉ việc, không dạy thay được.` }, { status: 409 });
  }
  // Người thay có thể đang ở CHÍNH buổi này (trợ giảng đứng lớp thay giáo viên) — hợp lệ,
  // findStaffConflicts chỉ so với buổi KHÁC.
  const scheduleConflicts = await findStaffConflicts(prisma, substituteEmployeeId, [original.session]);
  const substituteDecision = overlapDecision(scheduleConflicts);
  if (substituteDecision === "block") {
    return NextResponse.json({ error: describeOverlapBlock(substituteEmployee.fullName, scheduleConflicts), code: "OVERLAP_BLOCKED" }, { status: 409 });
  }
  if (substituteDecision === "confirm" && !body.allowOverlap) {
    return NextResponse.json(
      { error: describeOverlapConfirm(substituteEmployee.fullName, scheduleConflicts), code: "OVERLAP_CONFIRM" },
      { status: 409 },
    );
  }

  const conflict = await prisma.sessionAssignment.findUnique({
    where: { sessionId_employeeId_role: { sessionId: original.sessionId, employeeId: substituteEmployeeId, role: original.role } },
  });
  if (conflict) {
    return NextResponse.json({ error: "Nhân viên này đã có phân công vai trò này ở buổi học rồi." }, { status: 409 });
  }

  const note = reason
    ? `Dạy thay: ${substituteEmployee.fullName} — Lý do: ${reason}`
    : `Dạy thay: ${substituteEmployee.fullName}`;
  const originalBaseHours = computeSessionBaseHours(original.employee.payMode, original.session.startTime, original.session.endTime);
  const { hours: subHours, hourlyRate: subHourlyRate, amount: subAmount } = buildAssignmentPay(original.role, substituteEmployee, original.session);

  const result = await prisma.$transaction(async (tx) => {
    const substituteAssignment = await tx.sessionAssignment.create({
      data: {
        sessionId: original.sessionId,
        employeeId: substituteEmployeeId,
        role: original.role,
        hours: subHours,
        hourlyRate: subHourlyRate,
        amount: subAmount,
        isSubstituteShift: true,
        substituteForId: original.id,
        adjustmentNote: reason,
      },
    });

    const updatedOriginal = await tx.sessionAssignment.update({
      where: { id: original.id },
      data: {
        deductedHours: originalBaseHours,
        addedHours: 0,
        hours: 0,
        amount: 0,
        adjustmentNote: note,
      },
    });

    return { substituteAssignment, updatedOriginal };
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: user.branchId,
      action: "substitute",
      entityType: "SessionAssignment",
      entityId: original.id,
      before: JSON.stringify({ employeeId: original.employeeId, hours: original.hours }),
      after: JSON.stringify({ substituteEmployeeId, substituteAssignmentId: result.substituteAssignment.id }),
      reason,
    },
  });

  return NextResponse.json({ item: result.substituteAssignment, original: result.updatedOriginal }, { status: 201 });
}
