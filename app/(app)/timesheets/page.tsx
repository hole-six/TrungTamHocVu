import { notFound } from "next/navigation";
import TimesheetsWorkspace from "@/components/timesheets/TimesheetsWorkspace";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView, canDelete } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

export default async function TimesheetsPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("timesheet", role)) notFound();
  const activeBranchId = await getCurrentBranchId();

  const { start, end } = currentMonthRange();
  const employees = await prisma.employee.findMany({
    where: {
      ...(activeBranchId ? { branchId: activeBranchId } : {}),
    },
    include: {
      timesheetEntries: {
        where: { workDate: { gte: start, lte: end } },
        orderBy: { workDate: "desc" },
      },
    },
    orderBy: [{ workStatus: "asc" }, { fullName: "asc" }],
  });

  return (
    <TimesheetsWorkspace
      monthLabel={`Tháng ${start.getUTCMonth() + 1}/${start.getUTCFullYear()}`}
      defaultDate={new Date().toISOString().slice(0, 10)}
      canManageEmployees={canView("hr", role)}
      canDeleteTimesheet={canDelete("timesheet", role)}
      employees={employees.map((employee) => ({
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        position: employee.position,
        workStatus: employee.workStatus,
        timesheetEntries: employee.timesheetEntries.map((entry) => ({
          id: entry.id,
          workDate: entry.workDate.toISOString(),
          checkInAm: entry.checkInAm,
          checkOutAm: entry.checkOutAm,
          checkInPm: entry.checkInPm,
          checkOutPm: entry.checkOutPm,
          hours: entry.hours,
          days: entry.days,
          notes: entry.notes,
        })),
      }))}
    />
  );
}
