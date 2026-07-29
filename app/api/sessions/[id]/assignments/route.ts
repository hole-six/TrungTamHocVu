import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeHoursFromTimeRange } from "@/lib/server/payroll-rules";

// Phân công GV/TG cho buổi học — nguồn ChiTietLopHoc (Giáo viên/Trợ giảng + FR-0008
// So_Gio, FR-0010/0011 Luongh_GV/Luongh_TG lookup từ NhanSu). Lưu snapshot hourlyRate
// + amount tại thời điểm phân công để lịch sử lương không đổi khi sau này sửa đơn
// giá của nhân viên.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const session = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });

  const body = await req.json();
  const employeeId = String(body.employeeId ?? "").trim();
  const role = String(body.role ?? "").trim();
  if (!employeeId) return NextResponse.json({ error: "Thiếu nhân viên" }, { status: 400 });
  if (!["TEACHER", "ASSISTANT", "ASSISTANT2"].includes(role)) {
    return NextResponse.json({ error: "Vai trò không hợp lệ" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });

  const existing = await prisma.sessionAssignment.findUnique({
    where: { sessionId_employeeId_role: { sessionId: session.id, employeeId, role } },
  });
  if (existing) return NextResponse.json({ error: "Nhân viên đã được phân công vai trò này cho buổi học" }, { status: 409 });

  const hours = session.startTime && session.endTime ? computeHoursFromTimeRange(session.startTime, session.endTime) : 0;
  const hourlyRate = role === "TEACHER" ? employee.teachingHourlyRate ?? 0 : employee.assistantHourlyRate ?? 0;
  const amount = Math.round(hours * hourlyRate);

  const assignment = await prisma.sessionAssignment.create({
    data: { sessionId: session.id, employeeId, role, hours, hourlyRate, amount },
  });

  return NextResponse.json({ item: assignment }, { status: 201 });
}
