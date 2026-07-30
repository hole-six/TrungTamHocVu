import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeHoursFromTimeRange } from "@/lib/server/payroll-rules";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import { ensureTimesheetPeriodForEntry } from "@/lib/server/database-sync";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canCreate("timesheet", role)) {
    return NextResponse.json(
      { error: "Vai trò của bạn không dùng luồng chấm công ngày. Công dạy của giáo viên/trợ giảng lấy từ buổi học đã phân công." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const employeeId = String(body.employeeId ?? "").trim();
  if (!employeeId) return NextResponse.json({ error: "Thiếu nhân viên" }, { status: 400 });
  if (!body.workDate) return NextResponse.json({ error: "Thiếu ngày công" }, { status: 400 });

  const workDate = new Date(body.workDate);

  const existing = await prisma.timesheetEntry.findUnique({
    where: { employeeId_workDate: { employeeId, workDate } },
  });
  if (existing) {
    return NextResponse.json({ error: "Ngày này đã có chấm công cho nhân viên" }, { status: 409 });
  }

  const morningHours = body.checkInAm && body.checkOutAm ? computeHoursFromTimeRange(body.checkInAm, body.checkOutAm) : 0;
  const afternoonHours = body.checkInPm && body.checkOutPm ? computeHoursFromTimeRange(body.checkInPm, body.checkOutPm) : 0;
  const hours = morningHours + afternoonHours;
  const days = Math.round((hours / 8) * 100) / 100;

  const entry = await prisma.$transaction(async (tx) => {
    const periodId = await ensureTimesheetPeriodForEntry(employeeId, workDate, tx);
    return tx.timesheetEntry.create({
      data: {
        employeeId,
        periodId,
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
  });

  return NextResponse.json({ item: entry }, { status: 201 });
}
