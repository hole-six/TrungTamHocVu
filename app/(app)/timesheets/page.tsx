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

function mapEmployee(employee: {
  id: string;
  fullName: string;
  employeeCode: string;
  position: string | null;
  workStatus: string;
  timesheetEntries: {
    id: string;
    workDate: Date;
    checkInAm: string | null;
    checkOutAm: string | null;
    checkInPm: string | null;
    checkOutPm: string | null;
    hours: number | null;
    days: number | null;
    notes: string | null;
  }[];
  sessionAssignments: {
    id: string;
    role: string;
    hours: number | null;
    deductedHours: number;
    addedHours: number;
    session: { sessionDate: Date; class: { classCode: string; className: string } };
  }[];
}) {
  return {
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
    // Tổng hợp buổi dạy trong tháng theo NGÀY, gộp cùng bảng chấm công — đúng cấu
    // trúc sheet chấm công thật của khách (1 dòng gồm cả giờ hành chính lẫn buổi
    // dạy/lớp/đi muộn-thêm giờ trong ngày, xem ảnh mẫu trong ĐỀ XUẤT CHỈNH SỬA.xlsx).
    sessionAssignments: employee.sessionAssignments.map((assignment) => ({
      id: assignment.id,
      workDate: assignment.session.sessionDate.toISOString(),
      role: assignment.role,
      classCode: assignment.session.class.classCode,
      className: assignment.session.class.className,
      hours: assignment.hours,
      deductedHours: assignment.deductedHours,
      addedHours: assignment.addedHours,
    })),
  };
}

export default async function TimesheetsPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("timesheet", role)) notFound();
  const activeBranchId = await getCurrentBranchId();

  const { start, end } = currentMonthRange();

  const employees = await prisma.employee.findMany({
    where: { ...(activeBranchId ? { branchId: activeBranchId } : {}), workStatus: "ACTIVE" },
    include: {
      timesheetEntries: {
        where: { workDate: { gte: start, lte: end } },
        orderBy: { workDate: "desc" },
      },
      sessionAssignments: {
        where: { session: { sessionDate: { gte: start, lte: end } } },
        include: { session: { select: { sessionDate: true, class: { select: { classCode: true, className: true } } } } },
        orderBy: { id: "desc" },
      },
    },
    orderBy: { fullName: "asc" },
  });

  return (
    <TimesheetsWorkspace
      defaultDate={new Date().toISOString().slice(0, 10)}
      canManageEmployees={canView("hr", role)}
      canDeleteTimesheet={canDelete("timesheet", role)}
      employees={employees.map(mapEmployee)}
    />
  );
}
