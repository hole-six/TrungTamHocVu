import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatVnd } from "@/lib/export-utils";

type DashboardSearchParams = {
  mode?: string;
  week?: string;
  month?: string;
};

type BranchOverview = {
  id: string;
  code: string;
  name: string;
  activeStudents: number;
  activeClasses: number;
  studentPerClass: number;
  outstanding: number;
  debtorCount: number;
  dataNeedContact: number;
  dataUnhandled: number;
  conversionRate: number;
  rejectRate: number;
  newEnrollments: number;
  studentsNeedCare: number;
  avgScore: number | null;
  scoredStudents: number;
};

function startOfIsoWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function parseWeekKey(value: string | undefined) {
  if (!value || !/^\d{4}-W\d{2}$/.test(value)) return startOfIsoWeek(new Date());
  const [yearText, weekText] = value.split("-W");
  const year = Number(yearText);
  const week = Number(weekText);
  const jan4 = new Date(year, 0, 4);
  const start = startOfIsoWeek(jan4);
  start.setDate(start.getDate() + (week - 1) * 7);
  return start;
}

function weekKey(date: Date) {
  const start = startOfIsoWeek(date);
  const year = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 3).getFullYear();
  return `${year}-W${String(isoWeekNumber(start)).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function resolveRange(searchParams: DashboardSearchParams) {
  const mode = searchParams.mode === "month" ? "month" : "week";
  if (mode === "month") {
    const source = searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : monthKey(new Date());
    const [year, month] = source.split("-").map(Number);
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const prev = new Date(year, month - 2, 1);
    const next = new Date(year, month, 1);
    return {
      mode,
      key: source,
      start,
      end,
      label: `Tháng ${month}/${year}`,
      prevHref: `/dashboard?mode=month&month=${monthKey(prev)}`,
      nextHref: `/dashboard?mode=month&month=${monthKey(next)}`,
    };
  }

  const start = parseWeekKey(searchParams.week);
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return {
    mode,
    key: weekKey(start),
    start,
    end,
    label: `Tuần ${isoWeekNumber(start)} (${start.toLocaleDateString("vi-VN")} - ${end.toLocaleDateString("vi-VN")})`,
    prevHref: `/dashboard?mode=week&week=${weekKey(addDays(start, -7))}`,
    nextHref: `/dashboard?mode=week&week=${weekKey(addDays(start, 7))}`,
  };
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function avg(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function formatScore(value: number | null) {
  return value == null ? "-" : value.toFixed(1).replace(".0", "");
}

function toneByDebt(amount: number) {
  if (amount <= 0) return "text-emerald-700";
  if (amount >= 10_000_000) return "text-red-700";
  return "text-amber-700";
}

async function chargeOutstandingByBranch(branchId?: string) {
  const charges = await prisma.charge.findMany({
    where: branchId ? { student: { branchId } } : undefined,
    select: {
      id: true,
      studentId: true,
      totalAmount: true,
      allocations: {
        where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
        select: { amount: true },
      },
    },
  });

  const outstandingByStudent = new Map<string, number>();
  let total = 0;
  for (const charge of charges) {
    const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
    const due = Math.max(0, charge.totalAmount - paid);
    total += due;
    if (due > 0) outstandingByStudent.set(charge.studentId, (outstandingByStudent.get(charge.studentId) ?? 0) + due);
  }
  return { total, debtorCount: outstandingByStudent.size };
}

async function scoreCareByBranch(range: { start: Date; end: Date }, branchId?: string) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      student: { status: "ACTIVE", ...(branchId ? { branchId } : {}) },
      journal: { session: { sessionDate: { gte: range.start, lte: range.end } } },
      scores: { some: { score: { not: null } } },
    },
    select: {
      studentId: true,
      scores: { select: { score: true, maxScore: true } },
    },
  });

  const scoresByStudent = new Map<string, number[]>();
  for (const entry of entries) {
    const normalized = entry.scores
      .filter((score) => score.score != null)
      .map((score) => score.maxScore ? ((score.score as number) / score.maxScore) * 10 : (score.score as number));
    if (!normalized.length) continue;
    const bucket = scoresByStudent.get(entry.studentId) ?? [];
    bucket.push(...normalized);
    scoresByStudent.set(entry.studentId, bucket);
  }

  const studentAverages = [...scoresByStudent.values()].map((scores) => avg(scores)).filter((value): value is number => value != null);
  const needCare = studentAverages.filter((score) => score < 7).length;
  return {
    scoredStudents: scoresByStudent.size,
    studentsNeedCare: needCare,
    avgScore: avg(studentAverages),
  };
}

async function getBranchOverview(range: { start: Date; end: Date }): Promise<BranchOverview[]> {
  const branches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });

  return Promise.all(
    branches.map(async (branch) => {
      const [
        activeStudents,
        activeClasses,
        leadsInRange,
        convertedLeads,
        rejectedLeads,
        dataNeedContact,
        dataUnhandled,
        newEnrollments,
        debt,
        care,
      ] = await Promise.all([
        prisma.student.count({ where: { branchId: branch.id, status: "ACTIVE" } }),
        prisma.class.count({ where: { branchId: branch.id, status: "ACTIVE" } }),
        prisma.lead.count({ where: { branchId: branch.id, createdAt: { gte: range.start, lte: range.end } } }),
        prisma.lead.count({
          where: {
            branchId: branch.id,
            status: "ENROLLED",
            OR: [{ actualEnrollDate: { gte: range.start, lte: range.end } }, { student: { enrollDate: { gte: range.start, lte: range.end } } }],
          },
        }),
        prisma.lead.count({ where: { branchId: branch.id, status: "LOST", updatedAt: { gte: range.start, lte: range.end } } }),
        prisma.lead.count({ where: { branchId: branch.id, status: { notIn: ["ENROLLED", "LOST"] } } }),
        prisma.lead.count({ where: { branchId: branch.id, status: "CONTACTING", interactions: { none: {} } } }),
        prisma.student.count({ where: { branchId: branch.id, enrollDate: { gte: range.start, lte: range.end } } }),
        chargeOutstandingByBranch(branch.id),
        scoreCareByBranch(range, branch.id),
      ]);

      return {
        id: branch.id,
        code: branch.code,
        name: branch.name,
        activeStudents,
        activeClasses,
        studentPerClass: activeClasses > 0 ? Math.round((activeStudents / activeClasses) * 10) / 10 : 0,
        outstanding: debt.total,
        debtorCount: debt.debtorCount,
        dataNeedContact,
        dataUnhandled,
        conversionRate: pct(convertedLeads, Math.max(leadsInRange, convertedLeads)),
        rejectRate: pct(rejectedLeads, Math.max(leadsInRange, rejectedLeads)),
        newEnrollments,
        studentsNeedCare: care.studentsNeedCare,
        avgScore: care.avgScore,
        scoredStudents: care.scoredStudents,
      };
    }),
  );
}

function MetricCard({ label, value, note, tone = "slate" }: { label: string; value: string; note: string; tone?: "slate" | "red" | "amber" | "green" }) {
  const toneClass = {
    slate: "border-slate-200 bg-white text-slate-950",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-semibold opacity-75">{note}</p>
    </div>
  );
}

function WorkLink({ href, label, count, tone }: { href: string; label: string; count: number; tone: "red" | "amber" | "blue" }) {
  const cls = {
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
  }[tone];
  return (
    <Link href={href} className={`rounded-xl border px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-md ${cls}`}>
      <p className="text-2xl font-black">{count}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em]">{label}</p>
    </Link>
  );
}

export default async function SystemOverviewDashboard({ searchParams }: { searchParams: DashboardSearchParams }) {
  const range = resolveRange(searchParams);
  const branchRows = await getBranchOverview(range);
  const totalBranches = branchRows.length;
  const totalStudents = branchRows.reduce((sum, row) => sum + row.activeStudents, 0);
  const totalClasses = branchRows.reduce((sum, row) => sum + row.activeClasses, 0);
  const totalOutstanding = branchRows.reduce((sum, row) => sum + row.outstanding, 0);
  const totalDebtors = branchRows.reduce((sum, row) => sum + row.debtorCount, 0);
  const totalDataNeedContact = branchRows.reduce((sum, row) => sum + row.dataNeedContact, 0);
  const totalUnhandled = branchRows.reduce((sum, row) => sum + row.dataUnhandled, 0);
  const totalNewEnrollments = branchRows.reduce((sum, row) => sum + row.newEnrollments, 0);
  const totalNeedCare = branchRows.reduce((sum, row) => sum + row.studentsNeedCare, 0);
  const totalScoredStudents = branchRows.reduce((sum, row) => sum + row.scoredStudents, 0);
  const avgConversion = branchRows.length ? Math.round(branchRows.reduce((sum, row) => sum + row.conversionRate, 0) / branchRows.length) : 0;
  const avgReject = branchRows.length ? Math.round(branchRows.reduce((sum, row) => sum + row.rejectRate, 0) / branchRows.length) : 0;
  const systemAvgScore = avg(branchRows.map((row) => row.avgScore).filter((value): value is number => value != null));
  const systemStudentPerClass = totalClasses > 0 ? Math.round((totalStudents / totalClasses) * 10) / 10 : 0;
  const urgentBranches = [...branchRows].sort((a, b) => (b.dataNeedContact + b.debtorCount + b.studentsNeedCare) - (a.dataNeedContact + a.debtorCount + a.studentsNeedCare)).slice(0, 3);

  return (
    <div className="space-y-5 pb-16">
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Tổng quan toàn hệ thống</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Bảng điều hành hôm nay</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
              Không tách theo cơ sở đang chọn. Đây là báo cáo chung để nhìn ngay cơ sở nào cần xử lý data, học phí và học viên cần chăm sóc.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={range.prevHref} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:border-slate-950">Trước</Link>
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-black text-orange-700">{range.label}</div>
            <Link href={range.nextHref} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:border-slate-950">Sau</Link>
            <Link href={`/dashboard?mode=week&week=${weekKey(new Date())}`} className={`rounded-xl border px-3 py-2 text-sm font-black ${range.mode === "week" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"}`}>Tuần này</Link>
            <Link href={`/dashboard?mode=month&month=${monthKey(new Date())}`} className={`rounded-xl border px-3 py-2 text-sm font-black ${range.mode === "month" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"}`}>Tháng này</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Cơ sở" value={String(totalBranches)} note="đang hoạt động" />
        <MetricCard label="Học viên" value={String(totalStudents)} note={`${totalClasses} lớp · ${systemStudentPerClass} HS/lớp`} tone="green" />
        <MetricCard label="Công nợ" value={formatVnd(totalOutstanding)} note={`${totalDebtors} học viên còn nợ`} tone={totalOutstanding > 0 ? "red" : "green"} />
        <MetricCard label="Data cần xử lý" value={String(totalDataNeedContact)} note={`${totalUnhandled} hồ sơ chưa có tương tác`} tone={totalDataNeedContact > 0 ? "amber" : "green"} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Nhập học mới" value={String(totalNewEnrollments)} note={`trong ${range.mode === "week" ? "tuần" : "tháng"} đang xem`} />
        <MetricCard label="Tỉ lệ nhập học" value={`${avgConversion}%`} note={`từ data trong kỳ · từ chối ${avgReject}%`} tone="green" />
        <MetricCard label="Cần chăm sóc" value={String(totalNeedCare)} note={`${totalScoredStudents} học viên có điểm · TB ${formatScore(systemAvgScore)}`} tone={totalNeedCare > 0 ? "amber" : "green"} />
        <MetricCard label="Mật độ lớp" value={`${systemStudentPerClass}`} note="học viên/lớp toàn hệ thống" />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <WorkLink href="/leads" label="Data cần liên hệ" count={totalDataNeedContact} tone="amber" />
        <WorkLink href="/tuition" label="Học viên nợ học phí" count={totalDebtors} tone="red" />
        <WorkLink href="/students" label="Học viên cần chăm sóc" count={totalNeedCare} tone="blue" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Từng cơ sở</h2>
            <p className="text-sm font-medium text-slate-500">Bố cục theo mẫu họp: mỗi cơ sở một dòng, các chỉ số quan trọng đưa lên trước.</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Ưu tiên: Data · Công nợ · Chăm sóc</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50">
                {["Cơ sở", "Tổng HS", "Tổng lớp", "HS/lớp", "Tiền nợ", "Data", "Nhập học", "Chuyển đổi", "Từ chối", "Cần chăm sóc", "Điểm TB"].map((header) => (
                  <th key={header} className="px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branchRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50/80">
                  <td className="px-3 py-4">
                    <p className="font-black text-slate-950">{row.code}</p>
                    <p className="mt-0.5 max-w-[160px] truncate text-xs font-semibold text-slate-500">{row.name}</p>
                  </td>
                  <td className="px-3 py-4 text-lg font-black text-slate-950">{row.activeStudents}</td>
                  <td className="px-3 py-4 text-lg font-black text-slate-950">{row.activeClasses}</td>
                  <td className="px-3 py-4 font-black text-slate-800">{row.studentPerClass}</td>
                  <td className={`px-3 py-4 font-black ${toneByDebt(row.outstanding)}`}>
                    {formatVnd(row.outstanding)}
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">{row.debtorCount} HS nợ</p>
                  </td>
                  <td className="px-3 py-4">
                    <Link href={`/leads?branchId=${row.id}`} className="font-black text-orange-700 hover:underline">{row.dataNeedContact}</Link>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">{row.dataUnhandled} chưa tương tác</p>
                  </td>
                  <td className="px-3 py-4 text-lg font-black text-emerald-700">{row.newEnrollments}</td>
                  <td className="px-3 py-4 font-black text-emerald-700">{row.conversionRate}%</td>
                  <td className="px-3 py-4 font-black text-red-700">{row.rejectRate}%</td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${row.studentsNeedCare > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {row.studentsNeedCare} HS
                    </span>
                    <p className="mt-1 text-xs font-semibold text-slate-400">{row.scoredStudents} HS có điểm</p>
                  </td>
                  <td className="px-3 py-4 font-black text-slate-800">{formatScore(row.avgScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-black text-slate-950">Cơ sở cần ưu tiên</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {urgentBranches.map((row) => (
              <div key={row.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-950">{row.code} · {row.name}</p>
                <p className="mt-2 text-xs font-bold text-amber-800">Data cần xử lý: {row.dataNeedContact}</p>
                <p className="mt-1 text-xs font-bold text-amber-800">HS nợ học phí: {row.debtorCount}</p>
                <p className="mt-1 text-xs font-bold text-amber-800">HS cần chăm sóc: {row.studentsNeedCare}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Ghi chú đọc số</h2>
          <div className="mt-3 space-y-2 text-sm font-medium leading-6 text-slate-600">
            <p>Data cần xử lý là các hồ sơ chưa nhập học/chưa đóng nhu cầu.</p>
            <p>Học viên cần chăm sóc là học viên có điểm trung bình trong kỳ dưới 7.</p>
            <p>Lương nhân viên đã được đưa khỏi báo cáo chính theo yêu cầu họp.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
