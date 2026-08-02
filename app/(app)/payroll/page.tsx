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
  if (status === "FINALIZED") return "bg-emerald-50 text-emerald-700";
  if (status === "DRAFT") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: { fromDate?: string; toDate?: string };
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
      teachingHourlyRate: employee.teachingHourlyRate,
      assistantHourlyRate: employee.assistantHourlyRate,
      workStatus: employee.workStatus,
      contractStatus: employee.contractStatus,
      teachingHours: teaching.hours,
      teachingAmount: teaching.amount,
      assistantHours: assistant.hours,
      assistantAmount: assistant.amount,
      staffDays: timesheet.days,
      staffHours: timesheet.hours,
      sessionCount: teaching.sessions + assistant.sessions,
      timesheetEntryCount: timesheet.entries,
    };
  });

  const employeeRows = employeeWork
    .filter((employee) => employee.teachingHours > 0 || employee.assistantHours > 0 || employee.staffDays > 0 || employee.staffHours > 0)
    .sort((a, b) => b.teachingAmount + b.assistantAmount - (a.teachingAmount + a.assistantAmount));

  const totalTeachingHours = employeeRows.reduce((sum, employee) => sum + employee.teachingHours, 0);
  const totalTeachingAmount = employeeRows.reduce((sum, employee) => sum + employee.teachingAmount, 0);
  const totalAssistantHours = employeeRows.reduce((sum, employee) => sum + employee.assistantHours, 0);
  const totalAssistantAmount = employeeRows.reduce((sum, employee) => sum + employee.assistantAmount, 0);
  const totalStaffDays = employeeRows.reduce((sum, employee) => sum + employee.staffDays, 0);
  const totalStaffHours = employeeRows.reduce((sum, employee) => sum + employee.staffHours, 0);
  const totalPayroll = totalTeachingAmount + totalAssistantAmount;

  const missingTeachingRate = employeeRows.filter((employee) => employee.teachingHours > 0 && employee.teachingHourlyRate == null).length;
  const missingAssistantRate = employeeRows.filter((employee) => employee.assistantHours > 0 && employee.assistantHourlyRate == null).length;
  const contractAttentionCount = employees.filter((employee) => employee.contractStatus && employee.contractStatus !== "Chưa có info").length;
  const reviewCount = missingTeachingRate + missingAssistantRate + contractAttentionCount;
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

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[30px] border border-[#d9e7fb] bg-white px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#3da3ff]">Payroll</p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-[#12304a] md:text-[38px]">Bảng lương nhân sự</h1>
              <p className="max-w-3xl text-sm text-[#5b6b7f] md:text-base">
                Gom gọn công dạy, trợ giảng và hành chính trong cùng một màn để rà nhanh, tạo kỳ lương và xuất báo cáo ngay.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[#cfe2ff] bg-[#f3f8ff] px-3 py-1 text-sm font-medium text-[#1f5fa8]">
                Nhân sự hoạt động {formatNumber(activeCount)}
              </span>
              <span className="rounded-full border border-[#cfe2ff] bg-white px-3 py-1 text-sm font-medium text-[#34506b]">
                Có phát sinh {formatNumber(employeeRows.length)}
              </span>
              <span className="rounded-full border border-[#ffe0b2] bg-[#fff8eb] px-3 py-1 text-sm font-medium text-[#b96a00]">
                Cần rà soát {formatNumber(reviewCount)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {canManagePayrollRuns ? (
              <Link href="/payroll/assistant-scores" className="btn-ghost">
                Đánh giá nhân sự
              </Link>
            ) : null}
            {canManageEmployees ? <NewEmployeeForm /> : null}
            {canManagePayrollRuns ? <NewPayrollRunForm /> : null}
            <PayrollExportButton
              fromDate={fromDateStr}
              toDate={toDateStr}
              totals={{ totalTeachingAmount, totalAssistantAmount, totalPayroll }}
              employees={employeeRows}
              runs={runRows}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[28px] border border-[#d9e7fb] bg-white px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#cfe2ff] bg-[#f7fbff] px-3 py-1 text-sm font-medium text-[#205b98]">
              Từ {fromDateStr}
            </span>
            <span className="rounded-full border border-[#cfe2ff] bg-[#f7fbff] px-3 py-1 text-sm font-medium text-[#205b98]">
              Đến {toDateStr}
            </span>
            <span className="rounded-full border border-[#e5edf6] bg-white px-3 py-1 text-sm font-medium text-[#5a6a7d]">
              {formatNumber(employeeRows.reduce((sum, employee) => sum + employee.sessionCount, 0))} buổi đã chốt
            </span>
            <span className="rounded-full border border-[#e5edf6] bg-white px-3 py-1 text-sm font-medium text-[#5a6a7d]">
              {formatNumber(employeeRows.reduce((sum, employee) => sum + employee.timesheetEntryCount, 0))} ngày hành chính
            </span>
          </div>
        </div>

        <PayrollDateFilter key={`${fromDateStr}|${toDateStr}`} initialFromDate={fromDateStr} initialToDate={toDateStr} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-[24px] border border-[#d8e7fb] bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8aa0ba]">Tổng phát sinh</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#12304a]">{formatVnd(totalPayroll)}</p>
          <p className="mt-1 text-sm text-[#6f7f92]">Chỉ gồm tiền dạy và trợ giảng.</p>
        </div>

        <div className="rounded-[24px] border border-[#d8e7fb] bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8aa0ba]">Giờ dạy / trợ giảng</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#12304a]">
            {formatNumber(totalTeachingHours + totalAssistantHours)}
          </p>
          <p className="mt-1 text-sm text-[#6f7f92]">
            Dạy {formatNumber(totalTeachingHours)} giờ · TG {formatNumber(totalAssistantHours)} giờ
          </p>
        </div>

        <div className="rounded-[24px] border border-[#d8e7fb] bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8aa0ba]">Công hành chính</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#12304a]">{formatNumber(totalStaffDays)}</p>
          <p className="mt-1 text-sm text-[#6f7f92]">{formatNumber(totalStaffHours)} giờ chấm công</p>
        </div>

        <div className="rounded-[24px] border border-[#ffe5c2] bg-[#fff9ef] px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#c17a1c]">Cần rà soát</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#8f5200]">{formatNumber(reviewCount)}</p>
          <p className="mt-1 text-sm text-[#9a6a1c]">
            Thiếu đơn giá {formatNumber(missingTeachingRate + missingAssistantRate)} · Hợp đồng {formatNumber(contractAttentionCount)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
        <div className="overflow-hidden rounded-[28px] border border-[#d9e7fb] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#e8eef6] px-5 py-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#14314a]">Nhân sự có phát sinh lương</h2>
              <p className="mt-1 text-sm text-[#6b7a8c]">Giữ bảng gọn: chỉ hiện người có số liệu trong khoảng thời gian đang lọc.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[#dbe6f4] bg-[#f8fbff] px-3 py-1 text-sm font-medium text-[#4f6175]">
                {formatNumber(employeeRows.length)} nhân sự
              </span>
              <span className="rounded-full border border-[#dbe6f4] bg-[#f8fbff] px-3 py-1 text-sm font-medium text-[#4f6175]">
                {formatVnd(totalPayroll)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-[#e8eef6] bg-[#f8fbff] text-xs uppercase tracking-[0.24em] text-[#7b8ea5]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nhân sự</th>
                  <th className="px-4 py-3 font-semibold">Vai trò</th>
                  <th className="px-4 py-3 font-semibold">Dạy</th>
                  <th className="px-4 py-3 font-semibold">Trợ giảng</th>
                  <th className="px-4 py-3 font-semibold">Hành chính</th>
                  <th className="px-4 py-3 font-semibold">Tổng phát sinh</th>
                  <th className="px-4 py-3 font-semibold">Đơn giá</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {employeeRows.map((employee) => {
                  const totalAmount = employee.teachingAmount + employee.assistantAmount;

                  return (
                    <tr key={employee.id} className="border-b border-[#eef3f9] align-top last:border-0 hover:bg-[#fbfdff]">
                      <td className="px-4 py-4">
                        <Link href={`/payroll/employees/${employee.id}`} className="font-semibold text-[#1f5fa8] transition hover:text-[#0f7ae5]">
                          {employee.fullName}
                        </Link>
                        <p className="mt-1 text-xs text-[#7b8ea5]">
                          {employee.employeeCode} · {employee.shortName}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-[#3f5368]">
                        <p className="font-medium">{employee.position ?? "Chưa cấu hình"}</p>
                        <p className="mt-1 text-xs text-[#7b8ea5]">
                          {employee.sessionCount} buổi · {employee.timesheetEntryCount} ngày
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-[#153450]">{formatNumber(employee.teachingHours)} giờ</p>
                        <p className="mt-1 text-xs text-[#6b7a8c]">{formatVnd(employee.teachingAmount)}</p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-[#153450]">{formatNumber(employee.assistantHours)} giờ</p>
                        <p className="mt-1 text-xs text-[#6b7a8c]">{formatVnd(employee.assistantAmount)}</p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-[#153450]">{formatNumber(employee.staffDays)} công</p>
                        <p className="mt-1 text-xs text-[#6b7a8c]">{formatNumber(employee.staffHours)} giờ</p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-base font-semibold text-[#12304a]">{formatVnd(totalAmount)}</p>
                        <p className="mt-1 text-xs text-[#7b8ea5]">Dạy + trợ giảng</p>
                      </td>

                      <td className="px-4 py-4 text-xs text-[#51657a]">
                        <p>GV: {employee.teachingHourlyRate != null ? formatVnd(employee.teachingHourlyRate) : "Chưa có"}</p>
                        <p className="mt-1">TG: {employee.assistantHourlyRate != null ? formatVnd(employee.assistantHourlyRate) : "Chưa có"}</p>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={
                              employee.workStatus === "ACTIVE"
                                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                            }
                          >
                            {employee.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ"}
                          </span>
                          {employee.contractStatus && employee.contractStatus !== "Chưa có info" ? (
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getContractTone(employee.contractStatus)}`}>
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
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#7b8ea5]">
                      Chưa có phát sinh lương trong khoảng ngày này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-[#d9e7fb] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[#14314a]">Kỳ lương gần đây</h2>
                <p className="mt-1 text-sm text-[#6b7a8c]">Mở nhanh kỳ đã tạo để đối chiếu hoặc chốt.</p>
              </div>
              <span className="rounded-full border border-[#dbe6f4] bg-[#f7fbff] px-3 py-1 text-sm font-medium text-[#235f9d]">
                {formatNumber(runRows.length)} kỳ
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {runRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d9e7fb] px-4 py-8 text-center text-sm text-[#7b8ea5]">
                  Chưa có kỳ lương nào.
                </div>
              ) : (
                runRows.map((run) => (
                  <Link
                    key={run.id}
                    href={`/payroll/${run.id}`}
                    className="block rounded-[22px] border border-[#e7edf6] bg-[#fcfdff] px-4 py-4 transition hover:border-[#cfe2ff] hover:bg-[#f8fbff]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#14314a]">{run.periodName}</p>
                        <p className="mt-1 text-xs text-[#7b8ea5]">{run.lineCount} dòng lương</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRunTone(run.status)}`}>
                        {PAYROLL_RUN_STATUS_LABEL[run.status as keyof typeof PAYROLL_RUN_STATUS_LABEL] ?? run.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl border border-[#edf2f8] bg-white px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#90a2b5]">Tổng tiền</p>
                        <p className="mt-1 font-semibold text-[#14314a]">{formatVnd(run.totalAmount)}</p>
                      </div>
                      <div className="rounded-2xl border border-[#edf2f8] bg-white px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#90a2b5]">Khối lượng</p>
                        <p className="mt-1 font-semibold text-[#14314a]">
                          {formatNumber(run.teachingHours + run.assistantHours)} giờ · {formatNumber(run.staffDays)} công
                        </p>
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
