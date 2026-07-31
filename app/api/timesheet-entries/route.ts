import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeHoursFromTimeRange } from "@/lib/server/payroll-rules";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import { ensureTimesheetPeriodForEntry } from "@/lib/server/database-sync";

function computeTimesheetTotals(body: Record<string, unknown>) {
  const checkInAm = typeof body.checkInAm === "string" ? body.checkInAm : "";
  const checkOutAm = typeof body.checkOutAm === "string" ? body.checkOutAm : "";
  const checkInPm = typeof body.checkInPm === "string" ? body.checkInPm : "";
  const checkOutPm = typeof body.checkOutPm === "string" ? body.checkOutPm : "";
  const morningHours = checkInAm && checkOutAm ? computeHoursFromTimeRange(checkInAm, checkOutAm) : 0;
  const afternoonHours = checkInPm && checkOutPm ? computeHoursFromTimeRange(checkInPm, checkOutPm) : 0;
  const hours = morningHours + afternoonHours;
  const days = Math.round((hours / 8) * 100) / 100;
  return { checkInAm, checkOutAm, checkInPm, checkOutPm, hours, days };
}

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

  const totals = computeTimesheetTotals(body);

  const entry = await prisma.$transaction(async (tx) => {
    const periodId = await ensureTimesheetPeriodForEntry(employeeId, workDate, tx);
    return tx.timesheetEntry.create({
      data: {
        employeeId,
        periodId,
        workDate,
        checkInAm: totals.checkInAm || null,
        checkOutAm: totals.checkOutAm || null,
        checkInPm: totals.checkInPm || null,
        checkOutPm: totals.checkOutPm || null,
        hours: totals.hours,
        days: totals.days,
        notes: body.notes || null,
      },
    });
  });

  return NextResponse.json({ item: entry }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canCreate("timesheet", role)) {
    return NextResponse.json(
      { error: "Vai trò của bạn không dùng luồng chấm công ngày. Công dạy của giáo viên/trợ giảng lấy từ buổi học đã phân công." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const employeeId = String(body.employeeId ?? "").trim();
  if (!employeeId) return NextResponse.json({ error: "Thiếu nhân viên" }, { status: 400 });
  if (!body.workDate) return NextResponse.json({ error: "Thiếu ngày công" }, { status: 400 });

  const workDate = new Date(body.workDate);
  const totals = computeTimesheetTotals(body);

  const entry = await prisma.$transaction(async (tx) => {
    const periodId = await ensureTimesheetPeriodForEntry(employeeId, workDate, tx);
    return tx.timesheetEntry.upsert({
      where: { employeeId_workDate: { employeeId, workDate } },
      update: {
        periodId,
        checkInAm: totals.checkInAm || null,
        checkOutAm: totals.checkOutAm || null,
        checkInPm: totals.checkInPm || null,
        checkOutPm: totals.checkOutPm || null,
        hours: totals.hours,
        days: totals.days,
        notes: body.notes || null,
      },
      create: {
        employeeId,
        periodId,
        workDate,
        checkInAm: totals.checkInAm || null,
        checkOutAm: totals.checkOutAm || null,
        checkInPm: totals.checkInPm || null,
        checkOutPm: totals.checkOutPm || null,
        hours: totals.hours,
        days: totals.days,
        notes: body.notes || null,
      },
    });
  });

  return NextResponse.json({ item: entry });
}
