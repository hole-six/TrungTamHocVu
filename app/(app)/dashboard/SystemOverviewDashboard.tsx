import Link from "next/link";
import PeriodNavigator from "@/components/ui/PeriodNavigator";
import { resolvePeriod } from "@/lib/period-range";
import { listProfessionalAlerts } from "@/lib/server/professional-alerts";
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
  tuitionOutstanding: number;
  materialsOutstanding: number;
  topDebtPeriodName: string | null;
  topDebtPeriodOutstanding: number;
  dataNeedContact: number;
  dataUnhandled: number;
  unassignedStudents: number;
  openRemedialItems: number;
  availableCredits: number;
  pendingMakeups: number;
  openBillingPeriods: number;
  unpaidBookIssues: number;
  unpaidBookAmount: number;
  conversionRate: number;
  rejectRate: number;
  newEnrollments: number;
  studentsNeedCare: number;
  avgScore: number | null;
  scoredStudents: number;
};

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

async function chargeBreakdownByBranch(branchId?: string) {
  const charges = await prisma.charge.findMany({
    where: branchId ? { student: { branchId } } : undefined,
    select: {
      studentId: true,
      totalAmount: true,
      materialsAmount: true,
      billingPeriod: { select: { periodName: true } },
      allocations: {
        where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
        select: { amount: true },
      },
    },
  });

  const outstandingByStudent = new Map<string, number>();
  const periodOutstanding = new Map<string, number>();
  let total = 0;
  let tuitionOutstanding = 0;
  let materialsOutstanding = 0;
  for (const charge of charges) {
    const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
    const due = Math.max(0, charge.totalAmount - paid);
    const materialPart = Math.max(0, charge.materialsAmount);
    const tuitionPart = Math.max(0, charge.totalAmount - materialPart);
    const tuitionDue = Math.max(0, tuitionPart - paid);
    const materialDue = Math.max(0, materialPart - Math.max(0, paid - tuitionPart));
    total += due;
    tuitionOutstanding += tuitionDue;
    materialsOutstanding += materialDue;
    if (due > 0) outstandingByStudent.set(charge.studentId, (outstandingByStudent.get(charge.studentId) ?? 0) + due);
    if (due > 0) {
      const periodName = charge.billingPeriod.periodName;
      periodOutstanding.set(periodName, (periodOutstanding.get(periodName) ?? 0) + due);
    }
  }
  const topPeriod = [...periodOutstanding.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    total,
    debtorCount: outstandingByStudent.size,
    tuitionOutstanding,
    materialsOutstanding,
    topDebtPeriodName: topPeriod?.[0] ?? null,
    topDebtPeriodOutstanding: topPeriod?.[1] ?? 0,
  };
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
        unassignedStudents,
        availableCredits,
        pendingMakeups,
        openBillingPeriods,
        unpaidBookIssueAgg,
        unpaidBookIssueCount,
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
        prisma.student.count({ where: { branchId: branch.id, status: "ACTIVE", enrollments: { none: { status: "ACTIVE" } } } }),
        prisma.sessionCredit.count({ where: { status: "AVAILABLE", student: { branchId: branch.id } } }),
        prisma.makeupRequest.count({ where: { status: { in: ["PENDING", "APPROVED", "SCHEDULED"] }, student: { branchId: branch.id } } }),
        prisma.billingPeriod.count({ where: { branchId: branch.id, status: { in: ["DRAFT", "GENERATED", "REVIEWED", "POSTED", "REOPENED"] } } }),
        prisma.bookIssue.aggregate({ where: { paymentStatus: { not: "PAID" }, student: { branchId: branch.id } }, _sum: { amount: true } }),
        prisma.bookIssue.count({ where: { paymentStatus: { not: "PAID" }, student: { branchId: branch.id } } }),
        prisma.student.count({ where: { branchId: branch.id, enrollDate: { gte: range.start, lte: range.end } } }),
        chargeBreakdownByBranch(branch.id),
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
        tuitionOutstanding: debt.tuitionOutstanding,
        materialsOutstanding: debt.materialsOutstanding,
        topDebtPeriodName: debt.topDebtPeriodName,
        topDebtPeriodOutstanding: debt.topDebtPeriodOutstanding,
        dataNeedContact,
        dataUnhandled,
        unassignedStudents,
        openRemedialItems: availableCredits + pendingMakeups,
        availableCredits,
        pendingMakeups,
        openBillingPeriods,
        unpaidBookIssues: unpaidBookIssueCount,
        unpaidBookAmount: unpaidBookIssueAgg._sum.amount ?? 0,
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
  // Khoảng thời gian lấy từ thanh dùng chung của toàn hệ thống (lib/period-range.ts)
  // thay cho bản tính tuần/tháng viết riêng cho màn này.
  const range = resolvePeriod({ mode: searchParams.mode, week: searchParams.week, month: searchParams.month });
  const branchRows = await getBranchOverview(range);
  // Buổi bị đánh dấu cảnh báo chuyên môn trong khoảng đang xem — kêu cho tới khi giáo
  // viên xác nhận đã làm (xem lib/server/professional-alerts.ts).
  const professionalAlerts = await listProfessionalAlerts({ branchId: null, start: range.start, end: range.end });
  const pendingAlerts = professionalAlerts.filter((item) => !item.done);
  const totalBranches = branchRows.length;
  const totalStudents = branchRows.reduce((sum, row) => sum + row.activeStudents, 0);
  const totalClasses = branchRows.reduce((sum, row) => sum + row.activeClasses, 0);
  const totalOutstanding = branchRows.reduce((sum, row) => sum + row.outstanding, 0);
  const totalDebtors = branchRows.reduce((sum, row) => sum + row.debtorCount, 0);
  const totalTuitionOutstanding = branchRows.reduce((sum, row) => sum + row.tuitionOutstanding, 0);
  const totalMaterialsOutstanding = branchRows.reduce((sum, row) => sum + row.materialsOutstanding, 0);
  const totalDataNeedContact = branchRows.reduce((sum, row) => sum + row.dataNeedContact, 0);
  const totalUnhandled = branchRows.reduce((sum, row) => sum + row.dataUnhandled, 0);
  const totalUnassignedStudents = branchRows.reduce((sum, row) => sum + row.unassignedStudents, 0);
  const totalOpenRemedial = branchRows.reduce((sum, row) => sum + row.openRemedialItems, 0);
  const totalOpenBillingPeriods = branchRows.reduce((sum, row) => sum + row.openBillingPeriods, 0);
  const totalUnpaidBookIssues = branchRows.reduce((sum, row) => sum + row.unpaidBookIssues, 0);
  const totalUnpaidBookAmount = branchRows.reduce((sum, row) => sum + row.unpaidBookAmount, 0);
  const totalNewEnrollments = branchRows.reduce((sum, row) => sum + row.newEnrollments, 0);
  const totalNeedCare = branchRows.reduce((sum, row) => sum + row.studentsNeedCare, 0);
  const totalScoredStudents = branchRows.reduce((sum, row) => sum + row.scoredStudents, 0);
  const avgConversion = branchRows.length ? Math.round(branchRows.reduce((sum, row) => sum + row.conversionRate, 0) / branchRows.length) : 0;
  const avgReject = branchRows.length ? Math.round(branchRows.reduce((sum, row) => sum + row.rejectRate, 0) / branchRows.length) : 0;
  const systemAvgScore = avg(branchRows.map((row) => row.avgScore).filter((value): value is number => value != null));
  const systemStudentPerClass = totalClasses > 0 ? Math.round((totalStudents / totalClasses) * 10) / 10 : 0;
  const urgentBranches = [...branchRows]
    .sort((a, b) => (b.dataNeedContact + b.debtorCount + b.studentsNeedCare + b.openRemedialItems + b.unassignedStudents) - (a.dataNeedContact + a.debtorCount + a.studentsNeedCare + a.openRemedialItems + a.unassignedStudents))
    .slice(0, 3);
  const urgentBranchText = urgentBranches.length
    ? urgentBranches.map((row) => `${row.code}: ${row.dataNeedContact} data, ${row.debtorCount} nợ, ${row.openRemedialItems} bổ trợ, ${row.studentsNeedCare} chăm sóc`).join(" | ")
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
            <PeriodNavigator />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="flex min-w-max">
            <SummaryCell label="Cơ sở" value={String(totalBranches)} note="đang hoạt động" />
            <SummaryCell label="Học viên" value={String(totalStudents)} note={`${totalClasses} lớp · ${systemStudentPerClass} HS/lớp`} />
            <SummaryCell label="Công nợ" value={formatVnd(totalOutstanding)} note={`${totalDebtors} học viên nợ`} urgent={totalOutstanding > 0} />
            <SummaryCell label="Học phí nợ" value={formatVnd(totalTuitionOutstanding)} note="chưa thu phần học" urgent={totalTuitionOutstanding > 0} />
            <SummaryCell label="Sách nợ" value={formatVnd(totalMaterialsOutstanding + totalUnpaidBookAmount)} note={`${totalUnpaidBookIssues} dòng xuất sách`} urgent={totalMaterialsOutstanding + totalUnpaidBookAmount > 0} />
            <SummaryCell label="Data cần xử lý" value={String(totalDataNeedContact)} note={`${totalUnhandled} chưa tương tác`} urgent={totalDataNeedContact > 0} />
            <SummaryCell label="HV chưa lớp" value={String(totalUnassignedStudents)} note="active nhưng chưa có lớp" urgent={totalUnassignedStudents > 0} />
            <SummaryCell label="Bổ trợ mở" value={String(totalOpenRemedial)} note="credit/yêu cầu chưa xong" urgent={totalOpenRemedial > 0} />
            <SummaryCell label="Kỳ học phí mở" value={String(totalOpenBillingPeriods)} note="cần rà soát/chốt" urgent={totalOpenBillingPeriods > 0} />
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
            <InlineAction href="/session-credits" label="Xử lý bổ trợ" value={String(totalOpenRemedial)} />
            <InlineAction href="/students" label="Chăm sóc HS" value={String(totalNeedCare)} />
          </div>
        </div>
      </section>

      {/* CẢNH BÁO CHUYÊN MÔN — buổi vàng/đỏ chưa ai xác nhận đã làm. Chỉ bôi màu trên
          thời khoá biểu là chưa đủ: người phụ trách có thể không mở lịch đúng hôm đó. */}
      {pendingAlerts.length > 0 ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-rose-900">Cảnh báo chuyên môn · {range.label}</h2>
              <p className="text-sm font-medium text-rose-700">
                {pendingAlerts.length} buổi bắt buộc giáo viên phải làm việc đã ghi, chưa ai xác nhận đã làm.
              </p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-400">Quá hạn · Đỏ · Vàng</p>
          </div>
          <div className="space-y-1.5">
            {pendingAlerts.slice(0, 12).map((alert) => (
              <a
                key={alert.sessionId}
                href={`/classes/${alert.classId}/sessions/${alert.sessionId}`}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-white bg-white px-3 py-2 text-sm transition hover:border-rose-300"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    alert.overdue
                      ? "bg-rose-600 text-white"
                      : alert.level === "RED"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {alert.overdue ? "QUÁ HẠN" : alert.level === "RED" ? "ĐỎ" : "VÀNG"}
                </span>
                <span className="font-bold text-slate-900">{alert.branchName}</span>
                <span className="text-slate-400">·</span>
                <span className="font-semibold text-slate-800">{alert.className}</span>
                <span className="text-xs text-slate-500">
                  buổi {alert.sessionNumber} · {alert.sessionDate.toLocaleDateString("vi-VN", { timeZone: "UTC" })}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {alert.note?.trim() || "Cảnh báo chuyên môn — chưa ghi nội dung việc cần làm"}
                </span>
              </a>
            ))}
            {pendingAlerts.length > 12 ? (
              <p className="px-1 pt-1 text-xs font-semibold text-rose-700">… và {pendingAlerts.length - 12} buổi nữa.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Từng cơ sở</h2>
            <p className="text-sm font-medium text-slate-500">Mỗi cơ sở một dòng. Các số là việc tồn cần xử lý, không tách thành nhiều tag.</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Data · Công nợ · Bổ trợ · Sách · Chăm sóc</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1560px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50">
                {["Cơ sở", "Tổng HS", "Tổng lớp", "HS/lớp", "HV chưa lớp", "Data xử lý", "Bổ trợ mở", "Kỳ HP mở", "Tiền nợ", "Tháng nợ nhiều", "Sách chưa thu", "Nhập học", "Chuyển đổi", "Từ chối", "Cần chăm sóc", "Điểm TB"].map((header) => (
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
                  <td className="px-3 py-4">
                    <span className={`font-black ${row.unassignedStudents > 0 ? "text-orange-700" : "text-slate-800"}`}>{row.unassignedStudents}</span>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">active chưa có lớp</p>
                  </td>
                  <td className="px-3 py-4">
                    <Link href={`/leads?branchId=${row.id}`} className="font-black text-orange-700 hover:underline">{row.dataNeedContact}</Link>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">{row.dataUnhandled} chưa tương tác</p>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`font-black ${row.openRemedialItems > 0 ? "text-orange-700" : "text-slate-800"}`}>{row.openRemedialItems}</span>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">{row.availableCredits} credit · {row.pendingMakeups} yêu cầu</p>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`font-black ${row.openBillingPeriods > 0 ? "text-orange-700" : "text-slate-800"}`}>{row.openBillingPeriods}</span>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">DRAFT/POSTED/REOPENED</p>
                  </td>
                  <td className={`px-3 py-4 font-black ${debtTone(row.outstanding)}`}>
                    {formatVnd(row.outstanding)}
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">{row.debtorCount} HS · học {formatVnd(row.tuitionOutstanding)}</p>
                  </td>
                  <td className="px-3 py-4">
                    <span className="font-black text-slate-800">{row.topDebtPeriodName ?? "-"}</span>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">{row.topDebtPeriodOutstanding > 0 ? formatVnd(row.topDebtPeriodOutstanding) : "không có nợ"}</p>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`font-black ${row.materialsOutstanding + row.unpaidBookAmount > 0 ? "text-orange-700" : "text-slate-800"}`}>{formatVnd(row.materialsOutstanding + row.unpaidBookAmount)}</span>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">{row.unpaidBookIssues} dòng sách chưa PAID</p>
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
