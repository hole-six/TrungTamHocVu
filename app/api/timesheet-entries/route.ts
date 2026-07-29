import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeHoursFromTimeRange } from "@/lib/server/payroll-rules";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  const employeeId = String(body.employeeId ?? "").trim();
  if (!employeeId) return NextResponse.json({ error: "Thiếu nhân viên" }, { status: 400 });
  if (!body.workDate) return NextResponse.json({ error: "Thiếu ngày công" }, { status: 400 });

  const workDate = new Date(body.workDate);

  const existing = await prisma.timesheetEntry.findUnique({ where: { employeeId_workDate: { employeeId, workDate } } });
  if (existing) return NextResponse.json({ error: "Ngày này đã có chấm công cho nhân viên" }, { status: 409 });

  // Gio NV = tổng giờ sáng + chiều (FR-0016), Cong NV = Gio NV / 8 (FR-0017, ngày công chuẩn 8h)
  const morningHours = body.checkInAm && body.checkOutAm ? computeHoursFromTimeRange(body.checkInAm, body.checkOutAm) : 0;
  const afternoonHours = body.checkInPm && body.checkOutPm ? computeHoursFromTimeRange(body.checkInPm, body.checkOutPm) : 0;
  const hours = morningHours + afternoonHours;
  const days = Math.round((hours / 8) * 100) / 100;

  const entry = await prisma.timesheetEntry.create({
    data: {
      employeeId,
      workDate,
      checkInAm: body.checkInAm || null,
      checkOutAm: body.checkOutAm || null,
      checkInPm: body.checkInPm || null,
      checkOutPm: body.checkOutPm || null,
      hours,
      days,
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ item: entry }, { status: 201 });
}
