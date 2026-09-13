import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole, getAllowedHrTabs } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { formatVnd } from "@/lib/export-utils";
import { SESSION_ROLE_LABEL } from "@/lib/server/payroll-rules";
import HrTabs from "@/components/hr/HrTabs";
import DayPicker from "@/components/hr/DayPicker";

// SỔ NGÀY — dựng lại đúng thứ mà file Excel quản lý thật đang dùng (sheet ChiTietLopHoc):
// MỘT ngày, nhìn một màn là thấy hết:
//   - các buổi học diễn ra hôm đó, ai dạy / ai trợ giảng, giờ công và tiền của TỪNG người
//   - nhân sự hành chính hôm đó vào/ra lúc mấy giờ, được mấy giờ, quy ra mấy công
//
// Vì sao cần: trong Excel hai thứ này nằm CÙNG MỘT DÒNG theo ngày, nên người quản lý mở
// sổ ra là thấy toàn cảnh. Trong hệ thống chúng bị tách ra 2 màn khác nhau (/timesheets
// chỉ có nhân sự hành chính theo tháng, buổi dạy nằm trong từng lớp) — đúng về mặt cấu
// trúc dữ liệu, nhưng mất mất cái nhìn "hôm nay ở trung tâm diễn ra những gì".
//
// Trang này KHÔNG tạo dữ liệu mới: chỉ đọc và gom lại, mọi thao tác sửa vẫn đi qua đúng
// màn gốc (điểm danh ở buổi học, chấm công ở tab Chấm công) để không có 2 đường ghi.
function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function TimesheetDayPage({ searchParams }: { searchParams?: { date?: string } }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("timesheet", role)) notFound();

  const branchId = await getCurrentBranchId();
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.date ?? "") ? searchParams!.date! : ymd(new Date());
  const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateKey}T23:59:59.999Z`);

  const [sessions, entries, monthlyStaff] = await Promise.all([
    prisma.classSession.findMany({
      where: {
        sessionDate: { gte: dayStart, lte: dayEnd },
        ...(branchId ? { class: { branchId } } : {}),
      },
      include: {
        class: { select: { id: true, classCode: true, className: true } },
        assignments: { include: { employee: { select: { fullName: true, shortName: true, payMode: true } } }, orderBy: { role: "asc" } },
        attendances: { select: { status: true } },
      },
      orderBy: [{ startTime: "asc" }],
    }),
    prisma.timesheetEntry.findMany({
      where: { workDate: { gte: dayStart, lte: dayEnd }, ...(branchId ? { employee: { branchId } } : {}) },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true, position: true, staffDailyRate: true } } },
      orderBy: { employee: { fullName: "asc" } },
    }),
    prisma.employee.findMany({
      where: { workStatus: "ACTIVE", payMode: "MONTHLY", ...(branchId ? { branchId } : {}) },
      select: { id: true, fullName: true, employeeCode: true, position: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const hrTabs = user ? await getAllowedHrTabs(user.id) : [];
  const entryByEmployee = new Map(entries.map((entry) => [entry.employee.id, entry]));
  const missingStaff = monthlyStaff.filter((employee) => !entryByEmployee.has(employee.id));

  const teachingMoney = sessions.reduce(
    (sum, session) => sum + session.assignments.reduce((s, a) => s + (a.amount ?? 0), 0),
    0,
  );
  const staffHours = entries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
  const staffMoney = entries.reduce((sum, entry) => sum + Math.round((entry.days ?? 0) * (entry.employee.staffDailyRate ?? 0)), 0);
  const cancelled = sessions.filter((session) => session.status === "CANCELLED").length;

  const shift = (days: number) => {
    const d = new Date(dayStart);
    d.setUTCDate(d.getUTCDate() + days);
    return ymd(d);
  };

  return (
    <div className="space-y-4">
      <HrTabs allowed={hrTabs} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-[#0f1729] sm:text-2xl">Sổ ngày</h1>
          <p className="mt-0.5 text-sm text-[#64748b]">
            Toàn cảnh một ngày: lớp nào chạy, ai dạy, ai trợ giảng, ai đi làm — và tiền công của từng người.
          </p>
        </div>
        <DayPicker date={dateKey} prevDate={shift(-1)} nextDate={shift(1)} todayDate={ymd(new Date())} />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Buổi học</p>
          <p className="mt-1 text-2xl font-black text-[#0f1729]">{sessions.length}</p>
          {cancelled > 0 ? <p className="text-xs font-semibold text-slate-500">{cancelled} buổi nghỉ</p> : null}
        </div>
        <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Tiền dạy / trợ giảng</p>
          <p className="mt-1 text-2xl font-black text-[#0f1729]">{formatVnd(teachingMoney)}</p>
        </div>
        <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Giờ công hành chính</p>
          <p className="mt-1 text-2xl font-black text-[#0f1729]">{Math.round(staffHours * 100) / 100}</p>
          <p className="text-xs text-[#64748b]">≈ {Math.round((staffHours / 8) * 100) / 100} công · {formatVnd(staffMoney)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${missingStaff.length > 0 ? "border-amber-300 bg-amber-50" : "border-[#e5eaf7] bg-white"}`}>
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Chưa chấm công</p>
          <p className={`mt-1 text-2xl font-black ${missingStaff.length > 0 ? "text-amber-700" : "text-[#0f1729]"}`}>{missingStaff.length}</p>
          <p className="text-xs text-[#64748b]">trên {monthlyStaff.length} nhân sự hưởng lương tháng</p>
        </div>
      </div>

      {/* ---- Buổi học trong ngày ---- */}
      <section className="rounded-2xl border border-[#e5eaf7] bg-white">
        <div className="border-b border-[#f1f5f9] px-4 py-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-[#0f1729]">Buổi học &amp; người đứng lớp</h2>
        </div>
        {sessions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#64748b]">Không có buổi học nào trong ngày này.</p>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {sessions.map((session) => {
              const isOff = session.status === "CANCELLED";
              const present = session.attendances.filter((a) => a.status === "PRESENT").length;
              const absent = session.attendances.filter((a) => a.status === "ABSENT").length;
              return (
                <div key={session.id} className={`px-4 py-3 ${isOff ? "bg-slate-50 opacity-70" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/classes/${session.class.id}/sessions/${session.id}`} className="font-bold text-[#2563eb] hover:underline">
                          {session.class.className}
                        </Link>
                        <span className="rounded border border-[#e5eaf7] bg-[#f8faff] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#475569]">
                          {session.class.classCode}
                        </span>
                        <span className="text-xs font-semibold text-[#64748b]">
                          {session.startTime ?? "—"} – {session.endTime ?? "—"}
                        </span>
                        {isOff ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">Buổi nghỉ</span>
                        ) : session.status === "COMPLETED" ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                            Đã điểm danh · {present} có mặt{absent > 0 ? ` · ${absent} vắng` : ""}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Chưa điểm danh</span>
                        )}
                      </div>
                      {session.assignments.length === 0 ? (
                        // Bấm được sang thẳng màn buổi học để phân công — cảnh báo mà
                        // không đi tiếp được thì nhân sự vẫn phải tự mò lại đúng buổi đó.
                        <Link
                          href={`/classes/${session.class.id}/sessions/${session.id}`}
                          className="mt-1.5 inline-block rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs font-bold text-[#0f1729] underline-offset-2 hover:underline"
                        >
                          Chưa phân công giáo viên/trợ giảng — buổi này không sinh tiền công cho ai. Bấm để phân công →
                        </Link>
                      ) : (
                        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#334155]">
                          {session.assignments.map((assignment) => (
                            <li key={assignment.id}>
                              <span className="font-semibold">{SESSION_ROLE_LABEL[assignment.role] ?? assignment.role}:</span>{" "}
                              {assignment.employee.shortName || assignment.employee.fullName}
                              {" · "}
                              {assignment.employee.payMode === "SESSION" ? "1 ca" : `${assignment.hours ?? 0}h`}
                              {assignment.deductedHours > 0 ? <span className="text-rose-600"> (−{assignment.deductedHours}h)</span> : null}
                              {assignment.addedHours > 0 ? <span className="text-emerald-700"> (+{assignment.addedHours}h)</span> : null}
                              {" · "}
                              <span className="font-bold text-[#0f1729]">{formatVnd(assignment.amount ?? 0)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Chấm công hành chính trong ngày ---- */}
      <section className="rounded-2xl border border-[#e5eaf7] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f5f9] px-4 py-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-[#0f1729]">Chấm công hành chính</h2>
          <Link href="/timesheets" className="text-xs font-bold text-[#2563eb] hover:underline">
            Sửa chấm công theo tháng →
          </Link>
        </div>
        {entries.length === 0 && missingStaff.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#64748b]">Không có nhân sự hưởng lương tháng nào ở cơ sở này.</p>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="text-sm font-bold text-[#0f1729]">{entry.employee.fullName}</p>
                  <p className="text-xs text-[#64748b]">
                    {entry.employee.position ?? "—"} · Sáng {entry.checkInAm || "—"}–{entry.checkOutAm || "—"} · Chiều{" "}
                    {entry.checkInPm || "—"}–{entry.checkOutPm || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#0f1729]">
                    {entry.hours ?? 0}h · {entry.days ?? 0} công
                  </p>
                  <p className="text-xs text-[#64748b]">
                    {entry.employee.staffDailyRate
                      ? formatVnd(Math.round((entry.days ?? 0) * entry.employee.staffDailyRate))
                      : "Chưa có đơn giá ngày công"}
                  </p>
                </div>
              </div>
            ))}
            {missingStaff.map((employee) => (
              <div key={employee.id} className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/60 px-4 py-2.5">
                <div>
                  <p className="text-sm font-bold text-[#0f1729]">{employee.fullName}</p>
                  <p className="text-xs text-[#64748b]">{employee.position ?? "—"}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Chưa chấm công ngày này</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
