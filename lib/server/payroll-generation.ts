// Tạo kỳ lương + tính PayrollLine — tách riêng khỏi payroll-rules.ts (file đó được
// components/payroll/PayrollWorkspace.tsx — 1 client component — import trực tiếp;
// thêm import prisma vào đó sẽ kéo Prisma Client vào bundle trình duyệt). File này
// chỉ được gọi từ route handler và scheduler (server-only).
import { prisma } from "@/lib/prisma";
import { canEditPayroll } from "@/lib/server/payroll-rules";
import { monthRange } from "@/lib/server/tuition-rules";

export async function ensurePayrollRun(branchId: string, periodName: string) {
  const existing = await prisma.payrollRun.findUnique({
    where: { branchId_periodName: { branchId, periodName } },
  });
  if (existing) return existing;

  return prisma.payrollRun.create({ data: { branchId, periodName } });
}

// Tổng hợp lương từ SessionAssignment (giờ dạy/trợ giảng theo buổi, đã snapshot
// hourlyRate lúc phân công) + TimesheetEntry (ngày công chấm theo giờ hành chính)
// trong khoảng ngày của kỳ lương — nguồn Report_Cong_Luong. Logic giống hệt route
// payroll-runs/[id]/generate (đã kiểm chứng idempotent nhiều lần) — tách ra để
// route thủ công và scheduler tự động dùng chung 1 chỗ tính duy nhất.
export async function generatePayrollForRun(runId: string) {
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } });
  if (!run) return { error: "Không tìm thấy kỳ lương" as const };
  if (!canEditPayroll(run.status)) {
    return { error: `Kỳ lương đang ở trạng thái "${run.status}", không thể tính lại.` as const };
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

  return { created, updated, totalEmployees: employees.length };
}
