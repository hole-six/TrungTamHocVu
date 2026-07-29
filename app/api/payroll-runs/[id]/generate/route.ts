import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canEditPayroll } from "@/lib/server/payroll-rules";
import { monthRange } from "@/lib/server/tuition-rules";

// Tổng hợp lương từ SessionAssignment (giờ dạy/trợ giảng theo buổi, đã snapshot
// hourlyRate lúc phân công) + TimesheetEntry (ngày công chấm theo giờ hành chính)
// trong khoảng ngày của kỳ lương — nguồn Report_Cong_Luong.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id } });
  if (!run) return NextResponse.json({ error: "Không tìm thấy kỳ lương" }, { status: 404 });
  if (!canEditPayroll(run.status)) {
    return NextResponse.json({ error: `Kỳ lương đang ở trạng thái "${run.status}", không thể tính lại.` }, { status: 409 });
  }

  const { start, end } = monthRange(run.periodName);

  const employees = await prisma.employee.findMany({ where: { branchId: run.branchId } });

  let created = 0;
  let updated = 0;

  for (const employee of employees) {
    const [teachingAssignments, assistantAssignments, timesheetEntries] = await Promise.all([
      prisma.sessionAssignment.findMany({
        where: { employeeId: employee.id, role: "TEACHER", session: { sessionDate: { gte: start, lte: end } } },
      }),
      prisma.sessionAssignment.findMany({
        where: { employeeId: employee.id, role: { in: ["ASSISTANT", "ASSISTANT2"] }, session: { sessionDate: { gte: start, lte: end } } },
      }),
      prisma.timesheetEntry.findMany({ where: { employeeId: employee.id, workDate: { gte: start, lte: end } } }),
    ]);

    const teachingHours = teachingAssignments.reduce((s, a) => s + (a.hours ?? 0), 0);
    const teachingAmount = teachingAssignments.reduce((s, a) => s + (a.amount ?? 0), 0);
    const assistantHours = assistantAssignments.reduce((s, a) => s + (a.hours ?? 0), 0);
    const assistantAmount = assistantAssignments.reduce((s, a) => s + (a.amount ?? 0), 0);
    const staffDays = timesheetEntries.reduce((s, t) => s + (t.days ?? 0), 0);

    if (teachingAssignments.length === 0 && assistantAssignments.length === 0 && timesheetEntries.length === 0) continue;

    const totalAmount = teachingAmount + assistantAmount;

    const existingLine = await prisma.payrollLine.findUnique({
      where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: employee.id } },
    });

    if (existingLine) {
      await prisma.payrollLine.update({
        where: { id: existingLine.id },
        data: { teachingHours, teachingAmount, assistantHours, assistantAmount, staffDays, totalAmount: totalAmount + existingLine.bonus - existingLine.penalty },
      });
      updated++;
    } else {
      await prisma.payrollLine.create({
        data: { payrollRunId: run.id, employeeId: employee.id, teachingHours, teachingAmount, assistantHours, assistantAmount, staffDays, totalAmount },
      });
      created++;
    }
  }

  if (run.status === "DRAFT") {
    await prisma.payrollRun.update({ where: { id: run.id }, data: { status: "CALCULATED", calculatedAt: new Date() } });
  }

  return NextResponse.json({ created, updated, totalEmployees: employees.length });
}
