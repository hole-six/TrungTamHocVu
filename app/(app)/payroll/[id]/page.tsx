import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PAYROLL_RUN_STATUS_LABEL, canEditPayroll, SESSION_ROLE_LABEL } from "@/lib/server/payroll-rules";
import { monthRange } from "@/lib/server/tuition-rules";
import PayrollRunActions from "@/components/payroll/PayrollRunActions";
import PayrollLineEditor from "@/components/payroll/PayrollLineEditor";
import AddPayrollLineForm from "@/components/payroll/AddPayrollLineForm";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}
// So sánh 2 số có lệch không, chấp nhận sai số làm tròn dấu phẩy động nhỏ
// (vd tổng nhiều số 0.333... cộng lại) — không dùng so sánh tuyệt đối bằng nhau.
function isClose(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

export default async function PayrollRunDetailPage({ params }: { params: { id: string } }) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: { lines: { include: { employee: true }, orderBy: { employee: { fullName: "asc" } } } },
  });
  if (!run) notFound();

  const editable = canEditPayroll(run.status);
  const totalPayroll = run.lines.reduce((s, l) => s + l.totalAmount, 0);

  const eligibleEmployees = editable
    ? await prisma.employee.findMany({
        where: {
          branchId: run.branchId,
          resignDate: null,
          id: { notIn: run.lines.map((l) => l.employeeId) },
        },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      })
    : [];

  // Đối chiếu từng dòng lương với dữ liệu gốc (SessionAssignment/TimesheetEntry) —
  // dùng CHÍNH XÁC cùng khoảng ngày và điều kiện lọc như lúc "Tính lương" ở
  // app/api/payroll-runs/[id]/generate/route.ts, để số hiển thị ở đây luôn khớp
  // với cách PayrollLine đã được tính ra, không lệch logic giữa 2 nơi.
  const { start, end } = monthRange(run.periodName);
  const employeeIds = run.lines.map((l) => l.employeeId);
  const [allAssignments, allTimesheetEntries] = await Promise.all([
    prisma.sessionAssignment.findMany({
      where: { employeeId: { in: employeeIds }, session: { sessionDate: { gte: start, lte: end }, status: "COMPLETED" } },
      include: { session: { include: { class: true } } },
      orderBy: { session: { sessionDate: "asc" } },
    }),
    prisma.timesheetEntry.findMany({
      where: { employeeId: { in: employeeIds }, workDate: { gte: start, lte: end } },
      orderBy: { workDate: "asc" },
    }),
  ]);

  // Tính tổng các chỉ số
  const totalTeachingHours = run.lines.reduce((s, l) => s + l.teachingHours, 0);
  const totalAssistantHours = run.lines.reduce((s, l) => s + l.assistantHours, 0);
  const totalStaffDays = run.lines.reduce((s, l) => s + l.staffDays, 0);
  const totalBonus = run.lines.reduce((s, l) => s + l.bonus, 0);
  const totalPenalty = run.lines.reduce((s, l) => s + l.penalty, 0);
  const hasMismatch = run.lines.some((l) => {
    const assignments = allAssignments.filter((a) => a.employeeId === l.employeeId);
    const teaching = assignments.filter((a) => a.role === "TEACHER");
    const assisting = assignments.filter((a) => a.role === "ASSISTANT" || a.role === "ASSISTANT2");
    const timesheetEntries = allTimesheetEntries.filter((t) => t.employeeId === l.employeeId);
    const liveTeachingHours = teaching.reduce((s, a) => s + (a.hours ?? 0), 0);
    const liveAssistantHours = assisting.reduce((s, a) => s + (a.hours ?? 0), 0);
    const liveStaffDays = timesheetEntries.reduce((s, t) => s + (t.days ?? 0), 0);
    return (
      !isClose(liveTeachingHours, l.teachingHours) ||
      !isClose(liveAssistantHours, l.assistantHours) ||
      !isClose(liveStaffDays, l.staffDays)
    );
  });

  return (
    <div className="min-h-screen space-y-6 pb-20">
      {/* Breadcrumb + Hero Header */}
      <div>
        <Link href="/payroll" className="inline-flex items-center gap-2 text-sm font-medium text-[#6b7280] transition-colors hover:text-[#f97316]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại Payroll
        </Link>
        
        <div className="mt-4 overflow-hidden rounded-[32px] border-2 border-[#fed7aa] bg-gradient-to-r from-[#fff7ed] via-[#ffedd5] to-[#fed7aa] px-6 py-8 shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#ea580c] bg-[#ea580c] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-white">
                Kỳ lương
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                {run.periodName}
              </h1>
              <p className="mt-2 text-sm font-medium text-[#78716c]">
                {run.lines.length} nhân viên · Tổng {formatVnd(totalPayroll)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-lg border-2 px-5 py-2.5 text-sm font-bold ${
                  run.status === "FINALIZED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : run.status === "DRAFT"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                {PAYROLL_RUN_STATUS_LABEL[run.status] ?? run.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Warning if mismatch */}
      {hasMismatch && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-900">⚠️ Phát hiện số liệu lệch</h3>
              <p className="mt-2 text-sm font-medium text-amber-800">
                Một số dòng lương có số giờ/công khác với dữ liệu thực tế. Cần bấm "Tính lại lương" để cập nhật.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <PayrollRunActions runId={run.id} status={run.status} />

      {editable && eligibleEmployees.length > 0 ? (
        <AddPayrollLineForm payrollRunId={run.id} employeeOptions={eligibleEmployees} />
      ) : null}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Nhân viên</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-black text-[#111827]">{run.lines.length}</p>
        </div>

        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Giờ giảng dạy</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black text-[#111827]">{(totalTeachingHours + totalAssistantHours).toFixed(1)}</p>
          <p className="mt-0.5 text-xs text-[#6b7280]">Dạy + TG</p>
        </div>

        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Công HC</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-black text-[#111827]">{totalStaffDays}</p>
        </div>

        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Thưởng/Phạt</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-emerald-600">{formatVnd(totalBonus)}</span>
            <span className="text-lg font-bold text-[#9ca3af]">/</span>
            <span className="text-xl font-black text-red-600">{formatVnd(totalPenalty)}</span>
          </div>
        </div>

        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Tổng lương</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-black text-[#f97316]">{formatVnd(totalPayroll)}</p>
        </div>
      </div>

      {/* Table chi tiết */}
      <div className="overflow-hidden rounded-2xl border-2 border-[#e5e7eb] bg-white shadow-lg">
        <div className="border-b-2 border-[#f3f4f6] bg-gradient-to-r from-[#fafafa] to-white px-6 py-5">
          <h2 className="text-xl font-bold text-[#111827]">Chi tiết lương từng nhân viên</h2>
          <p className="mt-1 text-sm font-medium text-[#6b7280]">Bấm vào từng dòng để xem breakdown chi tiết buổi dạy/TG và chấm công</p>
        </div>

        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full min-w-[1200px]">
            <thead className="border-b-2 border-[#f3f4f6] bg-gradient-to-r from-[#fafafa] to-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6b7280]">Nhân viên</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">Giờ dạy</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">Tiền dạy</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">Giờ TG</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">Tiền TG</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">Công</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">Thưởng</th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">Phạt</th>
                <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-wider text-[#6b7280]">Tổng</th>
                {editable && <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-[#6b7280]">Sửa</th>}
              </tr>
            </thead>
            <tbody>
              {run.lines.map((l) => {
                const assignments = allAssignments.filter((a) => a.employeeId === l.employeeId);
                const teaching = assignments.filter((a) => a.role === "TEACHER");
                const assisting = assignments.filter((a) => a.role === "ASSISTANT" || a.role === "ASSISTANT2");
                const timesheetEntries = allTimesheetEntries.filter((t) => t.employeeId === l.employeeId);

                const liveTeachingHours = teaching.reduce((s, a) => s + (a.hours ?? 0), 0);
                const liveAssistantHours = assisting.reduce((s, a) => s + (a.hours ?? 0), 0);
                const liveStaffDays = timesheetEntries.reduce((s, t) => s + (t.days ?? 0), 0);
                const mismatch =
                  !isClose(liveTeachingHours, l.teachingHours) ||
                  !isClose(liveAssistantHours, l.assistantHours) ||
                  !isClose(liveStaffDays, l.staffDays);

                return (
                  <>
                    <tr key={l.id} className={`border-b border-[#f3f4f6] transition-colors ${mismatch ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-[#fafafa]'}`}>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-sm font-black text-white shadow-md">
                            {l.employee.fullName.charAt(0)}
                          </div>
                          <Link href={`/payroll/employees/${l.employeeId}`} className="font-bold text-[#111827] hover:text-[#f97316] transition-colors">
                            {l.employee.fullName}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <p className="text-base font-bold text-[#111827]">{l.teachingHours}</p>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <p className="text-sm font-semibold text-[#6b7280]">{formatVnd(l.teachingAmount)}</p>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <p className="text-base font-bold text-[#111827]">{l.assistantHours}</p>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <p className="text-sm font-semibold text-[#6b7280]">{formatVnd(l.assistantAmount)}</p>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <p className="text-base font-bold text-[#111827]">{l.staffDays}</p>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <p className="text-sm font-bold text-emerald-600">{formatVnd(l.bonus)}</p>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <p className="text-sm font-bold text-red-600">{formatVnd(l.penalty)}</p>
                      </td>
                      <td className="px-4 py-5 text-right">
                        <p className="text-xl font-black text-[#f97316]">{formatVnd(l.totalAmount)}</p>
                      </td>
                      {editable && (
                        <td className="px-6 py-5 text-right">
                          <PayrollLineEditor lineId={l.id} bonus={l.bonus} penalty={l.penalty} employeeName={l.employee.fullName} />
                        </td>
                      )}
                    </tr>
                    <tr className="border-b-2 border-[#f3f4f6]">
                      <td colSpan={editable ? 10 : 9} className="bg-[#fafafa] px-6 py-4">
                        <details className="group/details">
                          <summary className="flex cursor-pointer items-center gap-3 text-sm font-bold text-[#6b7280] transition-colors hover:text-[#f97316]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-open/details:rotate-90">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <span>
                              Xem chi tiết breakdown ({assignments.length} buổi dạy/TG · {timesheetEntries.length} ngày công)
                            </span>
                            {mismatch && (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-lg border-2 border-red-300 bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                Số liệu lệch — cần tính lại
                              </span>
                            )}
                          </summary>
                          <div className="mt-4 space-y-4 pb-2">
                            {teaching.length > 0 && (
                              <div className="rounded-xl border-2 border-[#e5e7eb] bg-white p-4">
                                <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#6b7280]">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                  </span>
                                  Buổi dạy (Giáo viên) — Cộng lại: {liveTeachingHours} giờ
                                  {!isClose(liveTeachingHours, l.teachingHours) && (
                                    <span className="text-red-600"> (dòng lương ghi {l.teachingHours})</span>
                                  )}
                                </p>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="border-b border-[#f3f4f6] bg-[#fafafa]">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-bold text-[#6b7280]">Ngày</th>
                                        <th className="px-3 py-2 text-left font-bold text-[#6b7280]">Lớp</th>
                                        <th className="px-3 py-2 text-center font-bold text-[#6b7280]">Giờ</th>
                                        <th className="px-3 py-2 text-center font-bold text-[#6b7280]">Trừ</th>
                                        <th className="px-3 py-2 text-center font-bold text-[#6b7280]">Cộng</th>
                                        <th className="px-3 py-2 text-right font-bold text-[#6b7280]">Tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#f3f4f6]">
                                      {teaching.map((a) => (
                                        <tr key={a.id} className="hover:bg-[#fafafa]">
                                          <td className="px-3 py-2 font-medium text-[#111827]">{formatDate(a.session.sessionDate)}</td>
                                          <td className="px-3 py-2 text-[#6b7280]">{a.session.class.className}</td>
                                          <td className="px-3 py-2 text-center font-semibold text-[#111827]">{a.hours}</td>
                                          <td className="px-3 py-2 text-center text-red-600">{a.deductedHours || "—"}</td>
                                          <td className="px-3 py-2 text-center text-emerald-600">{a.addedHours || "—"}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-[#6b7280]">{formatVnd(a.amount ?? 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {assisting.length > 0 && (
                              <div className="rounded-xl border-2 border-[#e5e7eb] bg-white p-4">
                                <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#6b7280]">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                      <circle cx="9" cy="7" r="4" />
                                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                  </span>
                                  Buổi trợ giảng — Cộng lại: {liveAssistantHours} giờ
                                  {!isClose(liveAssistantHours, l.assistantHours) && (
                                    <span className="text-red-600"> (dòng lương ghi {l.assistantHours})</span>
                                  )}
                                </p>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="border-b border-[#f3f4f6] bg-[#fafafa]">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-bold text-[#6b7280]">Ngày</th>
                                        <th className="px-3 py-2 text-left font-bold text-[#6b7280]">Lớp</th>
                                        <th className="px-3 py-2 text-center font-bold text-[#6b7280]">Vai trò</th>
                                        <th className="px-3 py-2 text-center font-bold text-[#6b7280]">Giờ</th>
                                        <th className="px-3 py-2 text-center font-bold text-[#6b7280]">Trừ</th>
                                        <th className="px-3 py-2 text-center font-bold text-[#6b7280]">Cộng</th>
                                        <th className="px-3 py-2 text-right font-bold text-[#6b7280]">Tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#f3f4f6]">
                                      {assisting.map((a) => (
                                        <tr key={a.id} className="hover:bg-[#fafafa]">
                                          <td className="px-3 py-2 font-medium text-[#111827]">{formatDate(a.session.sessionDate)}</td>
                                          <td className="px-3 py-2 text-[#6b7280]">{a.session.class.className}</td>
                                          <td className="px-3 py-2 text-center text-[#6b7280]">{SESSION_ROLE_LABEL[a.role] ?? a.role}</td>
                                          <td className="px-3 py-2 text-center font-semibold text-[#111827]">{a.hours}</td>
                                          <td className="px-3 py-2 text-center text-red-600">{a.deductedHours || "—"}</td>
                                          <td className="px-3 py-2 text-center text-emerald-600">{a.addedHours || "—"}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-[#6b7280]">{formatVnd(a.amount ?? 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {timesheetEntries.length > 0 && (
                              <div className="rounded-xl border-2 border-[#e5e7eb] bg-white p-4">
                                <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#6b7280]">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                      <line x1="16" y1="2" x2="16" y2="6" />
                                      <line x1="8" y1="2" x2="8" y2="6" />
                                      <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                  </span>
                                  Chấm công ngày — Cộng lại: {liveStaffDays} công
                                  {!isClose(liveStaffDays, l.staffDays) && (
                                    <span className="text-red-600"> (dòng lương ghi {l.staffDays})</span>
                                  )}
                                </p>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="border-b border-[#f3f4f6] bg-[#fafafa]">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-bold text-[#6b7280]">Ngày</th>
                                        <th className="px-3 py-2 text-center font-bold text-[#6b7280]">Giờ</th>
                                        <th className="px-3 py-2 text-right font-bold text-[#6b7280]">Công</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#f3f4f6]">
                                      {timesheetEntries.map((t) => (
                                        <tr key={t.id} className="hover:bg-[#fafafa]">
                                          <td className="px-3 py-2 font-medium text-[#111827]">{formatDate(t.workDate)}</td>
                                          <td className="px-3 py-2 text-center text-[#6b7280]">{t.hours}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-[#111827]">{t.days}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {assignments.length === 0 && timesheetEntries.length === 0 && (
                              <div className="rounded-xl border-2 border-[#e5e7eb] bg-[#fafafa] px-6 py-8 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3f4f6]">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                                      <circle cx="12" cy="12" r="10" />
                                      <line x1="12" y1="8" x2="12" y2="12" />
                                      <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                  </div>
                                  <p className="text-sm font-semibold text-[#6b7280]">
                                    Không có buổi dạy/TG hay chấm công nào trong kỳ này.
                                  </p>
                                </div>
                              </div>
                            )}
                        </div>
                      </details>
                    </td>
                  </tr>
                </>
              );
            })}
            {run.lines.length === 0 && (
              <tr>
                <td colSpan={editable ? 10 : 9} className="px-6 py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f3f4f6]">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-[#6b7280]">
                      Chưa có dòng lương nào — dùng nút "Tính lương" phía trên.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
