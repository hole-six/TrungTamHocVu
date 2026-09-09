import { notFound } from "next/navigation";
import TimesheetsWorkspace from "@/components/timesheets/TimesheetsWorkspace";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole , getAllowedHrTabs } from "@/lib/permissions";
import { canView, canCreate, canDelete } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { monthRange } from "@/lib/server/tuition-rules";
import HrTabs from "@/components/hr/HrTabs";

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
    // Buổi dạy trong tháng — hiển thị cạnh công hành chính để đối chiếu, nhưng CỐ TÌNH
    // tách riêng: hai loại công này tính lương theo 2 đơn giá khác nhau và nguồn dữ
    // liệu khác nhau (buổi dạy đến từ phân công lớp, không sửa ở trang chấm công).
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

export default async function TimesheetsPage({ searchParams }: { searchParams?: { month?: string } }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("timesheet", role)) notFound();
  const activeBranchId = await getCurrentBranchId();

  // Chấm công đi theo THÁNG giống lương — cùng một mốc thời gian để đối chiếu công/lương,
  // thay vì trang này theo ngày còn trang lương theo tháng như trước.
  const month = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : currentMonthString();
  const { start, end } = monthRange(month);

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

  const hrTabs = user ? await getAllowedHrTabs(user.id) : [];

  return (
    <div className="space-y-4">
      <HrTabs allowed={hrTabs} />
      <TimesheetsWorkspace
      month={month}
      today={new Date().toISOString().slice(0, 10)}
      canEditTimesheet={canCreate("timesheet", role)}
      canDeleteTimesheet={canDelete("timesheet", role)}
      employees={employees.map(mapEmployee)}
    />
    </div>
  );
}
