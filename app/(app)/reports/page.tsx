import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeOutstandingBalance } from "@/lib/server/balance";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

async function getReportData(branchId: string | null) {
  const branchWhere = branchId ? { branchId } : {};
  const currentMonth = new Date().getMonth() + 1;

  const [
    studentActive,
    studentLeft,
    byLeadStatus,
    recentPeriods,
    topDebtStudents,
    bookIssueSum,
    topBooks,
    payrollRuns,
    cashByType,
    birthdayStudents,
    latestPeriodWithCharges,
    latestPayrollRun,
  ] = await Promise.all([
    prisma.student.count({ where: { ...branchWhere, status: "ACTIVE" } }),
    prisma.student.count({ where: { ...branchWhere, status: "LEFT" } }),
    prisma.lead.groupBy({ by: ["status"], where: branchWhere, _count: { _all: true } }),
    prisma.billingPeriod.findMany({
      where: branchWhere,
      orderBy: { periodName: "desc" },
      take: 6,
      include: { charges: { include: { allocations: true } } },
    }),
    prisma.student.findMany({ where: { ...branchWhere, status: "ACTIVE" }, select: { id: true, fullName: true, studentCode: true } }),
    prisma.bookIssue.aggregate({ _sum: { amount: true } }),
    prisma.book.findMany({
      where: branchWhere,
      include: { bookIssues: { select: { amount: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.payrollRun.findMany({
      where: branchWhere,
      orderBy: { periodName: "desc" },
      take: 6,
      include: { lines: { select: { totalAmount: true } } },
    }),
    prisma.cashTransaction.groupBy({ by: ["type"], where: { ...branchWhere, status: { not: "VOIDED" } }, _sum: { amount: true } }),
    // Sinh nhật tháng này — nguồn SinhNhatHV (pivot đếm HV theo tháng sinh, không lưu trùng vì dob đã có sẵn)
    prisma.student.findMany({
      where: { ...branchWhere, status: "ACTIVE" },
      select: { id: true, fullName: true, dob: true, studentCode: true },
    }),
    // Học phí theo lớp của kỳ gần nhất — nguồn Report_HP "TỔNG HỢP HỌC PHÍ"
    prisma.billingPeriod.findFirst({
      where: branchWhere,
      orderBy: { periodName: "desc" },
      include: { charges: { include: { class: true, allocations: true } } },
    }),
    // Giờ công GV/TG kỳ lương gần nhất — nguồn Report_Cong_Luong
    prisma.payrollRun.findFirst({
      where: branchWhere,
      orderBy: { periodName: "desc" },
      include: { lines: { include: { employee: true } } },
    }),
  ]);

  const birthdayThisMonth = birthdayStudents
    .filter((s) => s.dob && new Date(s.dob).getMonth() + 1 === currentMonth)
    .sort((a, b) => new Date(a.dob!).getDate() - new Date(b.dob!).getDate());

  const tuitionByClass = latestPeriodWithCharges
    ? Object.values(
        latestPeriodWithCharges.charges.reduce(
          (acc, c) => {
            const key = c.classId;
            if (!acc[key]) {
              acc[key] = { className: c.class.className, sessionCount: 0, tuitionTotal: 0, materialsTotal: 0, billed: 0, collected: 0 };
            }
            acc[key].sessionCount += c.sessionCount;
            acc[key].tuitionTotal += c.tuitionAmount;
            acc[key].materialsTotal += c.materialsAmount;
            acc[key].billed += c.totalAmount;
            acc[key].collected += c.allocations.reduce((s, a) => s + a.amount, 0);
            return acc;
          },
          {} as Record<string, { className: string; sessionCount: number; tuitionTotal: number; materialsTotal: number; billed: number; collected: number }>
        )
      )
    : [];

  const payrollBreakdown = latestPayrollRun
    ? {
        periodName: latestPayrollRun.periodName,
        teachers: latestPayrollRun.lines
          .filter((l) => l.teachingHours > 0)
          .map((l) => ({ name: l.employee.fullName, hours: l.teachingHours, amount: l.teachingAmount }))
          .sort((a, b) => b.amount - a.amount),
        assistants: latestPayrollRun.lines
          .filter((l) => l.assistantHours > 0)
          .map((l) => ({ name: l.employee.fullName, hours: l.assistantHours, amount: l.assistantAmount }))
          .sort((a, b) => b.amount - a.amount),
      }
    : null;

  const leadPipeline = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const row of byLeadStatus) leadPipeline[row.status] = row._count._all;
  const totalLeads = Object.values(leadPipeline).reduce((a, b) => a + b, 0);
  const enrolledLeads = leadPipeline["ENROLLED"] ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((enrolledLeads / totalLeads) * 100) : 0;

  const revenueByPeriod = recentPeriods
    .map((p) => ({
      period: p.periodName,
      billed: p.charges.reduce((s, c) => s + c.totalAmount, 0),
      collected: p.charges.reduce((s, c) => s + c.allocations.reduce((sa, a) => sa + a.amount, 0), 0),
    }))
    .reverse();

  const debtBalances = await Promise.all(
    topDebtStudents.map(async (s) => ({ ...s, outstanding: await computeOutstandingBalance(s.id) }))
  );
  const debtors = debtBalances
    .filter((s) => s.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 10);

  const bookRanking = topBooks
    .map((b) => ({ name: b.name, total: b.bookIssues.reduce((s, i) => s + i.amount, 0) }))
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const payrollByPeriod = payrollRuns
    .map((r) => ({ period: r.periodName, total: r.lines.reduce((s, l) => s + l.totalAmount, 0) }))
    .reverse();

  const totalThu = cashByType.find((c) => c.type === "THU")?._sum.amount ?? 0;
  const totalChi = cashByType.find((c) => c.type === "CHI")?._sum.amount ?? 0;

  return {
    studentActive,
    studentLeft,
    leadPipeline,
    totalLeads,
    conversionRate,
    revenueByPeriod,
    debtors,
    materialsTotal: bookIssueSum._sum.amount ?? 0,
    bookRanking,
    payrollByPeriod,
    totalThu,
    totalChi,
    birthdayThisMonth,
    tuitionByClass,
    payrollBreakdown,
  };
}

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const data = await getReportData(user?.branchId ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Báo cáo</h1>
        <p className="mt-1 text-sm text-ink-muted48">Tổng hợp số liệu từ tất cả module — thay cho việc dò nhiều sheet Excel.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">Học viên & tuyển sinh</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-ink-muted48">Đang học</p>
              <p className="font-display text-xl font-semibold">{data.studentActive}</p>
            </div>
            <div>
              <p className="text-ink-muted48">Đã nghỉ</p>
              <p className="font-display text-xl font-semibold">{data.studentLeft}</p>
            </div>
            <div>
              <p className="text-ink-muted48">Tổng lead</p>
              <p className="font-display text-xl font-semibold">{data.totalLeads}</p>
            </div>
            <div>
              <p className="text-ink-muted48">Tỉ lệ chuyển đổi</p>
              <p className="font-display text-xl font-semibold">{data.conversionRate}%</p>
            </div>
          </div>
          <div className="mt-4 space-y-1">
            {LEAD_STATUSES.map((s) => (
              <div key={s} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted80">{LEAD_STATUS_LABEL[s]}</span>
                <span className="font-medium">{data.leadPipeline[s]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">Doanh thu học phí theo kỳ</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
              <tr>
                <th className="py-2 font-medium">Kỳ</th>
                <th className="py-2 font-medium">Phải thu</th>
                <th className="py-2 font-medium">Đã thu</th>
              </tr>
            </thead>
            <tbody>
              {data.revenueByPeriod.map((r) => (
                <tr key={r.period} className="border-b border-hairline last:border-0">
                  <td className="py-2">
                    <Link href={`/tuition`} className="text-primary">
                      {r.period}
                    </Link>
                  </td>
                  <td className="py-2 text-ink-muted80">{formatVnd(r.billed)}</td>
                  <td className="py-2 font-medium">{formatVnd(r.collected)}</td>
                </tr>
              ))}
              {data.revenueByPeriod.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-ink-muted48">
                    Chưa có kỳ thu nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">Tuổi nợ — công nợ cao nhất</h2>
          <div className="mt-3 space-y-2">
            {data.debtors.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <Link href={`/students/${d.id}`} className="text-primary">
                  {d.fullName} <span className="text-ink-muted48">({d.studentCode})</span>
                </Link>
                <span className="font-medium text-red-600">{formatVnd(d.outstanding)}</span>
              </div>
            ))}
            {data.debtors.length === 0 && <p className="text-sm text-ink-muted48">Không có học viên nợ học phí.</p>}
          </div>
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">Giáo trình</h2>
          <p className="mt-1 text-sm text-ink-muted48">Tổng giá trị đã xuất: <strong>{formatVnd(data.materialsTotal)}</strong></p>
          <div className="mt-3 space-y-2">
            {data.bookRanking.map((b) => (
              <div key={b.name} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted80">{b.name}</span>
                <span className="font-medium">{formatVnd(b.total)}</span>
              </div>
            ))}
            {data.bookRanking.length === 0 && <p className="text-sm text-ink-muted48">Chưa xuất giáo trình nào.</p>}
          </div>
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">Công & lương theo kỳ</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
              <tr>
                <th className="py-2 font-medium">Kỳ</th>
                <th className="py-2 font-medium">Tổng lương</th>
              </tr>
            </thead>
            <tbody>
              {data.payrollByPeriod.map((p) => (
                <tr key={p.period} className="border-b border-hairline last:border-0">
                  <td className="py-2">
                    <Link href="/payroll" className="text-primary">
                      {p.period}
                    </Link>
                  </td>
                  <td className="py-2 font-medium">{formatVnd(p.total)}</td>
                </tr>
              ))}
              {data.payrollByPeriod.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-ink-muted48">
                    Chưa có kỳ lương nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">Sinh nhật học viên tháng này</h2>
          <div className="mt-3 space-y-2">
            {data.birthdayThisMonth.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <Link href={`/students/${s.id}`} className="text-primary">
                  {s.fullName} <span className="text-ink-muted48">({s.studentCode})</span>
                </Link>
                <span className="text-ink-muted48">{new Date(s.dob!).getDate()}/{new Date(s.dob!).getMonth() + 1}</span>
              </div>
            ))}
            {data.birthdayThisMonth.length === 0 && (
              <p className="text-sm text-ink-muted48">Không có học viên nào sinh nhật tháng này.</p>
            )}
          </div>
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-display text-lg font-semibold tracking-tight">Học phí theo lớp (kỳ gần nhất)</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
              <tr>
                <th className="py-2 font-medium">Lớp</th>
                <th className="py-2 font-medium">Buổi</th>
                <th className="py-2 font-medium">Học phí</th>
                <th className="py-2 font-medium">Giáo trình</th>
                <th className="py-2 font-medium">Phải thu</th>
                <th className="py-2 font-medium">Đã thu</th>
              </tr>
            </thead>
            <tbody>
              {data.tuitionByClass.map((c) => (
                <tr key={c.className} className="border-b border-hairline last:border-0">
                  <td className="py-2 font-medium">{c.className}</td>
                  <td className="py-2 text-ink-muted80">{c.sessionCount}</td>
                  <td className="py-2 text-ink-muted80">{formatVnd(c.tuitionTotal)}</td>
                  <td className="py-2 text-ink-muted80">{formatVnd(c.materialsTotal)}</td>
                  <td className="py-2 text-ink-muted80">{formatVnd(c.billed)}</td>
                  <td className="py-2 font-medium">{formatVnd(c.collected)}</td>
                </tr>
              ))}
              {data.tuitionByClass.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-muted48">
                    Chưa có kỳ thu học phí nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data.payrollBreakdown && (
          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Công GV/TG — kỳ {data.payrollBreakdown.periodName}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted48">Giáo viên</p>
                <div className="mt-2 space-y-1.5">
                  {data.payrollBreakdown.teachers.map((t) => (
                    <div key={t.name} className="flex items-center justify-between text-sm">
                      <span>{t.name}</span>
                      <span className="text-ink-muted48">{t.hours}h · {formatVnd(t.amount)}</span>
                    </div>
                  ))}
                  {data.payrollBreakdown.teachers.length === 0 && <p className="text-sm text-ink-muted48">Chưa có dữ liệu.</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted48">Trợ giảng</p>
                <div className="mt-2 space-y-1.5">
                  {data.payrollBreakdown.assistants.map((t) => (
                    <div key={t.name} className="flex items-center justify-between text-sm">
                      <span>{t.name}</span>
                      <span className="text-ink-muted48">{t.hours}h · {formatVnd(t.amount)}</span>
                    </div>
                  ))}
                  {data.payrollBreakdown.assistants.length === 0 && <p className="text-sm text-ink-muted48">Chưa có dữ liệu.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">Dòng tiền (thu chi ngoài học phí)</h2>
          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-ink-muted48">Tổng thu</p>
              <p className="font-display text-xl font-semibold text-primary">{formatVnd(data.totalThu)}</p>
            </div>
            <div>
              <p className="text-ink-muted48">Tổng chi</p>
              <p className="font-display text-xl font-semibold">{formatVnd(data.totalChi)}</p>
            </div>
            <div>
              <p className="text-ink-muted48">Số dư</p>
              <p className="font-display text-xl font-semibold">{formatVnd(data.totalThu - data.totalChi)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
