import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canView } from "@/lib/server/role-matrix";
import { computeContractStatus, PAYROLL_RUN_STATUS_LABEL } from "@/lib/server/payroll-rules";
import { getCurrentBranchId } from "@/lib/branch-filter";
import NewEmployeeForm from "@/components/payroll/NewEmployeeForm";
import NewPayrollRunForm from "@/components/payroll/NewPayrollRunForm";
import PayrollDateFilter from "@/components/payroll/PayrollDateFilter";
import PayrollExportButton from "@/components/payroll/PayrollExportButton";
import PayrollRateSetupPanel from "@/components/payroll/PayrollRateSetupPanel";
import PageGuide from "@/components/ui/PageGuide";

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function formatNumber(n: number) {
  return n.toLocaleString("vi-VN");
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getContractTone(status: string | null) {
  if (!status || status === "Chưa có info") return "bg-slate-100 text-slate-700";
  if (status.includes("Đã hết hạn")) return "bg-rose-50 text-rose-600";
  if (status.includes("Sắp")) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function getRunTone(status: string) {
  if (status === "PAID") return "bg-emerald-50 text-emerald-700";
  if (status === "LOCKED") return "bg-sky-50 text-sky-700";
  if (status === "APPROVED") return "bg-violet-50 text-violet-700";
  if (status === "REVIEWED") return "bg-amber-50 text-amber-700";
  if (status === "CALCULATED") return "bg-orange-50 text-orange-700";
  if (status === "DRAFT") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

const PAYROLL_PAGE_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu trang này",
    items: [
      "Theo dõi nhân sự, công giảng dạy, chấm công và các đợt tính lương trong cùng một màn hình.",
      "Đối chiếu nhanh ai đang có dữ liệu công, ai sắp hết hợp đồng và kỳ lương nào đã chốt.",
      "Đi tiếp vào chi tiết từng nhân viên khi cần xem breakdown sâu hơn.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác nhanh",
    items: [
      "Chọn đúng khoảng ngày trước để toàn bộ số giờ, số buổi và bảng lương ra đúng kỳ.",
      "Dùng tạo nhân sự khi thêm người mới, và tạo kỳ lương khi đã sẵn sàng chốt dữ liệu.",
      "Xuất file sau khi đã kiểm tra đúng ngày và đúng cơ sở để tránh lệch số.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Kỳ lương bản nháp vẫn có thể thay đổi, chỉ coi là chốt khi trạng thái đã finalized.",
      "Nếu số tiền chưa khớp, hãy đối chiếu lại chấm công, buổi dạy hoàn thành và phân công trợ giảng.",
      "Tình trạng hợp đồng chỉ là cảnh báo vận hành, không tự động quyết định quyền hay lương.",
    ],
    tone: "warning" as const,
  },
];

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: { fromDate?: string; toDate?: string; bankStatus?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if ((role === "TEACHER" || role === "TEACHING_ASSISTANT") && user?.employeeId) {
    redirect(`/payroll/employees/${user.employeeId}`);
  }

  if (!canView("hr", role)) {
    notFound();
  }

  const canManageEmployees = canCreate("hr", role);
  const canManagePayrollRuns = canUpdate("hr", role);

  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const rangeStart = searchParams?.fromDate ? new Date(`${searchParams.fromDate}T00:00:00`) : defaultFrom;
  const rangeEnd = searchParams?.toDate ? new Date(`${searchParams.toDate}T00:00:00`) : today;
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);

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

  const employees = employeesRaw.map(({ contracts, ...employee }) => ({
    ...employee,
    contractStatus: computeContractStatus(employee.resignDate, contracts[0]?.expiryDate ?? null),
  }));

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

  const employeeWork = employees.map((employee) => {
    const teaching = teachingByEmployee.get(employee.id) ?? { hours: 0, amount: 0, sessions: 0 };
    const assistant = assistantByEmployee.get(employee.id) ?? { hours: 0, amount: 0, sessions: 0 };
    const timesheet = timesheetByEmployee.get(employee.id) ?? { days: 0, hours: 0, entries: 0 };

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      shortName: employee.shortName,
      position: employee.position,
      bankName: employee.bankName,
      bankAccountNumber: employee.bankAccountNumber,
      bankAccountHolder: employee.bankAccountHolder,
      teachingHourlyRate: employee.teachingHourlyRate,
      assistantHourlyRate: employee.assistantHourlyRate,
      staffDailyRate: employee.staffDailyRate,
      payMode: employee.payMode,
      workStatus: employee.workStatus,
      contractStatus: employee.contractStatus,
      teachingHours: teaching.hours,
      teachingAmount: teaching.amount,
      assistantHours: assistant.hours,
      assistantAmount: assistant.amount,
      staffDays: timesheet.days,
      staffHours: timesheet.hours,
      staffAmount: Math.round(timesheet.days * (employee.staffDailyRate ?? 0)),
      sessionCount: teaching.sessions + assistant.sessions,
      timesheetEntryCount: timesheet.entries,
      hasBankInfo: Boolean(employee.bankName && employee.bankAccountNumber),
    };
  });

  const employeeRowsBase = employeeWork
    .filter((employee) => employee.teachingHours > 0 || employee.assistantHours > 0 || employee.staffDays > 0 || employee.staffHours > 0)
    .sort((a, b) => b.teachingAmount + b.assistantAmount + b.staffAmount - (a.teachingAmount + a.assistantAmount + a.staffAmount));

  const bankStatus =
    searchParams?.bankStatus === "missing" || searchParams?.bankStatus === "ready"
      ? searchParams.bankStatus
      : "all";
  const employeeRows = employeeRowsBase.filter((employee) => {
    if (bankStatus === "missing") return !employee.hasBankInfo;
    if (bankStatus === "ready") return employee.hasBankInfo;
    return true;
  });

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

  const fromDateStr = toYmd(rangeStart);
  const toDateStr = toYmd(rangeEnd);
  const employeesNeedingRateSetup = employeeRows.filter(
    (employee) =>
      (employee.teachingHours > 0 && employee.teachingHourlyRate == null) ||
      (employee.assistantHours > 0 && employee.assistantHourlyRate == null) ||
      (employee.staffDays > 0 && employee.staffDailyRate == null),
  );

  return (
    <div className="min-h-screen space-y-6 pb-20">
      <PageGuide
        title="Guide payroll"
        summary="Giải thích nhanh cách đọc nhân sự, công việc theo kỳ và các đợt chốt lương."
        sections={PAYROLL_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide payroll"
      />
      
      {/* Hero Header */}
      <section className="overflow-hidden rounded-[32px] border-2 border-[#fed7aa] bg-gradient-to-r from-[#fff7ed] via-[#ffedd5] to-[#fed7aa] px-6 py-8 shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#ea580c] bg-[#ea580c] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              Payroll
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
              Bảng lương nhân sự
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#78716c]">
              Gom gọn công dạy, trợ giảng và hành chính trong cùng một màn để rà nhanh, tạo kỳ lương và xuất báo cáo ngay.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border-2 border-[#fed7aa] bg-white px-4 py-2 text-sm font-bold text-[#111827] shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {formatNumber(activeCount)} nhân sự
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {formatNumber(employeeRows.length)} có phát sinh
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold ${
                missingBankInfoCount > 0
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
              }`}>
                {missingBankInfoCount > 0 ? `${formatNumber(missingBankInfoCount)} thiếu TK CK` : "Đủ thông tin CK"}
              </span>
              {reviewCount > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {formatNumber(reviewCount)} cần rà soát
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canManagePayrollRuns ? <NewPayrollRunForm /> : null}
            {canManagePayrollRuns ? (
              <Link href="/payroll/rates" className="inline-flex items-center justify-center rounded-2xl border-2 border-[#fed7aa] bg-white px-5 py-3 text-sm font-bold text-[#c2410c] transition hover:bg-[#fff7ed]">
                Bảng đơn giá nhân sự
              </Link>
            ) : null}
            <PayrollExportButton
              fromDate={fromDateStr}
              toDate={toDateStr}
              totals={{ totalTeachingAmount, totalAssistantAmount, totalStaffAmount, totalPayroll }}
              employees={employeeRows}
              runs={runRows}
            />
            {(canManagePayrollRuns || canManageEmployees) ? (
              <details className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-4 py-3 shadow-sm">
                <summary className="cursor-pointer text-sm font-bold text-[#6b7280]">Tác vụ khác</summary>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {canManagePayrollRuns ? (
                    <Link href="/payroll/assistant-scores" className="btn-ghost">
                      Đánh giá nhân sự
                    </Link>
                  ) : null}
                  {canManageEmployees ? <NewEmployeeForm /> : null}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </section>

      {/* Warning Box - Cần xử lý */}
      {reviewCount > 0 && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900">⚠️ Cần xử lý trước khi tạo kỳ lương</h3>
                <div className="mt-3 space-y-2">
                  {missingTeachingRate > 0 && (
                    <p className="text-sm font-medium text-red-800">
                      • <strong>{missingTeachingRate} giảng viên</strong> chưa có đơn giá dạy → Không tính được tiền lương
                    </p>
                  )}
                  {missingAssistantRate > 0 && (
                    <p className="text-sm font-medium text-red-800">
                      • <strong>{missingAssistantRate} trợ giảng</strong> chưa có đơn giá TG → Không tính được tiền lương
                    </p>
                  )}
                  {missingStaffDailyRate > 0 && (
                    <p className="text-sm font-medium text-red-800">
                      • <strong>{missingStaffDailyRate} nhân sự</strong> chưa có đơn giá 1 công HC → Công hành chính sẽ ra 0đ
                    </p>
                  )}
                  {contractAttentionCount > 0 && (
                    <p className="text-sm font-medium text-red-800">
                      • <strong>{contractAttentionCount} người</strong> sắp hết hạn hợp đồng hoặc cần gia hạn
                    </p>
                  )}
                </div>
                <div className="mt-4">
                  <Link href="#employee-rate-setup" className="inline-flex items-center gap-2 rounded-xl border-2 border-red-600 bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-red-700">
                    Mở thiết lập đơn giá nhanh
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {canManagePayrollRuns && employeesNeedingRateSetup.length > 0 ? (
            <div id="employee-rate-setup">
              <PayrollRateSetupPanel items={employeesNeedingRateSetup} />
            </div>
          ) : null}
        </div>
      )}

      {/* Date Filter */}
      <section className="space-y-4 rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="font-bold text-[#111827]">Khoảng thời gian:</span>
            <span className="rounded-full border-2 border-[#fed7aa] bg-[#fff7ed] px-4 py-1.5 text-sm font-bold text-[#ea580c]">
              {fromDateStr}
            </span>
            <span className="text-[#9ca3af]">→</span>
            <span className="rounded-full border-2 border-[#fed7aa] bg-[#fff7ed] px-4 py-1.5 text-sm font-bold text-[#ea580c]">
              {toDateStr}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border-2 border-[#e5e7eb] bg-white px-3 py-1 text-sm font-medium text-[#6b7280]">
              {formatNumber(employeeRows.reduce((sum, employee) => sum + employee.sessionCount, 0))} buổi
            </span>
            <span className="rounded-full border-2 border-[#e5e7eb] bg-white px-3 py-1 text-sm font-medium text-[#6b7280]">
              {formatNumber(employeeRows.reduce((sum, employee) => sum + employee.timesheetEntryCount, 0))} ngày HC
            </span>
          </div>
        </div>

        <details>
          <summary className="cursor-pointer text-sm font-bold text-[#6b7280]">
            Đổi khoảng thời gian lọc
          </summary>
          <div className="mt-3">
            <PayrollDateFilter key={`${fromDateStr}|${toDateStr}`} initialFromDate={fromDateStr} initialToDate={toDateStr} />
          </div>
        </details>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Tổng phát sinh</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black text-[#111827]">{formatVnd(totalPayroll)}</p>
          <p className="mt-1 text-xs text-[#6b7280]">Dạy + Trợ giảng + HC</p>
        </div>

        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Giờ giảng dạy</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black text-[#111827]">{formatNumber(totalTeachingHours + totalAssistantHours)}</p>
          <p className="mt-1 text-xs text-[#6b7280]">Dạy {formatNumber(totalTeachingHours)} · TG {formatNumber(totalAssistantHours)}</p>
        </div>

        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Công hành chính</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black text-[#111827]">{formatNumber(totalStaffDays)}</p>
          <p className="mt-1 text-xs text-[#6b7280]">{formatNumber(totalStaffHours)} giờ chấm công</p>
        </div>

        <div className={`group rounded-2xl border-2 px-5 py-4 transition-all hover:shadow-lg ${
          reviewCount > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Cần rà soát</p>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              reviewCount > 0 ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
            }`}>
              {reviewCount > 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </div>
          <p className={`text-2xl font-black ${reviewCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {formatNumber(reviewCount)}
          </p>
          <p className={`mt-1 text-xs ${reviewCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {reviewCount > 0 ? `Thiếu đơn giá ${formatNumber(missingTeachingRate + missingAssistantRate + missingStaffDailyRate)}` : 'Sẵn sàng tính lương'}
          </p>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Link
          href={`/payroll?fromDate=${fromDateStr}&toDate=${toDateStr}#employee-payroll-table`}
          className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${
            bankStatus === "all"
              ? "border-[#fed7aa] bg-[#fff7ed] text-[#ea580c]"
              : "border-[#e5e7eb] bg-white text-[#6b7280]"
          }`}
        >
          Tất cả nhân sự có phát sinh
        </Link>
        <Link
          href={`/payroll?fromDate=${fromDateStr}&toDate=${toDateStr}&bankStatus=missing#employee-payroll-table`}
          className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${
            bankStatus === "missing"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-[#e5e7eb] bg-white text-[#6b7280]"
          }`}
        >
          Thiếu thông tin chuyển khoản ({formatNumber(missingBankInfoCount)})
        </Link>
        <Link
          href={`/payroll?fromDate=${fromDateStr}&toDate=${toDateStr}&bankStatus=ready#employee-payroll-table`}
          className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${
            bankStatus === "ready"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[#e5e7eb] bg-white text-[#6b7280]"
          }`}
        >
          Đủ thông tin chuyển khoản
        </Link>
      </section>

      <section id="employee-payroll-table" className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
        <div className="overflow-hidden rounded-2xl border-2 border-[#e5e7eb] bg-white shadow-lg">
          <div className="flex flex-col gap-3 border-b-2 border-[#f3f4f6] bg-gradient-to-r from-[#fafafa] to-white px-6 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#111827]">Nhân sự có phát sinh lương</h2>
              <p className="mt-1 text-sm font-medium text-[#6b7280]">Giữ bảng gọn: chỉ hiện người có số liệu trong khoảng thời gian đang lọc.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border-2 border-[#fed7aa] bg-[#fff7ed] px-4 py-1.5 text-sm font-bold text-[#ea580c]">
                {formatNumber(employeeRows.length)} nhân sự
              </span>
              <span className="rounded-full border-2 border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-700">
                {formatVnd(totalPayroll)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <table className="w-full min-w-[1100px]">
              <thead className="border-b-2 border-[#f3f4f6] bg-gradient-to-r from-[#fafafa] to-white">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6b7280]">Nhân sự</th>
                  <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">Dạy</th>
                  <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">Trợ giảng</th>
                  <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">HC</th>
                  <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-wider text-[#6b7280]">Tổng lương</th>
                  <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">Đơn giá cá nhân</th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-[#6b7280]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {employeeRows.map((employee) => {
                  const totalAmount = employee.teachingAmount + employee.assistantAmount + employee.staffAmount;
                  const hasRateIssue = 
                    (employee.teachingHours > 0 && employee.teachingHourlyRate == null) ||
                    (employee.assistantHours > 0 && employee.assistantHourlyRate == null) ||
                    (employee.staffDays > 0 && employee.staffDailyRate == null);

                  return (
                    <tr 
                      key={employee.id} 
                      className={`transition-colors ${hasRateIssue ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-[#fafafa]'}`}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-sm font-black text-white shadow-md">
                            {employee.fullName.charAt(0)}
                          </div>
                          <div>
                            <Link href={`/payroll/employees/${employee.id}`} className="font-bold text-[#111827] hover:text-[#f97316] transition-colors">
                              {employee.fullName}
                            </Link>
                            <p className="mt-0.5 text-xs font-medium text-[#6b7280]">
                              {employee.employeeCode} · {employee.position ?? "Chưa cấu hình"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-5 text-center">
                        <p className="text-base font-bold text-[#111827]">{formatNumber(employee.teachingHours)}</p>
                        <p className="mt-0.5 text-xs text-[#9ca3af]">giờ</p>
                        <p className="mt-1 text-sm font-semibold text-[#6b7280]">{formatVnd(employee.teachingAmount)}</p>
                      </td>

                      <td className="px-4 py-5 text-center">
                        <p className="text-base font-bold text-[#111827]">{formatNumber(employee.assistantHours)}</p>
                        <p className="mt-0.5 text-xs text-[#9ca3af]">giờ</p>
                        <p className="mt-1 text-sm font-semibold text-[#6b7280]">{formatVnd(employee.assistantAmount)}</p>
                      </td>

                      <td className="px-4 py-5 text-center">
                        <p className="text-base font-bold text-[#111827]">{formatNumber(employee.staffDays)}</p>
                        <p className="mt-0.5 text-xs text-[#9ca3af]">công</p>
                        <p className="mt-1 text-sm font-semibold text-[#6b7280]">{formatVnd(employee.staffAmount)}</p>
                        <p className="mt-1 text-xs text-[#9ca3af]">{formatNumber(employee.staffHours)} giờ</p>
                      </td>

                      <td className="px-4 py-5 text-right">
                        <p className="text-xl font-black text-[#f97316]">{formatVnd(totalAmount)}</p>
                        <p className="mt-0.5 text-xs text-[#9ca3af]">{employee.sessionCount} buổi</p>
                      </td>

                      <td className="px-4 py-5">
                        <div className="space-y-1.5">
                          {employee.teachingHours > 0 && (
                            <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 ${
                              employee.teachingHourlyRate == null ? 'bg-red-100 border-2 border-red-300' : 'bg-blue-50 border border-blue-200'
                            }`}>
                              <span className="text-xs font-bold text-[#6b7280]">Dạy:</span>
                              <span className={`text-xs font-bold ${employee.teachingHourlyRate == null ? 'text-red-700' : 'text-blue-700'}`}>
                                {employee.teachingHourlyRate != null ? `${formatVnd(employee.teachingHourlyRate)}/${employee.payMode === "SESSION" ? "ca" : "giờ"}` : "⚠️ Chưa có"}
                              </span>
                            </div>
                          )}
                          {employee.assistantHours > 0 && (
                            <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 ${
                              employee.assistantHourlyRate == null ? 'bg-red-100 border-2 border-red-300' : 'bg-violet-50 border border-violet-200'
                            }`}>
                              <span className="text-xs font-bold text-[#6b7280]">TG:</span>
                              <span className={`text-xs font-bold ${employee.assistantHourlyRate == null ? 'text-red-700' : 'text-violet-700'}`}>
                                {employee.assistantHourlyRate != null ? `${formatVnd(employee.assistantHourlyRate)}/${employee.payMode === "SESSION" ? "ca" : "giờ"}` : "⚠️ Chưa có"}
                              </span>
                            </div>
                          )}
                          {employee.staffDays > 0 && (
                            <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 ${
                              employee.staffDailyRate == null ? 'bg-red-100 border-2 border-red-300' : 'bg-emerald-50 border border-emerald-200'
                            }`}>
                              <span className="text-xs font-bold text-[#6b7280]">HC:</span>
                              <span className={`text-xs font-bold ${employee.staffDailyRate == null ? 'text-red-700' : 'text-emerald-700'}`}>
                                {employee.staffDailyRate != null ? `${formatVnd(employee.staffDailyRate)}/công` : "⚠️ Chưa có"}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                              employee.workStatus === "ACTIVE"
                                ? "border-2 border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-2 border-gray-200 bg-gray-50 text-gray-700"
                            }`}
                          >
                            {employee.workStatus === "ACTIVE" ? "✓ Đang làm" : "Đã nghỉ"}
                          </span>
                          {employee.contractStatus && employee.contractStatus !== "Chưa có info" ? (
                            <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${getContractTone(employee.contractStatus)} border-2`}>
                              {employee.contractStatus}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {employeeRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f3f4f6]">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-[#6b7280]">
                          Chưa có phát sinh lương trong khoảng ngày này
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between gap-3 border-b-2 border-[#f3f4f6] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#111827]">Kỳ lương gần đây</h2>
                  <p className="text-xs text-[#6b7280]">Mở nhanh để đối chiếu</p>
                </div>
              </div>
              <span className="rounded-full border-2 border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-sm font-bold text-[#ea580c]">
                {formatNumber(runRows.length)}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {runRows.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-[#e5e7eb] px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3f4f6]">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-[#6b7280]">Chưa có kỳ lương</p>
                  </div>
                </div>
              ) : (
                runRows.map((run) => (
                  <Link
                    key={run.id}
                    href={`/payroll/${run.id}`}
                    className="block rounded-xl border-2 border-[#e5e7eb] bg-white px-4 py-4 transition-all hover:border-[#f97316] hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-[#111827]">{run.periodName}</p>
                        <p className="mt-0.5 text-xs font-medium text-[#6b7280]">{run.lineCount} nhân sự</p>
                      </div>
                      <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${getRunTone(run.status)} border-2`}>
                        {PAYROLL_RUN_STATUS_LABEL[run.status as keyof typeof PAYROLL_RUN_STATUS_LABEL] ?? run.status}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-[#fafafa] px-3 py-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Tổng tiền</span>
                        <span className="text-sm font-black text-[#f97316]">{formatVnd(run.totalAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-[#fafafa] px-3 py-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Khối lượng</span>
                        <span className="text-xs font-bold text-[#111827]">
                          {formatNumber(run.teachingHours + run.assistantHours)} giờ · {formatNumber(run.staffDays)} công
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
