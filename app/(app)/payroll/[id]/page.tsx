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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/payroll" className="text-sm text-primary">
          ← Quay lại Nhân sự & Lương
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kỳ lương {run.periodName}</h1>
            <p className="mt-1 text-sm text-ink-muted48">{run.lines.length} nhân viên · Tổng {formatVnd(totalPayroll)}</p>
          </div>
          <span className="badge bg-ink/5 text-ink-muted80">{PAYROLL_RUN_STATUS_LABEL[run.status] ?? run.status}</span>
        </div>
      </div>

      <PayrollRunActions runId={run.id} status={run.status} />

      {editable && eligibleEmployees.length > 0 ? (
        <AddPayrollLineForm payrollRunId={run.id} employeeOptions={eligibleEmployees} />
      ) : null}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Nhân viên</th>
              <th className="px-4 py-3 font-medium">Giờ dạy</th>
              <th className="px-4 py-3 font-medium">Tiền dạy</th>
              <th className="px-4 py-3 font-medium">Giờ TG</th>
              <th className="px-4 py-3 font-medium">Tiền TG</th>
              <th className="px-4 py-3 font-medium">Công NV</th>
              <th className="px-4 py-3 font-medium">Thưởng</th>
              <th className="px-4 py-3 font-medium">Phạt</th>
              <th className="px-4 py-3 font-medium">Tổng</th>
              <th className="px-4 py-3 font-medium"></th>
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
                  <tr key={l.id} className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/40">
                    <td className="px-4 py-3">
                      <Link href={`/payroll/employees/${l.employeeId}`} className="font-medium text-primary">
                        {l.employee.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted80">{l.teachingHours}</td>
                    <td className="px-4 py-3 text-ink-muted80">{formatVnd(l.teachingAmount)}</td>
                    <td className="px-4 py-3 text-ink-muted80">{l.assistantHours}</td>
                    <td className="px-4 py-3 text-ink-muted80">{formatVnd(l.assistantAmount)}</td>
                    <td className="px-4 py-3 text-ink-muted80">{l.staffDays}</td>
                    <td className="px-4 py-3 text-ink-muted80">{formatVnd(l.bonus)}</td>
                    <td className="px-4 py-3 text-ink-muted80">{formatVnd(l.penalty)}</td>
                    <td className="px-4 py-3 font-medium">{formatVnd(l.totalAmount)}</td>
                    <td className="px-4 py-3">{editable && <PayrollLineEditor lineId={l.id} bonus={l.bonus} penalty={l.penalty} employeeName={l.employee.fullName} />}</td>
                  </tr>
                  <tr className="border-b border-hairline last:border-0">
                    <td colSpan={10} className="bg-canvas-parchment/30 px-4 py-2">
                      <details>
                        <summary className="cursor-pointer select-none text-xs font-semibold text-primary">
                          Xem chi tiết từng buổi ({assignments.length} buổi dạy/TG · {timesheetEntries.length} ngày công)
                          {mismatch && (
                            <span className="badge-red ml-2 align-middle text-[10px]">
                              Số liệu lệch — cần &quot;Tính lại lương&quot;
                            </span>
                          )}
                        </summary>
                        <div className="mt-3 space-y-4 pb-2">
                          {teaching.length > 0 && (
                            <div>
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted48">
                                Buổi dạy (Giáo viên) — cộng lại: {liveTeachingHours} giờ
                                {!isClose(liveTeachingHours, l.teachingHours) && (
                                  <span className="text-red-600"> (dòng lương đang ghi {l.teachingHours})</span>
                                )}
                              </p>
                              <table className="w-full text-left text-xs">
                                <thead className="text-ink-muted48">
                                  <tr>
                                    <th className="py-1 font-medium">Ngày</th>
                                    <th className="py-1 font-medium">Lớp</th>
                                    <th className="py-1 font-medium">Giờ</th>
                                    <th className="py-1 font-medium">Trừ giờ</th>
                                    <th className="py-1 font-medium">Cộng giờ</th>
                                    <th className="py-1 font-medium">Tiền</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {teaching.map((a) => (
                                    <tr key={a.id} className="border-t border-hairline/60">
                                      <td className="py-1">{formatDate(a.session.sessionDate)}</td>
                                      <td className="py-1 text-ink-muted80">{a.session.class.className}</td>
                                      <td className="py-1 text-ink-muted80">{a.hours}</td>
                                      <td className="py-1 text-ink-muted80">{a.deductedHours || "—"}</td>
                                      <td className="py-1 text-ink-muted80">{a.addedHours || "—"}</td>
                                      <td className="py-1 text-ink-muted80">{formatVnd(a.amount ?? 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {assisting.length > 0 && (
                            <div>
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted48">
                                Buổi trợ giảng — cộng lại: {liveAssistantHours} giờ
                                {!isClose(liveAssistantHours, l.assistantHours) && (
                                  <span className="text-red-600"> (dòng lương đang ghi {l.assistantHours})</span>
                                )}
                              </p>
                              <table className="w-full text-left text-xs">
                                <thead className="text-ink-muted48">
                                  <tr>
                                    <th className="py-1 font-medium">Ngày</th>
                                    <th className="py-1 font-medium">Lớp</th>
                                    <th className="py-1 font-medium">Vai trò</th>
                                    <th className="py-1 font-medium">Giờ</th>
                                    <th className="py-1 font-medium">Trừ giờ</th>
                                    <th className="py-1 font-medium">Cộng giờ</th>
                                    <th className="py-1 font-medium">Tiền</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {assisting.map((a) => (
                                    <tr key={a.id} className="border-t border-hairline/60">
                                      <td className="py-1">{formatDate(a.session.sessionDate)}</td>
                                      <td className="py-1 text-ink-muted80">{a.session.class.className}</td>
                                      <td className="py-1 text-ink-muted80">{SESSION_ROLE_LABEL[a.role] ?? a.role}</td>
                                      <td className="py-1 text-ink-muted80">{a.hours}</td>
                                      <td className="py-1 text-ink-muted80">{a.deductedHours || "—"}</td>
                                      <td className="py-1 text-ink-muted80">{a.addedHours || "—"}</td>
                                      <td className="py-1 text-ink-muted80">{formatVnd(a.amount ?? 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {timesheetEntries.length > 0 && (
                            <div>
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted48">
                                Chấm công ngày — cộng lại: {liveStaffDays} công
                                {!isClose(liveStaffDays, l.staffDays) && (
                                  <span className="text-red-600"> (dòng lương đang ghi {l.staffDays})</span>
                                )}
                              </p>
                              <table className="w-full text-left text-xs">
                                <thead className="text-ink-muted48">
                                  <tr>
                                    <th className="py-1 font-medium">Ngày</th>
                                    <th className="py-1 font-medium">Giờ</th>
                                    <th className="py-1 font-medium">Công</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {timesheetEntries.map((t) => (
                                    <tr key={t.id} className="border-t border-hairline/60">
                                      <td className="py-1">{formatDate(t.workDate)}</td>
                                      <td className="py-1 text-ink-muted80">{t.hours}</td>
                                      <td className="py-1 text-ink-muted80">{t.days}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {assignments.length === 0 && timesheetEntries.length === 0 && (
                            <p className="text-xs text-ink-muted48">Không có buổi dạy/TG hay chấm công nào trong kỳ này.</p>
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
                <td colSpan={10} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa có dòng lương nào — dùng nút &quot;Tính lương&quot; phía trên.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
