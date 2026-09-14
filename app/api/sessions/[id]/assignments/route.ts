import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { buildAssignmentPay } from "@/lib/server/class-default-assignments";
import { findStaffConflicts, describeStaffConflicts } from "@/lib/server/staff-schedule";
import { isEmployeeWorkingOn } from "@/lib/assignment-roles";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

// Phân công GV/TG cho buổi học — nguồn ChiTietLopHoc (Giáo viên/Trợ giảng + FR-0008
// So_Gio, FR-0009 So_gio_GV theo payMode, FR-0010/0011 Luongh_GV/Luongh_TG lookup từ
// NhanSu). Lưu snapshot hourlyRate + amount tại thời điểm phân công để lịch sử lương
// không đổi khi sau này sửa đơn giá của nhân viên.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const userRole = await getUserRole(user.id);
  if (!canUpdate("schedule", userRole)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền phân công GV/TG" }, { status: 403 });
  }

  const session = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });
  if (session.status === "CANCELLED" || session.status === "RESCHEDULED") {
    return NextResponse.json({ error: "Buổi này đã hủy hoặc đã dời, không phân công được nữa." }, { status: 409 });
  }

  const body = await req.json();
  const employeeId = String(body.employeeId ?? "").trim();
  const role = String(body.role ?? "").trim();
  if (!employeeId) return NextResponse.json({ error: "Thiếu nhân viên" }, { status: 400 });
  if (!["TEACHER", "ASSISTANT", "ASSISTANT2"].includes(role)) {
    return NextResponse.json({ error: "Vai trò không hợp lệ" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
  if (!isEmployeeWorkingOn(employee, session.sessionDate)) {
    return NextResponse.json({ error: `${employee.fullName} đã nghỉ việc, không xếp vào buổi này được.` }, { status: 409 });
  }

  const existing = await prisma.sessionAssignment.findUnique({
    where: { sessionId_employeeId_role: { sessionId: session.id, employeeId, role } },
  });
  if (existing) return NextResponse.json({ error: "Nhân viên đã được phân công vai trò này cho buổi học" }, { status: 409 });
  const sameSession = await prisma.sessionAssignment.findFirst({ where: { sessionId: session.id, employeeId } });
  if (sameSession) {
    return NextResponse.json({ error: `${employee.fullName} đã có vai trò khác trong buổi này rồi.` }, { status: 409 });
  }

  // Chặn trùng lịch: người này đã đứng lớp khác chồng giờ trong cùng ngày.
  const conflicts = await findStaffConflicts(prisma, employeeId, [session]);
  if (conflicts.length) {
    return NextResponse.json({ error: describeStaffConflicts(employee.fullName, conflicts) }, { status: 409 });
  }

  const { hours, hourlyRate, amount } = buildAssignmentPay(role, employee, session);

  const assignment = await prisma.sessionAssignment.create({
    data: { sessionId: session.id, employeeId, role, hours, hourlyRate, amount, isSubstituteShift: !!body.isSubstituteShift },
  });

  return NextResponse.json({ item: assignment }, { status: 201 });
}
