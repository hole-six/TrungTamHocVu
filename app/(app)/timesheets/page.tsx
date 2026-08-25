import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
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

const UNSET_POSITION_LABEL = "Chưa khai báo";

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
  };
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams?: { search?: string; position?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("timesheet", role)) notFound();
  const activeBranchId = await getCurrentBranchId();

  const { start, end } = currentMonthRange();
  const branchWhere: Prisma.EmployeeWhereInput = activeBranchId ? { branchId: activeBranchId } : {};
  const search = searchParams?.search?.trim() ?? "";
  const position = searchParams?.position?.trim() ?? "";

  // Lọc theo tên/mã (`search`, contains) và vị trí (`position`, khớp đúng — riêng nhãn
  // "Chưa khai báo" nghĩa là position rỗng/null) ngay trên câu query Employee, thay vì
  // fetch hết rồi lọc bằng .filter() ở client. Bảng chỉ hiện nhân sự ACTIVE (quy tắc cố
  // định, không phải filter người dùng chọn) nên áp thẳng vào where luôn.
  const tableWhere: Prisma.EmployeeWhereInput = {
    ...branchWhere,
    workStatus: "ACTIVE",
    ...(search ? { OR: [{ fullName: { contains: search } }, { employeeCode: { contains: search } }] } : {}),
    ...(position ? (position === UNSET_POSITION_LABEL ? { OR: [{ position: null }, { position: "" }] } : { position }) : {}),
  };

  const [employees, tableEmployeesRaw] = await Promise.all([
    // Danh sách ĐẦY ĐỦ (mọi workStatus, không lọc search/position) — dùng để tính các
    // số liệu tổng (KPI chips) và danh sách vị trí cho ô lọc, không co lại theo tìm kiếm.
    prisma.employee.findMany({
      where: branchWhere,
      include: {
        timesheetEntries: {
          where: { workDate: { gte: start, lte: end } },
          orderBy: { workDate: "desc" },
        },
      },
      orderBy: [{ workStatus: "asc" }, { fullName: "asc" }],
    }),
    // Danh sách để HIỂN THỊ trong bảng — đã lọc ACTIVE + search + position ở DB.
    prisma.employee.findMany({
      where: tableWhere,
      include: {
        timesheetEntries: {
          where: { workDate: { gte: start, lte: end } },
          orderBy: { workDate: "desc" },
        },
      },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const positionOptionSet = new Set<string>();
  let hasUnsetPosition = false;
  for (const employee of employees) {
    if (employee.workStatus !== "ACTIVE") continue;
    const trimmed = employee.position?.trim();
    if (trimmed) positionOptionSet.add(trimmed);
    else hasUnsetPosition = true;
  }
  const positionOptions = Array.from(positionOptionSet).sort((a, b) => a.localeCompare(b, "vi"));
  if (hasUnsetPosition) positionOptions.push(UNSET_POSITION_LABEL);

  return (
    <TimesheetsWorkspace
      monthLabel={`Tháng ${start.getUTCMonth() + 1}/${start.getUTCFullYear()}`}
      defaultDate={new Date().toISOString().slice(0, 10)}
      canManageEmployees={canView("hr", role)}
      canDeleteTimesheet={canDelete("timesheet", role)}
      employees={employees.map(mapEmployee)}
      tableEmployees={tableEmployeesRaw.map(mapEmployee)}
      positionOptions={positionOptions}
      search={search}
      position={position}
    />
  );
}
