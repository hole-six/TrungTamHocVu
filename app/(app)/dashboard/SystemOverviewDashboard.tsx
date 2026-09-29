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

function debtTone(amount: number) {
  if (amount <= 0) return "text-slate-700";
  if (amount >= 10_000_000) return "text-red-700";
  return "text-orange-700";
}

async function chargeOutstandingByBranch(branchId?: string) {
  const charges = await prisma.charge.findMany({
    where: branchId ? { student: { branchId } } : undefined,
    select: {
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
  return {
    scoredStudents: scoresByStudent.size,
    studentsNeedCare: studentAverages.filter((score) => score < 7).length,
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
            OR: [
              { actualEnrollDate: { gte: range.start, lte: range.end } },
              { student: { enrollDate: { gte: range.start, lte: range.end } } },
            ],
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

function SummaryCell({ label, value, note, urgent = false }: { label: string; value: string; note: string; urgent?: boolean }) {
  return (
    <div className={`min-w-[150px] border-r border-slate-200 px-4 py-3 last:border-r-0 ${urgent ? "bg-orange-50/70" : "bg-white"}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black tracking-tight ${urgent ? "text-orange-700" : "text-slate-950"}`}>{value}</p>
      <p className="mt-0.5 whitespace-nowrap text-xs font-semibold text-slate-500">{note}</p>
    </div>
  );
}

function InlineAction({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:border-slate-950">
      <span>{label}</span>
      <span className="text-orange-700">{value}</span>
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
  const urgentBranches = [...branchRows]
    .sort((a, b) => (b.dataNeedContact + b.debtorCount + b.studentsNeedCare) - (a.dataNeedContact + a.debtorCount + a.studentsNeedCare))
    .slice(0, 3);
  const urgentBranchText = urgentBranches.length
    ? urgentBranches.map((row) => `${row.code}: ${row.dataNeedContact} data, ${row.debtorCount} nợ, ${row.studentsNeedCare} chăm sóc`).join(" | ")
    : "Không có cơ sở cần ưu tiên.";

  return (
    <div className="space-y-4 pb-16">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Tổng quan toàn hệ thống</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Bảng điều hành</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Một màn hình để thấy ngay cơ sở nào cần xử lý data, công nợ và học viên cần chăm sóc.</p>
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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="flex min-w-max">
            <SummaryCell label="Cơ sở" value={String(totalBranches)} note="đang hoạt động" />
            <SummaryCell label="Học viên" value={String(totalStudents)} note={`${totalClasses} lớp · ${systemStudentPerClass} HS/lớp`} />
            <SummaryCell label="Công nợ" value={formatVnd(totalOutstanding)} note={`${totalDebtors} học viên nợ`} urgent={totalOutstanding > 0} />
            <SummaryCell label="Data cần xử lý" value={String(totalDataNeedContact)} note={`${totalUnhandled} chưa tương tác`} urgent={totalDataNeedContact > 0} />
            <SummaryCell label="Nhập học mới" value={String(totalNewEnrollments)} note={range.mode === "week" ? "trong tuần" : "trong tháng"} />
            <SummaryCell label="Tỉ lệ nhập học" value={`${avgConversion}%`} note={`từ chối ${avgReject}%`} />
            <SummaryCell label="Cần chăm sóc" value={String(totalNeedCare)} note={`${totalScoredStudents} có điểm · TB ${formatScore(systemAvgScore)}`} urgent={totalNeedCare > 0} />
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 lg:flex-row lg:items-center lg:justify-between">
          <p className="min-w-0 truncate">Ưu tiên: {urgentBranchText}</p>
          <div className="flex flex-wrap gap-2">
            <InlineAction href="/leads" label="Xử lý data" value={String(totalDataNeedContact)} />
            <InlineAction href="/tuition" label="Thu nợ" value={String(totalDebtors)} />
            <InlineAction href="/students" label="Chăm sóc HS" value={String(totalNeedCare)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Từng cơ sở</h2>
            <p className="text-sm font-medium text-slate-500">Mỗi cơ sở một dòng. Chỉ giữ số cần đọc nhanh, không tách thành nhiều tag.</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Data · Công nợ · Chăm sóc</p>
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
                  <td className={`px-3 py-4 font-black ${debtTone(row.outstanding)}`}>
                    {formatVnd(row.outstanding)}
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">{row.debtorCount} HS nợ</p>
                  </td>
                  <td className="px-3 py-4">
                    <Link href={`/leads?branchId=${row.id}`} className="font-black text-orange-700 hover:underline">{row.dataNeedContact}</Link>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">{row.dataUnhandled} chưa tương tác</p>
                  </td>
                  <td className="px-3 py-4 text-lg font-black text-slate-950">{row.newEnrollments}</td>
                  <td className="px-3 py-4 font-black text-slate-800">{row.conversionRate}%</td>
                  <td className="px-3 py-4 font-black text-slate-800">{row.rejectRate}%</td>
                  <td className="px-3 py-4">
                    <span className={`font-black ${row.studentsNeedCare > 0 ? "text-orange-700" : "text-slate-800"}`}>{row.studentsNeedCare} HS</span>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">{row.scoredStudents} HS có điểm</p>
                  </td>
                  <td className="px-3 py-4 font-black text-slate-800">{formatScore(row.avgScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
