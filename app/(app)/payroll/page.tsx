import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canView } from "@/lib/server/role-matrix";
import {
  canEditPayroll,
  computeContractStatus,
  PAYROLL_RUN_STATUS_LABEL,
  SESSION_ROLE_LABEL,
} from "@/lib/server/payroll-rules";
import { computeAssistantScorecard } from "@/lib/server/assistant-score-rules";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { monthRange } from "@/lib/server/tuition-rules";
import NewEmployeeForm from "@/components/payroll/NewEmployeeForm";
import NewPayrollRunForm from "@/components/payroll/NewPayrollRunForm";
import PayrollDateFilter from "@/components/payroll/PayrollDateFilter";
import PayrollExportButton from "@/components/payroll/PayrollExportButton";
import EmployeeProfileEditor from "@/components/payroll/EmployeeProfileEditor";
import TimesheetQuickAddForm from "@/components/payroll/TimesheetQuickAddForm";
import AssistantScoreForm from "@/components/payroll/AssistantScoreForm";
import PayrollRunActions from "@/components/payroll/PayrollRunActions";
import AddPayrollLineForm from "@/components/payroll/AddPayrollLineForm";
import PayrollRunExportButton from "@/components/payroll/PayrollRunExportButton";
import PayrollLineEditor from "@/components/payroll/PayrollLineEditor";

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}₫`;
}

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isClose(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

function getContractTone(status: string | null) {
  if (!status || status === "Chưa có info") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status.includes("Đã hết hạn")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (status.includes("Sắp")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getRunTone(status: string) {
  if (status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOCKED") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "APPROVED") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "REVIEWED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "CALCULATED") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function buildPayrollHref({
  fromDate,
  toDate,
  bankStatus,
  employeeId,
  runId,
  anchor,
}: {
  fromDate: string;
  toDate: string;
  bankStatus?: string;
  employeeId?: string | null;
  runId?: string | null;
  anchor?: string;
}) {
  const params = new URLSearchParams();
  params.set("fromDate", fromDate);
  params.set("toDate", toDate);
  if (bankStatus && bankStatus !== "all") params.set("bankStatus", bankStatus);
  if (employeeId) params.set("employeeId", employeeId);
  if (runId) params.set("runId", runId);
  const query = params.toString();
  return `/payroll${query ? `?${query}` : ""}${anchor ? `#${anchor}` : ""}`;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: {
    fromDate?: string;
    toDate?: string;
    bankStatus?: string;
    employeeId?: string;
    runId?: string;
  };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if ((role === "TEACHER" || role === "TEACHING_ASSISTANT") && user?.employeeId) {
    redirect(`/payroll/employees/${user.employeeId}`);
  }

  if (!canView("hr", role)) notFound();

  const canManageEmployees = canCreate("hr", role);
  const canManagePayrollRuns = canUpdate("hr", role);
  const canCreateTimesheet = canCreate("timesheet", role);

  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const rangeStart = searchParams?.fromDate ? new Date(`${searchParams.fromDate}T00:00:00`) : defaultFrom;
  const rangeEnd = searchParams?.toDate ? new Date(`${searchParams.toDate}T00:00:00`) : today;
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);

  const fromDateStr = toYmd(rangeStart);
  const toDateStr = toYmd(rangeEnd);
  const activeBranchId = await getCurrentBranchId();
  const branchWhere = activeBranchId ? { branchId: activeBranchId } : {};

  const [employeesRaw, teachingAssignments, assistantAssignments, timesheetEntries, runs] = await Promise.all([
    prisma.employee.findMany({
      where: branchWhere,
      orderBy: { fullName: "asc" },
      include: { contracts: { orderBy: { signDate: "desc" }, take: 1 } },
    }),
    prisma.sessionAssignment.findMany({
      where: {
        ...(activeBranchId ? { employee: { branchId: activeBranchId } } : {}),
        role: "TEACHER",
        session: { sessionDate: { gte: rangeStart, lte: rangeEnd }, status: "COMPLETED" },
      },
    }),
    prisma.sessionAssignment.findMany({
      where: {
        ...(activeBranchId ? { employee: { branchId: activeBranchId } } : {}),
        role: { in: ["ASSISTANT", "ASSISTANT2"] },
        session: { sessionDate: { gte: rangeStart, lte: rangeEnd }, status: "COMPLETED" },
      },
    }),
    prisma.timesheetEntry.findMany({
      where: {
        ...(activeBranchId ? { employee: { branchId: activeBranchId } } : {}),
        workDate: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    prisma.payrollRun.findMany({
      where: branchWhere,
      orderBy: { periodName: "desc" },
      include: { _count: { select: { lines: true } }, lines: true },
      take: 12,
    }),
  ]);

  const teachingByEmployee = new Map<string, { hours: number; amount: number; sessions: number }>();
  const assistantByEmployee = new Map<string, { hours: number; amount: number; sessions: number }>();
  const timesheetByEmployee = new Map<string, { days: number; hours: number; entries: number }>();

  for (const item of teachingAssignments) {
    const current = teachingByEmployee.get(item.employeeId) ?? { hours: 0, amount: 0, sessions: 0 };
    current.hours += item.hours ?? 0;
    current.amount += item.amount ?? 0;
    current.sessions += 1;
    teachingByEmployee.set(item.employeeId, current);
  }

  for (const item of assistantAssignments) {
    const current = assistantByEmployee.get(item.employeeId) ?? { hours: 0, amount: 0, sessions: 0 };
    current.hours += item.hours ?? 0;
    current.amount += item.amount ?? 0;
    current.sessions += 1;
    assistantByEmployee.set(item.employeeId, current);
  }

  for (const item of timesheetEntries) {
    const current = timesheetByEmployee.get(item.employeeId) ?? { days: 0, hours: 0, entries: 0 };
    current.days += item.days ?? 0;
    current.hours += item.hours ?? 0;
    current.entries += 1;
    timesheetByEmployee.set(item.employeeId, current);
  }

  const employees = employeesRaw.map(({ contracts, ...employee }) => {
    const teaching = teachingByEmployee.get(employee.id) ?? { hours: 0, amount: 0, sessions: 0 };
    const assistant = assistantByEmployee.get(employee.id) ?? { hours: 0, amount: 0, sessions: 0 };
    const timesheet = timesheetByEmployee.get(employee.id) ?? { days: 0, hours: 0, entries: 0 };
    const contractStatus = computeContractStatus(employee.resignDate, contracts[0]?.expiryDate ?? null);

    return {
      ...employee,
      contractStatus,
      teachingHours: teaching.hours,
      teachingAmount: teaching.amount,
      assistantHours: assistant.hours,
      assistantAmount: assistant.amount,
      staffDays: timesheet.days,
      staffHours: timesheet.hours,
      staffAmount: Math.round(timesheet.days * (employee.staffDailyRate ?? 0)),
      sessionCount: teaching.sessions + assistant.sessions,
      timesheetEntryCount: timesheet.entries,
      hasBankInfo: Boolean(employee.bankName && employee.bankAccountNumber && employee.bankAccountHolder),
    };
  });

  const employeeRowsBase = employees
    .filter((employee) => employee.teachingHours > 0 || employee.assistantHours > 0 || employee.staffDays > 0 || employee.staffHours > 0)
    .sort(
      (a, b) =>
        b.teachingAmount + b.assistantAmount + b.staffAmount - (a.teachingAmount + a.assistantAmount + a.staffAmount),
    );

  const bankStatus =
    searchParams?.bankStatus === "missing" || searchParams?.bankStatus === "ready"
      ? searchParams.bankStatus
      : "all";

  const employeeRows = employeeRowsBase.filter((employee) => {
    if (bankStatus === "missing") return !employee.hasBankInfo;
    if (bankStatus === "ready") return employee.hasBankInfo;
    return true;
  });

  const selectedEmployeeId =
    searchParams?.employeeId && employeeRowsBase.some((employee) => employee.id === searchParams.employeeId)
      ? searchParams.employeeId
      : employeeRows[0]?.id ?? employeeRowsBase[0]?.id ?? null;

  const totalTeachingHours = employeeRows.reduce((sum, employee) => sum + employee.teachingHours, 0);
  const totalTeachingAmount = employeeRows.reduce((sum, employee) => sum + employee.teachingAmount, 0);
  const totalAssistantHours = employeeRows.reduce((sum, employee) => sum + employee.assistantHours, 0);
  const totalAssistantAmount = employeeRows.reduce((sum, employee) => sum + employee.assistantAmount, 0);
  const totalStaffDays = employeeRows.reduce((sum, employee) => sum + employee.staffDays, 0);
  const totalStaffHours = employeeRows.reduce((sum, employee) => sum + employee.staffHours, 0);
  const totalStaffAmount = employeeRows.reduce((sum, employee) => sum + employee.staffAmount, 0);
  const totalPayroll = totalTeachingAmount + totalAssistantAmount + totalStaffAmount;

  const missingTeachingRate = employeeRows.filter((employee) => employee.teachingHours > 0 && employee.teachingHourlyRate == null).length;
  const missingAssistantRate = employeeRows.filter((employee) => employee.assistantHours > 0 && employee.assistantHourlyRate == null).length;
  const missingStaffDailyRate = employeeRows.filter((employee) => employee.staffDays > 0 && employee.staffDailyRate == null).length;
  const contractAttentionCount = employees.filter((employee) => employee.contractStatus && employee.contractStatus !== "Chưa có info").length;
  const missingBankInfoCount = employeeRowsBase.filter((employee) => !employee.hasBankInfo).length;
  const reviewCount = missingTeachingRate + missingAssistantRate + missingStaffDailyRate + contractAttentionCount;
  const activeCount = employees.filter((employee) => employee.workStatus === "ACTIVE").length;
  const employeesNeedingRateSetup = employeeRows.filter(
    (employee) =>
      (employee.teachingHours > 0 && employee.teachingHourlyRate == null) ||
      (employee.assistantHours > 0 && employee.assistantHourlyRate == null) ||
      (employee.staffDays > 0 && employee.staffDailyRate == null),
  );
  const employeesNeedingRatePreview = employeesNeedingRateSetup.slice(0, 8);

  const runRows = runs.map((run) => ({
    id: run.id,
    periodName: run.periodName,
    status: run.status,
    lineCount: run._count.lines,
    totalAmount: run.lines.reduce((sum, line) => sum + line.totalAmount, 0),
    teachingHours: run.lines.reduce((sum, line) => sum + line.teachingHours, 0),
    assistantHours: run.lines.reduce((sum, line) => sum + line.assistantHours, 0),
    staffDays: run.lines.reduce((sum, line) => sum + line.staffDays, 0),
  }));

  const selectedRunId =
    searchParams?.runId && runRows.some((run) => run.id === searchParams.runId)
      ? searchParams.runId
      : runRows[0]?.id ?? null;

  const [selectedEmployeeDetail, branches, selectedRun] = await Promise.all([
    selectedEmployeeId
      ? prisma.employee.findUnique({
          where: { id: selectedEmployeeId },
          include: {
            sessionAssignments: {
              where: { session: { sessionDate: { gte: rangeStart, lte: rangeEnd } } },
              include: { session: { include: { class: true } } },
              orderBy: { session: { sessionDate: "desc" } },
            },
            timesheetEntries: {
              where: { workDate: { gte: rangeStart, lte: rangeEnd } },
              orderBy: { workDate: "desc" },
            },
            contracts: { orderBy: { signDate: "desc" }, take: 1 },
          },
        })
      : Promise.resolve(null),
    selectedEmployeeId && canManagePayrollRuns ? prisma.branch.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    selectedRunId
      ? prisma.payrollRun.findUnique({
          where: { id: selectedRunId },
          include: {
            lines: {
              include: { employee: true },
              orderBy: { employee: { fullName: "asc" } },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const selectedEmployeeSummary = selectedEmployeeId
    ? employeeRowsBase.find((employee) => employee.id === selectedEmployeeId) ?? null
    : null;

  const assistantMonth = monthFromDate(rangeStart);
  const assistantCard =
    selectedEmployeeId && selectedEmployeeDetail && canManagePayrollRuns
      ? await computeAssistantScorecard(selectedEmployeeId, assistantMonth)
      : null;

  const runDetail =
    selectedRun && activeBranchId && selectedRun.branchId !== activeBranchId ? null : selectedRun;
  const runRange = runDetail ? monthRange(runDetail.periodName) : null;
  const runEmployeeIds = runDetail ? runDetail.lines.map((line) => line.employeeId) : [];

  const [runAssignments, runTimesheetEntries, eligibleEmployees] = runDetail
    ? await Promise.all([
        prisma.sessionAssignment.findMany({
          where: {
            employeeId: { in: runEmployeeIds },
            session: {
              sessionDate: { gte: runRange!.start, lte: runRange!.end },
              status: "COMPLETED",
            },
          },
          include: { session: { include: { class: true } } },
          orderBy: { session: { sessionDate: "asc" } },
        }),
        prisma.timesheetEntry.findMany({
          where: {
            employeeId: { in: runEmployeeIds },
            workDate: { gte: runRange!.start, lte: runRange!.end },
          },
          orderBy: { workDate: "asc" },
        }),
        canEditPayroll(runDetail.status)
          ? prisma.employee.findMany({
              where: {
                branchId: runDetail.branchId,
                resignDate: null,
                id: { notIn: runEmployeeIds },
              },
              select: { id: true, fullName: true },
              orderBy: { fullName: "asc" },
            })
          : Promise.resolve([]),
      ])
    : [[], [], []];

  const runChecklist =
    runDetail
      ? {
          missingTeachingConfigCount: runDetail.lines.filter((line) => line.teachingHours > 0 && line.employee.teachingHourlyRate == null).length,
          missingAssistantConfigCount: runDetail.lines.filter((line) => line.assistantHours > 0 && line.employee.assistantHourlyRate == null).length,
          missingStaffConfigCount: runDetail.lines.filter((line) => line.staffDays > 0 && line.employee.staffDailyRate == null).length,
          hasMismatch: runDetail.lines.some((line) => {
            const assignments = runAssignments.filter((assignment) => assignment.employeeId === line.employeeId);
            const liveTeachingHours = assignments
              .filter((assignment) => assignment.role === "TEACHER")
              .reduce((sum, assignment) => sum + (assignment.hours ?? 0), 0);
            const liveAssistantHours = assignments
              .filter((assignment) => assignment.role === "ASSISTANT" || assignment.role === "ASSISTANT2")
              .reduce((sum, assignment) => sum + (assignment.hours ?? 0), 0);
            const liveStaffDays = runTimesheetEntries
              .filter((entry) => entry.employeeId === line.employeeId)
              .reduce((sum, entry) => sum + (entry.days ?? 0), 0);
            return (
              !isClose(liveTeachingHours, line.teachingHours) ||
              !isClose(liveAssistantHours, line.assistantHours) ||
              !isClose(liveStaffDays, line.staffDays)
            );
          }),
        }
      : null;

  const runChecklistReady = runDetail
    ? runDetail.lines.length > 0 &&
      (runChecklist?.missingTeachingConfigCount ?? 0) === 0 &&
      (runChecklist?.missingAssistantConfigCount ?? 0) === 0 &&
      (runChecklist?.missingStaffConfigCount ?? 0) === 0 &&
      !runChecklist?.hasMismatch
    : false;

  return (
    <div className="min-h-screen space-y-6 pb-20">
      <section className="rounded-[28px] border-2 border-[#fed7aa] bg-gradient-to-r from-[#fff7ed] via-white to-[#fff7ed] px-6 py-6 shadow-sm">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-[#fdba74] bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#c2410c]">
                Payroll
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-[#111827]">Một trang quản trị payroll</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b7280]">
                  Gộp bộ lọc, chỉ số, cảnh báo và thao tác sửa vào cùng một cụm điều khiển để xử lý nhân sự và bảng lương nhanh hơn.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              {canManagePayrollRuns ? <NewPayrollRunForm /> : null}
              <PayrollExportButton
                fromDate={fromDateStr}
                toDate={toDateStr}
                totals={{ totalTeachingAmount, totalAssistantAmount, totalStaffAmount, totalPayroll }}
                employees={employeeRows}
                runs={runRows}
              />
              {canManageEmployees ? <NewEmployeeForm /> : null}
              {selectedEmployeeId ? (
                <a
                  href="#employee-detail"
                  className="inline-flex items-center justify-center rounded-2xl border-2 border-[#fed7aa] bg-white px-5 py-3 text-sm font-bold text-[#c2410c] transition hover:bg-[#fff7ed]"
                >
                  Chỉnh nhân sự đang chọn
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-[#fed7aa] bg-white/80 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#111827]">Khoảng thời gian:</span>
                <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-sm font-bold text-[#c2410c]">
                  {fromDateStr}
                </span>
                <span className="text-[#9ca3af]">→</span>
                <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-sm font-bold text-[#c2410c]">
                  {toDateStr}
                </span>
                <span className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#6b7280]">
                  {formatNumber(employeeRows.reduce((sum, employee) => sum + employee.sessionCount, 0))} buổi
                </span>
                <span className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#6b7280]">
                  {formatNumber(employeeRows.reduce((sum, employee) => sum + employee.timesheetEntryCount, 0))} ngày HC
                </span>
              </div>
              <div className="w-full xl:w-auto">
                <PayrollDateFilter key={`${fromDateStr}|${toDateStr}`} initialFromDate={fromDateStr} initialToDate={toDateStr} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Tổng payroll</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">{formatVnd(totalPayroll)}</p>
                <p className="mt-1 text-xs text-[#6b7280]">Dạy + trợ giảng + hành chính</p>
              </div>
              <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Giờ giảng dạy</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">{formatNumber(totalTeachingHours + totalAssistantHours)}</p>
                <p className="mt-1 text-xs text-[#6b7280]">
                  Dạy {formatNumber(totalTeachingHours)} · TG {formatNumber(totalAssistantHours)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Công hành chính</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">{formatNumber(totalStaffDays)}</p>
                <p className="mt-1 text-xs text-[#6b7280]">{formatNumber(totalStaffHours)} giờ chấm công</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${reviewCount > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Trạng thái dữ liệu</p>
                <p className={`mt-2 text-2xl font-black ${reviewCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {reviewCount > 0 ? `${formatNumber(reviewCount)} lỗi cần xem` : "Sẵn sàng"}
                </p>
                <p className={`mt-1 text-xs ${reviewCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {reviewCount > 0 ? "Cần sửa trước khi chốt" : "Có thể tiếp tục xử lý kỳ lương"}
                </p>
              </div>
            </div>

            {reviewCount > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-sm font-black text-amber-900">Việc cần xử lý trước khi chốt lương</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm font-medium text-amber-800">
                      {missingTeachingRate > 0 ? <span>Thiếu đơn giá dạy: {formatNumber(missingTeachingRate)}</span> : null}
                      {missingAssistantRate > 0 ? <span>Thiếu đơn giá trợ giảng: {formatNumber(missingAssistantRate)}</span> : null}
                      {missingStaffDailyRate > 0 ? <span>Thiếu đơn giá công HC: {formatNumber(missingStaffDailyRate)}</span> : null}
                      {contractAttentionCount > 0 ? <span>Hợp đồng cần chú ý: {formatNumber(contractAttentionCount)}</span> : null}
                    </div>
                    {employeesNeedingRatePreview.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {employeesNeedingRatePreview.map((employee) => (
                          <Link
                            key={employee.id}
                            href={buildPayrollHref({
                              fromDate: fromDateStr,
                              toDate: toDateStr,
                              bankStatus,
                              employeeId: employee.id,
                              runId: selectedRunId,
                              anchor: "employee-detail",
                            })}
                            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900 transition hover:border-amber-500"
                          >
                            {employee.fullName}
                          </Link>
                        ))}
                        <Link
                          href={buildPayrollHref({
                            fromDate: fromDateStr,
                            toDate: toDateStr,
                            bankStatus,
                            employeeId: selectedEmployeeId,
                            runId: selectedRunId,
                            anchor: "employee-detail",
                          })}
                          className="inline-flex rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1 text-xs font-bold text-[#c2410c] transition hover:border-[#fb923c]"
                        >
                          Chỉnh sửa
                        </Link>
                      </div>
                    ) : null}
                  </div>
                  <a
                    href="#employee-detail"
                    className="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700"
                  >
                    Sửa ngay
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Link
          href={buildPayrollHref({ fromDate: fromDateStr, toDate: toDateStr, employeeId: selectedEmployeeId, runId: selectedRunId, anchor: "payroll-table" })}
          className={`rounded-full border px-4 py-2 text-sm font-bold ${
            bankStatus === "all"
              ? "border-[#fed7aa] bg-[#fff7ed] text-[#ea580c]"
              : "border-[#e5e7eb] bg-white text-[#6b7280]"
          }`}
        >
          Tất cả nhân sự có phát sinh
        </Link>
        <Link
          href={buildPayrollHref({
            fromDate: fromDateStr,
            toDate: toDateStr,
            bankStatus: "missing",
            employeeId: selectedEmployeeId,
            runId: selectedRunId,
            anchor: "payroll-table",
          })}
          className={`rounded-full border px-4 py-2 text-sm font-bold ${
            bankStatus === "missing"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-[#e5e7eb] bg-white text-[#6b7280]"
          }`}
        >
          Thiếu thông tin chuyển khoản ({formatNumber(missingBankInfoCount)})
        </Link>
        <Link
          href={buildPayrollHref({
            fromDate: fromDateStr,
            toDate: toDateStr,
            bankStatus: "ready",
            employeeId: selectedEmployeeId,
            runId: selectedRunId,
            anchor: "payroll-table",
          })}
          className={`rounded-full border px-4 py-2 text-sm font-bold ${
            bankStatus === "ready"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[#e5e7eb] bg-white text-[#6b7280]"
          }`}
        >
          Đủ thông tin chuyển khoản
        </Link>
      </section>

      <section id="payroll-table" className="overflow-hidden rounded-2xl border-2 border-[#e5e7eb] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#f3f4f6] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#111827]">Bảng nhân sự payroll</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-sm font-bold text-[#c2410c]">
              {formatNumber(employeeRows.length)} nhân sự
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
              {formatVnd(totalPayroll)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-[#fafafa]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Nhân sự</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Dạy</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Trợ giảng</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Hành chính</th>
                <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Tổng lương</th>
                <th className="hidden">Đơn giá</th>
                <th className="hidden">Chuyển khoản</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {employeeRows.map((employee) => {
                const totalAmount = employee.teachingAmount + employee.assistantAmount + employee.staffAmount;
                const hasRateIssue =
                  (employee.teachingHours > 0 && employee.teachingHourlyRate == null) ||
                  (employee.assistantHours > 0 && employee.assistantHourlyRate == null) ||
                  (employee.staffDays > 0 && employee.staffDailyRate == null);
                const isSelected = employee.id === selectedEmployeeId;

                return (
                  <tr
                    key={employee.id}
                    className={`transition ${
                      isSelected
                        ? "bg-orange-50/70"
                        : hasRateIssue
                          ? "bg-red-50/40 hover:bg-red-50/70"
                          : "hover:bg-[#fafafa]"
                    }`}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-sm font-black text-white">
                          {employee.fullName.charAt(0)}
                        </div>
                        <div>
                          <Link
                            href={buildPayrollHref({
                              fromDate: fromDateStr,
                              toDate: toDateStr,
                              bankStatus,
                              employeeId: employee.id,
                              runId: selectedRunId,
                              anchor: "employee-detail",
                            })}
                            className="font-bold text-[#111827] transition hover:text-[#ea580c]"
                          >
                            {employee.fullName}
                          </Link>
                          <p className="mt-0.5 text-xs text-[#6b7280]">
                            {employee.employeeCode} · {employee.position ?? "Chưa cấu hình vị trí"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="text-sm font-bold text-[#111827]">{formatNumber(employee.teachingHours)}</div>
                      <div className="mt-1 text-xs text-[#6b7280]">{formatVnd(employee.teachingAmount)}</div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="text-sm font-bold text-[#111827]">{formatNumber(employee.assistantHours)}</div>
                      <div className="mt-1 text-xs text-[#6b7280]">{formatVnd(employee.assistantAmount)}</div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="text-sm font-bold text-[#111827]">{formatNumber(employee.staffDays)}</div>
                      <div className="mt-1 text-xs text-[#6b7280]">
                        {formatVnd(employee.staffAmount)} · {formatNumber(employee.staffHours)} giờ
                      </div>
                    </td>
                    <td className="px-4 py-5 text-right">
                      <div className="text-lg font-black text-[#ea580c]">{formatVnd(totalAmount)}</div>
                      <div className="mt-1 text-xs text-[#6b7280]">{formatNumber(employee.sessionCount)} buổi</div>
                    </td>
                    <td className="hidden">
                      <div className="space-y-1.5 text-xs">
                        {employee.teachingHours > 0 ? (
                          <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-700">
                            Dạy:{" "}
                            {employee.teachingHourlyRate != null
                              ? `${formatVnd(employee.teachingHourlyRate)}/${employee.payMode === "SESSION" ? "ca" : "giờ"}`
                              : "Thiếu"}
                          </div>
                        ) : null}
                        {employee.assistantHours > 0 ? (
                          <div className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 font-semibold text-violet-700">
                            TG:{" "}
                            {employee.assistantHourlyRate != null
                              ? `${formatVnd(employee.assistantHourlyRate)}/${employee.payMode === "SESSION" ? "ca" : "giờ"}`
                              : "Thiếu"}
                          </div>
                        ) : null}
                        {employee.staffDays > 0 ? (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-700">
                            HC: {employee.staffDailyRate != null ? `${formatVnd(employee.staffDailyRate)}/công` : "Thiếu"}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="hidden">
                      <div className="space-y-1 text-xs">
                        <div className="font-semibold text-[#111827]">{employee.bankName ?? "Chưa có ngân hàng"}</div>
                        <div className="text-[#6b7280]">{employee.bankAccountNumber ?? "Chưa có số tài khoản"}</div>
                        <div className="text-[#6b7280]">{employee.bankAccountHolder ?? "Chưa có chủ tài khoản"}</div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col items-start gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${
                            employee.workStatus === "ACTIVE"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          {employee.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ"}
                        </span>
                        {hasRateIssue ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                            Thiếu đơn giá
                          </span>
                        ) : null}
                        {!employee.hasBankInfo ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                            Thiếu chuyển khoản
                          </span>
                        ) : null}
                        <Link
                          href={buildPayrollHref({
                            fromDate: fromDateStr,
                            toDate: toDateStr,
                            bankStatus,
                            employeeId: employee.id,
                            runId: selectedRunId,
                            anchor: "employee-detail",
                          })}
                          className="inline-flex items-center justify-center rounded-xl bg-[#ea580c] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#c2410c]"
                        >
                          Chọn & sửa
                        </Link>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getContractTone(employee.contractStatus)}`}>
                          {employee.contractStatus ?? "Chưa có info"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {employeeRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm font-medium text-[#6b7280]">
                    Không có phát sinh payroll trong khoảng thời gian đang lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section id="employee-detail" className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Chi tiết nhân sự</p>
                <h2 className="mt-2 text-2xl font-black text-[#111827]">
                  {selectedEmployeeDetail?.fullName ?? "Chưa chọn nhân sự"}
                </h2>
                {selectedEmployeeDetail ? (
                  <p className="mt-1 text-sm text-[#6b7280]">
                    {selectedEmployeeDetail.employeeCode} · {selectedEmployeeDetail.position ?? "Chưa có vị trí"} · {fromDateStr} → {toDateStr}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-[#6b7280]">Chọn một nhân sự ở bảng trên.</p>
                )}
              </div>

              {selectedEmployeeSummary ? (
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-sm font-bold text-[#c2410c]">
                    Tổng lương: {formatVnd(selectedEmployeeSummary.teachingAmount + selectedEmployeeSummary.assistantAmount + selectedEmployeeSummary.staffAmount)}
                  </span>
                  <span className={`rounded-full border px-3 py-1.5 text-sm font-bold ${getContractTone(selectedEmployeeSummary.contractStatus)}`}>
                    {selectedEmployeeSummary.contractStatus ?? "Chưa có info"}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {selectedEmployeeDetail ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Khối lượng dạy</p>
                  <p className="mt-2 text-2xl font-black text-[#111827]">{formatNumber(selectedEmployeeSummary?.teachingHours ?? 0)}</p>
                  <p className="mt-1 text-xs text-[#6b7280]">{formatVnd(selectedEmployeeSummary?.teachingAmount ?? 0)}</p>
                </div>
                <div className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Khối lượng trợ giảng</p>
                  <p className="mt-2 text-2xl font-black text-[#111827]">{formatNumber(selectedEmployeeSummary?.assistantHours ?? 0)}</p>
                  <p className="mt-1 text-xs text-[#6b7280]">{formatVnd(selectedEmployeeSummary?.assistantAmount ?? 0)}</p>
                </div>
                <div className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Công hành chính</p>
                  <p className="mt-2 text-2xl font-black text-[#111827]">{formatNumber(selectedEmployeeSummary?.staffDays ?? 0)}</p>
                  <p className="mt-1 text-xs text-[#6b7280]">
                    {formatVnd(selectedEmployeeSummary?.staffAmount ?? 0)} · {formatNumber(selectedEmployeeSummary?.staffHours ?? 0)} giờ
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border-2 border-[#e5e7eb] bg-white shadow-sm">
                <div className="border-b border-[#f3f4f6] px-6 py-4">
                  <h3 className="text-lg font-black text-[#111827]">Buổi dạy / trợ giảng trong khoảng lọc</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead className="bg-[#fafafa]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Ngày</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Lớp</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Vai trò</th>
                        <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Giờ</th>
                        <th className="px-6 py-3 text-right text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {selectedEmployeeDetail.sessionAssignments.map((assignment) => (
                        <tr key={assignment.id}>
                          <td className="px-6 py-3 text-sm text-[#111827]">{formatDate(assignment.session.sessionDate)}</td>
                          <td className="px-4 py-3 text-sm text-[#111827]">{assignment.session.class.className}</td>
                          <td className="px-4 py-3 text-sm text-[#6b7280]">{SESSION_ROLE_LABEL[assignment.role] ?? assignment.role}</td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-[#111827]">{formatNumber(assignment.hours ?? 0)}</td>
                          <td className="px-6 py-3 text-right text-sm font-bold text-[#ea580c]">{formatVnd(assignment.amount ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border-2 border-[#e5e7eb] bg-white shadow-sm">
                <div className="border-b border-[#f3f4f6] px-6 py-4">
                  <h3 className="text-lg font-black text-[#111827]">Chấm công hành chính</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead className="bg-[#fafafa]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Ngày</th>
                        <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Giờ</th>
                        <th className="px-6 py-3 text-right text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Công</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {selectedEmployeeDetail.timesheetEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-6 py-3 text-sm text-[#111827]">{formatDate(entry.workDate)}</td>
                          <td className="px-4 py-3 text-center text-sm text-[#111827]">{formatNumber(entry.hours ?? 0)}</td>
                          <td className="px-6 py-3 text-right text-sm font-bold text-[#111827]">{formatNumber(entry.days ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {assistantCard ? (
                <>
                  <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-6 py-5 shadow-sm">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-black text-[#111827]">Điểm đánh giá tháng {assistantMonth}</h3>
                        <p className="mt-1 text-sm text-[#6b7280]">Điểm đánh giá dùng để rà payroll.</p>
                      </div>
                      <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-sm font-bold text-[#c2410c]">
                        Tỷ lệ A: {assistantCard.ratio === null ? "—" : `${assistantCard.ratio.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border-2 border-[#e5e7eb] bg-white shadow-sm">
                    <div className="border-b border-[#f3f4f6] px-6 py-4">
                      <h3 className="text-lg font-black text-[#111827]">Điểm theo cơ sở</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px]">
                        <thead className="bg-[#fafafa]">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Cơ sở</th>
                            <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Số ca</th>
                            <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Ca bổ trợ</th>
                            <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Ca tính điểm</th>
                            <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Điểm trừ</th>
                            <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Điểm cộng</th>
                            <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Tỷ lệ A</th>
                            <th className="px-6 py-3 text-right text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">% thưởng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f3f4f6]">
                          {assistantCard.byBranch.map((branch) => (
                            <tr key={branch.branchId}>
                              <td className="px-6 py-3 text-sm font-semibold text-[#111827]">{branch.branchName}</td>
                              <td className="px-4 py-3 text-center text-sm text-[#111827]">{formatNumber(branch.shifts)}</td>
                              <td className="px-4 py-3 text-center text-sm text-[#111827]">{formatNumber(branch.substituteShifts)}</td>
                              <td className="px-4 py-3 text-center text-sm text-[#111827]">{formatNumber(branch.countedShifts)}</td>
                              <td className="px-4 py-3 text-center text-sm font-bold text-rose-700">{formatNumber(branch.deducted)}</td>
                              <td className="px-4 py-3 text-center text-sm font-bold text-emerald-700">{formatNumber(branch.added)}</td>
                              <td className="px-4 py-3 text-center text-sm font-bold text-[#111827]">
                                {branch.ratio === null ? "—" : `${branch.ratio.toFixed(1)}%`}
                              </td>
                              <td className="px-6 py-3 text-right text-sm font-bold text-[#111827]">
                                {branch.bonus ? `${(branch.bonus.bonusPercent * 100).toFixed(0)}%` : "Chưa nhập"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>

        <aside className="space-y-6">
          {selectedEmployeeDetail ? (
            <>
              <EmployeeProfileEditor
                employee={{
                  id: selectedEmployeeDetail.id,
                  dob: selectedEmployeeDetail.dob ? selectedEmployeeDetail.dob.toISOString() : null,
                  phone: selectedEmployeeDetail.phone,
                  email: selectedEmployeeDetail.email,
                  hometown: selectedEmployeeDetail.hometown,
                  permanentAddress: selectedEmployeeDetail.permanentAddress,
                  idNumber: selectedEmployeeDetail.idNumber,
                  idIssueDate: selectedEmployeeDetail.idIssueDate ? selectedEmployeeDetail.idIssueDate.toISOString() : null,
                  idIssuePlace: selectedEmployeeDetail.idIssuePlace,
                  resignDate: selectedEmployeeDetail.resignDate ? selectedEmployeeDetail.resignDate.toISOString() : null,
                  payMode: selectedEmployeeDetail.payMode,
                  teachingHourlyRate: selectedEmployeeDetail.teachingHourlyRate,
                  assistantHourlyRate: selectedEmployeeDetail.assistantHourlyRate,
                  staffDailyRate: selectedEmployeeDetail.staffDailyRate,
                  bankName: selectedEmployeeDetail.bankName,
                  bankAccountNumber: selectedEmployeeDetail.bankAccountNumber,
                  bankAccountHolder: selectedEmployeeDetail.bankAccountHolder,
                }}
                canEdit={canManageEmployees || canManagePayrollRuns}
              />

              {canCreateTimesheet ? <TimesheetQuickAddForm employeeId={selectedEmployeeDetail.id} /> : null}

              {canManagePayrollRuns && assistantCard ? (
                <AssistantScoreForm
                  employeeId={selectedEmployeeDetail.id}
                  month={assistantMonth}
                  branches={branches}
                  bonusByBranch={Object.fromEntries(
                    assistantCard.byBranch.map((branch) => [branch.branchId, branch.bonus?.bonusPercent ?? null]),
                  )}
                />
              ) : null}
            </>
          ) : null}
        </aside>
      </section>

      <section id="payroll-run-detail" className="space-y-6">
        <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Kỳ lương</p>
              <h2 className="mt-2 text-2xl font-black text-[#111827]">
                {runDetail ? `Đang xem kỳ ${runDetail.periodName}` : "Chưa có kỳ lương"}
              </h2>
              <p className="mt-1 text-sm text-[#6b7280]">Tính lương, soát, sửa và xuất file.</p>
            </div>
            {runDetail ? (
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-sm font-bold ${getRunTone(runDetail.status)}`}>
                  {PAYROLL_RUN_STATUS_LABEL[runDetail.status as keyof typeof PAYROLL_RUN_STATUS_LABEL] ?? runDetail.status}
                </span>
                <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-sm font-bold text-[#c2410c]">
                  {formatNumber(runDetail.lines.length)} người
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {runDetail ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Tổng tiền kỳ</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">
                  {formatVnd(runDetail.lines.reduce((sum, line) => sum + line.totalAmount, 0))}
                </p>
              </div>
              <div className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Giờ dạy + TG</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">
                  {formatNumber(runDetail.lines.reduce((sum, line) => sum + line.teachingHours + line.assistantHours, 0))}
                </p>
              </div>
              <div className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Công hành chính</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">
                  {formatNumber(runDetail.lines.reduce((sum, line) => sum + line.staffDays, 0))}
                </p>
              </div>
              <div
                className={`rounded-2xl border px-5 py-4 shadow-sm ${
                  runChecklistReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">Checklist chốt kỳ</p>
                <p className={`mt-2 text-2xl font-black ${runChecklistReady ? "text-emerald-700" : "text-amber-700"}`}>
                  {runChecklistReady ? "Đạt" : "Chưa đạt"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_420px]">
              <div className="space-y-6">
                <div className="overflow-hidden rounded-2xl border-2 border-[#e5e7eb] bg-white shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-[#f3f4f6] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-[#111827]">Bảng dòng lương trong kỳ</h3>
                      <p className="mt-1 text-sm text-[#6b7280]">Tên nhân sự trong bảng sẽ mở lại đúng khu chỉnh nhân sự phía trên.</p>
                    </div>
                    <PayrollRunExportButton runId={runDetail.id} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1160px]">
                      <thead className="bg-[#fafafa]">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Nhân sự</th>
                          <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Khối lượng</th>
                          <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Lương cứng</th>
                          <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Thưởng / phạt</th>
                          <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Tổng</th>
                          <th className="px-6 py-3 text-right text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">Sửa nhanh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f3f4f6]">
                        {runDetail.lines.map((line) => {
                          const assignments = runAssignments.filter((assignment) => assignment.employeeId === line.employeeId);
                          const liveTeachingHours = assignments
                            .filter((assignment) => assignment.role === "TEACHER")
                            .reduce((sum, assignment) => sum + (assignment.hours ?? 0), 0);
                          const liveAssistantHours = assignments
                            .filter((assignment) => assignment.role === "ASSISTANT" || assignment.role === "ASSISTANT2")
                            .reduce((sum, assignment) => sum + (assignment.hours ?? 0), 0);
                          const liveStaffDays = runTimesheetEntries
                            .filter((entry) => entry.employeeId === line.employeeId)
                            .reduce((sum, entry) => sum + (entry.days ?? 0), 0);
                          const mismatch =
                            !isClose(liveTeachingHours, line.teachingHours) ||
                            !isClose(liveAssistantHours, line.assistantHours) ||
                            !isClose(liveStaffDays, line.staffDays);

                          return (
                            <tr key={line.id} className={mismatch ? "bg-amber-50/40" : ""}>
                              <td className="px-6 py-4 align-top">
                                <Link
                                  href={buildPayrollHref({
                                    fromDate: fromDateStr,
                                    toDate: toDateStr,
                                    bankStatus,
                                    employeeId: line.employeeId,
                                    runId: runDetail.id,
                                    anchor: "employee-detail",
                                  })}
                                  className="font-bold text-[#111827] transition hover:text-[#ea580c]"
                                >
                                  {line.employee.fullName}
                                </Link>
                                <p className="mt-1 text-xs text-[#6b7280]">{line.employee.employeeCode}</p>
                                {mismatch ? (
                                  <p className="mt-2 text-xs font-bold text-amber-700">Dữ liệu nguồn lệch với dòng lương</p>
                                ) : null}
                              </td>
                              <td className="px-4 py-4 align-top text-sm text-[#111827]">
                                <div>Dạy: {formatNumber(line.teachingHours)} giờ</div>
                                <div>TG: {formatNumber(line.assistantHours)} giờ</div>
                                <div>HC: {formatNumber(line.staffDays)} công</div>
                              </td>
                              <td className="px-4 py-4 align-top text-sm text-[#111827]">
                                <div>Dạy: {formatVnd(line.teachingAmount)}</div>
                                <div>TG: {formatVnd(line.assistantAmount)}</div>
                                <div>Cứng: {formatVnd(line.baseSalaryAmount)}</div>
                              </td>
                              <td className="px-4 py-4 align-top text-sm text-[#111827]">
                                <div className="text-emerald-700">+ {formatVnd(line.bonus)}</div>
                                <div className="text-rose-700">- {formatVnd(line.penalty)}</div>
                              </td>
                              <td className="px-4 py-4 text-right align-top text-lg font-black text-[#ea580c]">
                                {formatVnd(line.totalAmount)}
                              </td>
                              <td className="px-6 py-4 text-right align-top">
                                {canEditPayroll(runDetail.status) ? (
                                  <PayrollLineEditor
                                    lineId={line.id}
                                    bonus={line.bonus}
                                    penalty={line.penalty}
                                    employeeName={line.employee.fullName}
                                  />
                                ) : (
                                  <span className="text-xs text-[#9ca3af]">Đã khóa sửa</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <PayrollRunActions runId={runDetail.id} status={runDetail.status} checklistReady={runChecklistReady} />

                <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-5 shadow-sm">
                  <h3 className="text-lg font-black text-[#111827]">Checklist chốt kỳ</h3>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="rounded-xl border border-[#f3f4f6] bg-[#fafafa] px-4 py-3">
                      Số nhân sự trong kỳ: <span className="font-bold text-[#111827]">{formatNumber(runDetail.lines.length)}</span>
                    </div>
                    <div className="rounded-xl border border-[#f3f4f6] bg-[#fafafa] px-4 py-3">
                      Thiếu đơn giá dạy: <span className="font-bold text-[#111827]">{formatNumber(runChecklist?.missingTeachingConfigCount ?? 0)}</span>
                    </div>
                    <div className="rounded-xl border border-[#f3f4f6] bg-[#fafafa] px-4 py-3">
                      Thiếu đơn giá trợ giảng: <span className="font-bold text-[#111827]">{formatNumber(runChecklist?.missingAssistantConfigCount ?? 0)}</span>
                    </div>
                    <div className="rounded-xl border border-[#f3f4f6] bg-[#fafafa] px-4 py-3">
                      Thiếu đơn giá công HC: <span className="font-bold text-[#111827]">{formatNumber(runChecklist?.missingStaffConfigCount ?? 0)}</span>
                    </div>
                    <div className="rounded-xl border border-[#f3f4f6] bg-[#fafafa] px-4 py-3">
                      Lệch dữ liệu nguồn: <span className="font-bold text-[#111827]">{runChecklist?.hasMismatch ? "Có" : "Không"}</span>
                    </div>
                  </div>
                </div>

                {canEditPayroll(runDetail.status) ? (
                  <AddPayrollLineForm payrollRunId={runDetail.id} employeeOptions={eligibleEmployees} />
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[#e5e7eb] bg-white px-6 py-12 text-center text-sm text-[#6b7280] shadow-sm">
            Chưa có kỳ lương để xem chi tiết.
          </div>
        )}
      </section>
    </div>
  );
}



