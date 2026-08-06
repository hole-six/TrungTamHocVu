import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { getAppShellConfig, type AppQuickAction } from "@/lib/app-shell";
import { getReportsDashboardData } from "@/lib/server/reporting";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";
import { getCurrentBranchId } from "@/lib/branch-filter";
import QuickActions from "@/components/dashboard/QuickActions";

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
function formatVnd(n: number) { return n.toLocaleString("vi-VN") + "đ"; }
function formatDate(d: Date | string | null) { return d ? new Date(d).toLocaleDateString("vi-VN") : "—"; }

async function getStats(user: Awaited<ReturnType<typeof getCurrentUser>>, activeBranchId: string | null) {
  const bw = activeBranchId ? { branchId: activeBranchId } : {};
  const today = new Date();
  const ts = startOfDay(today); const te = endOfDay(today);
  const [activeStudents, totalStudents, activeClasses, openLeads, unpaidCharges, paid,
    branchSessionsToday, mySessionsToday, openBillingPeriods, openPayrollRuns, myOpenTasks] =
    await Promise.all([
      prisma.student.count({ where: { ...bw, status: "ACTIVE" } }),
      prisma.student.count({ where: bw }),
      prisma.class.count({ where: { ...bw, status: "ACTIVE" } }),
      prisma.lead.count({ where: { ...bw, status: { notIn: ["ENROLLED", "LOST"] } } }),
      prisma.charge.aggregate({ where: activeBranchId ? { student: { branchId: activeBranchId } } : {}, _sum: { totalAmount: true } }),
      prisma.paymentAllocation.aggregate({ where: activeBranchId ? { charge: { student: { branchId: activeBranchId } } } : {}, _sum: { amount: true } }),
      prisma.classSession.count({ where: activeBranchId ? { class: { branchId: activeBranchId }, sessionDate: { gte: ts, lte: te } } : { sessionDate: { gte: ts, lte: te } } }),
      user?.employeeId ? prisma.sessionAssignment.count({ where: { employeeId: user.employeeId, session: { sessionDate: { gte: ts, lte: te } } } }) : Promise.resolve(0),
      prisma.billingPeriod.count({ where: { ...bw, status: { in: ["DRAFT", "GENERATED", "REVIEWED", "POSTED", "REOPENED"] } } }),
      prisma.payrollRun.count({ where: { ...bw, status: { in: ["DRAFT", "CALCULATED", "REVIEWED", "APPROVED"] } } }),
      user?.id ? prisma.task.count({ where: { assignedToId: user.id, status: "OPEN" } }) : Promise.resolve(0),
    ]);
  return { activeStudents, totalStudents, activeClasses, openLeads,
    outstanding: (unpaidCharges._sum.totalAmount ?? 0) - (paid._sum.amount ?? 0),
    branchSessionsToday, mySessionsToday, openBillingPeriods, openPayrollRuns, myOpenTasks };
}

async function getBranchBreakdown() {
  const branches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
  const today = new Date(); const ts = startOfDay(today); const te = endOfDay(today);
  return Promise.all(branches.map(async (b) => {
    const [activeStudents, activeClasses, sessionsToday, openLeads, cs, ps, openBillingPeriods, openPayrollRuns] =
      await Promise.all([
        prisma.student.count({ where: { branchId: b.id, status: "ACTIVE" } }),
        prisma.class.count({ where: { branchId: b.id, status: "ACTIVE" } }),
        prisma.classSession.count({ where: { class: { branchId: b.id }, sessionDate: { gte: ts, lte: te } } }),
        prisma.lead.count({ where: { branchId: b.id, status: { notIn: ["ENROLLED", "LOST"] } } }),
        prisma.charge.aggregate({ where: { student: { branchId: b.id } }, _sum: { totalAmount: true } }),
        prisma.paymentAllocation.aggregate({ where: { charge: { student: { branchId: b.id } } }, _sum: { amount: true } }),
        prisma.billingPeriod.count({ where: { branchId: b.id, status: { in: ["DRAFT", "GENERATED", "REVIEWED", "POSTED", "REOPENED"] } } }),
        prisma.payrollRun.count({ where: { branchId: b.id, status: { in: ["DRAFT", "CALCULATED", "REVIEWED", "APPROVED"] } } }),
      ]);
    return { id: b.id, code: b.code, name: b.name, activeStudents, activeClasses, sessionsToday, openLeads,
      outstanding: (cs._sum.totalAmount ?? 0) - (ps._sum.amount ?? 0), openBillingPeriods, openPayrollRuns };
  }));
}

async function getLeadPipeline(activeBranchId: string | null) {
  const bw = activeBranchId ? { branchId: activeBranchId } : {};
  const rows = await prisma.lead.groupBy({ by: ["status"], where: bw, _count: { _all: true } });
  const m = new Map(rows.map((r) => [r.status, r._count._all]));
  return LEAD_STATUSES.map((s) => ({ status: s, label: LEAD_STATUS_LABEL[s], count: m.get(s) ?? 0 }));
}

async function getTestOverview(activeBranchId: string | null) {
  const bw = activeBranchId ? { branchId: activeBranchId } : {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const soon = new Date(today); soon.setDate(soon.getDate() + 3); soon.setHours(23, 59, 59, 999);
  const [missingTest, overdue, soonCount] = await Promise.all([
    prisma.lead.count({ where: { ...bw, status: { notIn: ["ENROLLED", "LOST"] }, placementTests: { none: {} } } }),
    prisma.placementTest.count({ where: { status: "SCHEDULED", scheduledDate: { lt: today }, lead: bw } }),
    prisma.placementTest.count({ where: { status: "SCHEDULED", scheduledDate: { gte: today, lte: soon }, lead: bw } }),
  ]);
  return { missingTest, overdue, soon: soonCount };
}

// ─── UI components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, href }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  color: string; href: string;
}) {
  return (
    <Link href={href} className="group rounded-xl border border-[#e5eaf7] bg-white p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all block sm:rounded-2xl sm:p-5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5eaf7] bg-white shadow-md mb-3 sm:h-12 sm:w-12 sm:rounded-xl sm:mb-4`}>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b] mb-1 sm:text-xs">{label}</p>
      <p className="text-xl font-black text-[#0f1729] mb-0.5 sm:text-2xl sm:mb-1">{value}</p>
      <p className="text-[10px] font-semibold text-[#64748b] sm:text-xs">{sub}</p>
    </Link>
  );
}

function AlertBadge({ count, label, color, href }: { count: number; label: string; color: "red" | "amber" | "slate"; href: string }) {
  const cls = { red: "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]", amber: "bg-[#fef9c3] border-[#fde047] text-[#854d0e]", slate: "bg-[#f8faff] border-[#e5eaf7] text-[#475569]" }[color];
  return (
    <Link href={href} className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center hover:opacity-80 transition ${cls}`}>
      <span className="text-3xl font-black">{count}</span>
      <span className="mt-1 text-xs font-bold">{label}</span>
    </Link>
  );
}

const PIPELINE_COLORS: Record<string, string> = {
  NEW: "#f97316", CONTACTING: "#ea580c", APPOINTED: "#c2410c",
  TESTED: "#fdba74", QUALIFIED: "#f59e0b", UNQUALIFIED: "#94a3b8",
  ENROLLED: "#10b981", LOST: "#ef4444",
};

function PipelineFunnel({ rows }: { rows: { status: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const activeRows = rows.filter((r) => !["LOST"].includes(r.status));
  return (
    <div className="space-y-2">
      {activeRows.map((row) => (
        <Link key={row.status} href={`/leads?status=${row.status}`}
          className="group flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#f8faff] transition">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIPELINE_COLORS[row.status] ?? "#94a3b8" }} />
          <span className="w-36 shrink-0 text-xs font-semibold text-[#475569] truncate">{row.label}</span>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
            <div className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{ width: `${Math.max(row.count > 0 ? 4 : 0, (row.count / max) * 100)}%`, backgroundColor: PIPELINE_COLORS[row.status] ?? "#94a3b8" }} />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-black text-[#0f1729] tabular-nums">{row.count}</span>
        </Link>
      ))}
    </div>
  );
}

function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <h2 className="text-lg font-black tracking-tight text-[#0f1729]">{children}</h2>
      {action}
    </div>
  );
}

function ActionIcon({ icon }: { icon: AppQuickAction["icon"] }) {
  const icons: Record<string, React.ReactNode> = {
    plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    money: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    clipboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>,
    graduation: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
    report: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  };
  return <>{icons[icon] ?? icons.report}</>;
}

function enrichQuickActions(actions: AppQuickAction[], role: string | null, stats: Awaited<ReturnType<typeof getStats>>, operational: Awaited<ReturnType<typeof getReportsDashboardData>> | null) {
  return actions.map((a) => {
    if (a.href === "/leads") return { ...a, badge: stats.openLeads > 0 ? stats.openLeads : undefined };
    if (a.href === "/students") return { ...a, badge: operational?.studentsWithoutPortal ? operational.studentsWithoutPortal : undefined };
    if (a.href === "/tuition") return { ...a, badge: operational?.debtors.length ? operational.debtors.length : undefined };
    if (a.href === "/classes" && stats.branchSessionsToday > 0) return { ...a, badge: stats.branchSessionsToday };
    if (a.href === "/calendar" && stats.mySessionsToday > 0) return { ...a, badge: stats.mySessionsToday };
    return a;
  });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();
  const shell = getAppShellConfig(role);
  const stats = await getStats(user, activeBranchId);
  const showCrm = role !== "TEACHER" && role !== "TEACHING_ASSISTANT";

  const [operational, leadPipeline, testOverview] = await Promise.all([
    showCrm ? getReportsDashboardData(activeBranchId) : Promise.resolve(null),
    showCrm ? getLeadPipeline(activeBranchId) : Promise.resolve(null),
    showCrm ? getTestOverview(activeBranchId) : Promise.resolve(null),
  ]);
  const branchBreakdown = role === "DIRECTOR" ? await getBranchBreakdown() : null;
  const sessionsValue = (role === "TEACHER" || role === "TEACHING_ASSISTANT") ? stats.mySessionsToday : stats.branchSessionsToday;
  const quickActions = enrichQuickActions(shell.quickActions, role, stats, operational);
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Chào buổi sáng" : now.getHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const dateLabel = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="space-y-6 pb-16">

      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#fed7aa] bg-gradient-to-br from-[#fff7ed] via-[#ffedd5] to-[#fed7aa] p-5 shadow-lg sm:rounded-3xl sm:p-6 md:p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSIjZjk3MzE2IiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9Ii4xIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#c2410c] sm:text-sm truncate">{greeting} · {dateLabel}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#7c2d12] sm:text-3xl md:text-4xl">{shell.dashboardTitle}</h1>
            <p className="mt-2 text-sm font-medium text-[#9a3412] leading-relaxed sm:mt-3 sm:text-base sm:max-w-xl">{shell.dashboardSubtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link href="/reports" className="inline-flex items-center gap-1.5 rounded-lg bg-white border-2 border-[#f97316] px-3 py-2 text-xs font-bold text-[#f97316] hover:bg-[#f97316] hover:text-white shadow-md hover:shadow-xl transition-all sm:rounded-xl sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm md:px-5 md:py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:h-[18px] sm:w-[18px]"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <span className="hidden sm:inline">Báo cáo</span>
              <span className="sm:hidden">BC</span>
            </Link>
            {showCrm && (
              <Link href="/leads" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#f97316] to-[#ea580c] border-2 border-[#ea580c] px-3 py-2 text-xs font-bold text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all sm:rounded-xl sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm md:px-5 md:py-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:h-[18px] sm:w-[18px]"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                CRM
                {stats.openLeads > 0 && <span className="rounded-full bg-white/20 backdrop-blur px-1.5 py-0.5 text-[9px] font-black sm:text-[10px] sm:px-2">{stats.openLeads}</span>}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── 5 KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Học viên đang học" value={String(stats.activeStudents)} sub={`/ ${stats.totalStudents} tổng`}
          color="#f97316" href="/students"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>} />
        <KpiCard label="Lớp hoạt động" value={String(stats.activeClasses)} sub={`${sessionsValue} buổi hôm nay`}
          color="#10b981" href="/classes"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>} />
        <KpiCard label="Công nợ học phí" value={formatVnd(stats.outstanding)} sub={`${operational?.debtors.length ?? 0} học viên nợ`}
          color="#f59e0b" href="/tuition"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
        <KpiCard label="Lead đang xử lý" value={String(stats.openLeads)} sub="chưa chuyển đổi / đóng"
          color="#ea580c" href="/leads"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
        <KpiCard label="Kỳ lương đang mở" value={String(stats.openPayrollRuns)} sub={`${stats.openBillingPeriods} kỳ học phí mở`}
          color="#ef4444" href="/payroll"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>} />
      </div>

      {/* ── Revenue + Pipeline (2 cols) ──────────────────────────── */}
      {operational && leadPipeline && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* Revenue last 6 periods */}
          <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
            <SectionHeading action={<Link href="/tuition" className="text-sm font-bold text-[#f97316] hover:text-[#ea580c]">Mở học phí →</Link>}>
              Doanh thu theo kỳ
            </SectionHeading>
            <div className="space-y-2.5">
              {operational.revenueByPeriod.slice(-6).map((row) => {
                const pct = row.billed > 0 ? Math.round((row.collected / row.billed) * 100) : 0;
                return (
                  <div key={row.period} className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#0f1729]">{row.period}</span>
                      <span className={`text-xs font-bold ${pct >= 90 ? "text-[#10b981]" : pct >= 60 ? "text-[#f59e0b]" : "text-[#ef4444]"}`}>{pct}% đã thu</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#e5eaf7]">
                      <div className={`h-full rounded-full ${pct >= 90 ? "bg-[#10b981]" : pct >= 60 ? "bg-[#f59e0b]" : "bg-[#ef4444]"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-[#64748b]">Phải thu {formatVnd(row.billed)}</span>
                      <span className="text-xs font-semibold text-[#0f1729]">Đã thu {formatVnd(row.collected)}</span>
                    </div>
                  </div>
                );
              })}
              {operational.revenueByPeriod.length === 0 && <p className="text-sm text-[#94a3b8] bg-[#f8faff] rounded-xl p-4 border border-[#e5eaf7]">Chưa có kỳ học phí nào.</p>}
            </div>
          </div>

          {/* Lead pipeline funnel */}
          <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
            <SectionHeading action={<Link href="/leads" className="text-sm font-bold text-[#f97316] hover:text-[#ea580c]">Mở CRM →</Link>}>
              Phễu tuyển sinh
            </SectionHeading>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-gradient-to-br from-[#fff7ed] to-[#ffedd5] border border-[#fed7aa] p-3 text-center">
                <p className="text-2xl font-black text-[#c2410c]">{operational.totalLeads}</p>
                <p className="text-xs font-bold text-[#f97316]">Tổng lead</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] border border-[#a7f3d0] p-3 text-center">
                <p className="text-2xl font-black text-[#065f46]">{operational.conversionRate}%</p>
                <p className="text-xs font-bold text-[#10b981]">Tỉ lệ chuyển đổi</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#fef9c3] to-[#fef3c7] border border-[#fde047] p-3 text-center">
                <p className="text-2xl font-black text-[#92400e]">{operational.qualifiedLeadsWithoutClass}</p>
                <p className="text-xs font-bold text-[#b45309]">Đạt, chờ lớp</p>
              </div>
            </div>
            <PipelineFunnel rows={leadPipeline} />
          </div>
        </div>
      )}

      {/* ── Test overview + Operational alerts + Cash flow ───────── */}
      {operational && testOverview && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* Test schedule alerts */}
          <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
            <SectionHeading action={<Link href="/leads" className="text-sm font-bold text-[#f97316]">Xem →</Link>}>
              Lịch test đầu vào
            </SectionHeading>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <AlertBadge count={testOverview.overdue} label="Quá hạn" color="red" href="/leads?urgent=overdue" />
              <AlertBadge count={testOverview.soon} label="Sắp tới" color="amber" href="/leads?urgent=soon" />
              <AlertBadge count={testOverview.missingTest} label="Chưa hẹn" color="slate" href="/leads?testStatus=NONE" />
            </div>
            <div className="rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#065f46]">Đang có học bổng</span>
              <span className="text-lg font-black text-[#065f46]">{operational.portalCoverageCount}</span>
            </div>
          </div>

          {/* Operational warnings */}
          <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
            <SectionHeading>Cảnh báo vận hành</SectionHeading>
            <div className="space-y-3">
              {[
                { label: "HV đã có portal PH", value: operational.portalCoverageCount, color: "text-[#065f46]", bg: "bg-[#ecfdf5] border-[#a7f3d0]" },
                { label: "HV chưa có portal PH", value: operational.studentsWithoutPortal, color: "text-[#854d0e]", bg: "bg-[#fef9c3] border-[#fde047]" },
                { label: "Convert chưa có portal", value: operational.convertedStudentsWithoutPortal, color: "text-[#b91c1c]", bg: "bg-[#fef2f2] border-[#fecaca]" },
                { label: "Đạt nhưng chưa có lớp", value: operational.qualifiedLeadsWithoutClass, color: "text-[#c2410c]", bg: "bg-[#fff7ed] border-[#fed7aa]" },
              ].map((item) => (
                <div key={item.label} className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${item.bg}`}>
                  <span className="text-xs font-semibold text-[#475569]">{item.label}</span>
                  <span className={`text-xl font-black ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cash flow */}
          <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
            <SectionHeading action={<Link href="/cashbook" className="text-sm font-bold text-[#f97316]">Thu chi →</Link>}>
              Dòng tiền
            </SectionHeading>
            <div className="space-y-3">
              <div className="rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#065f46] mb-1">Tổng thu</p>
                <p className="text-2xl font-black text-[#065f46]">{formatVnd(operational.totalThu)}</p>
              </div>
              <div className="rounded-xl bg-[#fef2f2] border border-[#fecaca] px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#b91c1c] mb-1">Tổng chi</p>
                <p className="text-2xl font-black text-[#b91c1c]">{formatVnd(operational.totalChi)}</p>
              </div>
              <div className={`rounded-xl border px-4 py-4 ${operational.totalThu - operational.totalChi >= 0 ? "bg-[#fff7ed] border-[#fed7aa]" : "bg-[#fef9c3] border-[#fde047]"}`}>
                <p className="text-xs font-bold uppercase tracking-wide text-[#c2410c] mb-1">Số dư</p>
                <p className={`text-2xl font-black ${operational.totalThu - operational.totalChi >= 0 ? "text-[#c2410c]" : "text-[#b45309]"}`}>
                  {formatVnd(operational.totalThu - operational.totalChi)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Top debtors ──────────────────────────────────────────── */}
      {operational && operational.debtors.length > 0 && (
        <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
          <SectionHeading action={<Link href="/tuition" className="text-sm font-bold text-[#f97316]">Mở học phí →</Link>}>
            Top công nợ cần xử lý
          </SectionHeading>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8faff]">
                <tr>
                  {["Học viên", "Lớp", "Phụ huynh", "Portal", "Còn nợ"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#64748b] first:rounded-l-xl last:rounded-r-xl">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {operational.debtors.slice(0, 8).map((s) => (
                  <tr key={s.id} className="border-b border-[#f0f4f8] last:border-0 hover:bg-[#f8faff] transition">
                    <td className="px-4 py-3">
                      <Link href={`/students/${s.id}`} className="font-bold text-[#f97316] hover:text-[#ea580c]">{s.fullName}</Link>
                      <p className="text-xs text-[#64748b]">{s.studentCode} {s.leadCode ? `· Lead ${s.leadCode}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#475569]">{s.className ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-[#475569]">{s.guardianName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-bold ${s.guardianPortalActive ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fef9c3] text-[#854d0e]"}`}>
                        {s.guardianPortalActive ? "Hoạt động" : "Chưa có"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-[#ef4444]">{formatVnd(s.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {operational.debtors.slice(0, 8).map((s) => (
              <div key={s.id} className="rounded-xl border border-[#e5eaf7] bg-white p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/students/${s.id}`} className="block font-bold text-[#f97316] hover:text-[#ea580c] truncate">
                      {s.fullName}
                    </Link>
                    <p className="mt-0.5 text-xs text-[#64748b]">{s.studentCode} {s.leadCode ? `· Lead ${s.leadCode}` : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-[#ef4444]">{formatVnd(s.outstanding)}</p>
                    <p className="text-[10px] text-[#64748b]">Còn nợ</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-[#f0f4f8] pt-3 text-xs">
                  <div>
                    <span className="text-[#94a3b8]">Lớp:</span>
                    <span className="ml-1 font-medium text-[#475569]">{s.className ?? "—"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#94a3b8]">PH:</span>
                    <span className="ml-1 font-medium text-[#475569]">{s.guardianName ?? "—"}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[#f0f4f8] pt-2">
                  <span className="text-xs text-[#94a3b8]">Portal:</span>
                  <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-bold ${s.guardianPortalActive ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fef9c3] text-[#854d0e]"}`}>
                    {s.guardianPortalActive ? "Hoạt động" : "Chưa có"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Branch breakdown (DIRECTOR only) ─────────────────────── */}
      {branchBreakdown && (
        <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
          <SectionHeading>Tình hình theo từng cơ sở</SectionHeading>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8faff]">
                <tr>
                  {["Cơ sở", "HV đang học", "Lớp HĐ", "Buổi hôm nay", "Công nợ", "Kỳ HP mở", "Kỳ lương", "Lead"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#64748b]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branchBreakdown.map((b) => (
                  <tr key={b.id} className="border-b border-[#f0f4f8] last:border-0 hover:bg-[#f8faff] transition">
                    <td className="px-4 py-3 font-bold text-[#0f1729]">{b.name} <span className="text-xs text-[#94a3b8]">({b.code})</span></td>
                    <td className="px-4 py-3 font-bold text-[#f97316]">{b.activeStudents}</td>
                    <td className="px-4 py-3 text-[#475569]">{b.activeClasses}</td>
                    <td className="px-4 py-3"><span className="inline-flex rounded-lg bg-[#fff7ed] px-2 py-0.5 text-xs font-bold text-[#c2410c]">{b.sessionsToday}</span></td>
                    <td className={`px-4 py-3 font-bold ${b.outstanding > 0 ? "text-[#ef4444]" : "text-[#10b981]"}`}>{formatVnd(b.outstanding)}</td>
                    <td className="px-4 py-3 text-[#475569]">{b.openBillingPeriods}</td>
                    <td className="px-4 py-3 text-[#475569]">{b.openPayrollRuns}</td>
                    <td className="px-4 py-3 text-[#475569]">{b.openLeads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-4 lg:hidden">
            {branchBreakdown.map((b) => (
              <div key={b.id} className="rounded-xl border border-[#e5eaf7] bg-white p-4">
                <div className="mb-3">
                  <p className="font-bold text-[#0f1729]">{b.name}</p>
                  <p className="text-xs text-[#94a3b8]">Mã: {b.code}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="rounded-lg bg-[#fff7ed] border border-[#fed7aa] p-2">
                    <p className="text-[10px] font-bold uppercase text-[#c2410c]">HV đang học</p>
                    <p className="mt-1 text-lg font-black text-[#f97316]">{b.activeStudents}</p>
                  </div>
                  <div className="rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] p-2">
                    <p className="text-[10px] font-bold uppercase text-[#065f46]">Lớp HĐ</p>
                    <p className="mt-1 text-lg font-black text-[#10b981]">{b.activeClasses}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-[#f0f4f8] pt-3 text-xs">
                  <div className="text-center">
                    <p className="text-[10px] text-[#94a3b8] mb-0.5">Buổi hôm nay</p>
                    <span className="inline-flex rounded-lg bg-[#fff7ed] px-2 py-0.5 text-xs font-bold text-[#c2410c]">{b.sessionsToday}</span>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-[#94a3b8] mb-0.5">Kỳ HP</p>
                    <p className="font-bold text-[#475569]">{b.openBillingPeriods}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-[#94a3b8] mb-0.5">Kỳ lương</p>
                    <p className="font-bold text-[#475569]">{b.openPayrollRuns}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#f0f4f8] pt-3">
                  <div>
                    <p className="text-[10px] text-[#94a3b8] mb-1">Công nợ</p>
                    <p className={`text-sm font-black ${b.outstanding > 0 ? "text-[#ef4444]" : "text-[#10b981]"}`}>{formatVnd(b.outstanding)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[#94a3b8] mb-1">Lead mở</p>
                    <p className="text-sm font-black text-[#475569]">{b.openLeads}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Payroll + Materials + Birthdays ─────────────────────── */}
      {operational && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Payroll breakdown */}
          {operational.payrollBreakdown && (
            <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm lg:col-span-2">
              <SectionHeading action={<Link href="/payroll" className="text-sm font-bold text-[#f97316]">Mở lương →</Link>}>
                Công GV/TG — kỳ {operational.payrollBreakdown.periodName}
              </SectionHeading>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { title: "Giáo viên", lines: operational.payrollBreakdown.teachers, color: "#f97316" },
                  { title: "Trợ giảng", lines: operational.payrollBreakdown.assistants, color: "#ea580c" },
                ].map((group) => (
                  <div key={group.title}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: group.color }}>{group.title}</p>
                    <div className="space-y-2">
                      {group.lines.map((l) => (
                        <div key={l.name} className="flex items-center justify-between rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-3 py-2">
                          <span className="text-sm font-semibold text-[#0f1729] truncate">{l.name}</span>
                          <span className="text-xs text-[#64748b] ml-2 whitespace-nowrap">{l.hours}h · {formatVnd(l.amount)}</span>
                        </div>
                      ))}
                      {group.lines.length === 0 && <p className="text-xs text-[#94a3b8]">Chưa có dữ liệu.</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Birthdays */}
          <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
            <SectionHeading>🎂 Sinh nhật tháng này</SectionHeading>
            <div className="space-y-2">
              {operational.birthdayThisMonth.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-3 py-2">
                  <Link href={`/students/${s.id}`} className="text-sm font-semibold text-[#f97316] hover:text-[#ea580c] truncate">{s.fullName}</Link>
                  <span className="ml-2 text-xs font-bold text-[#64748b] whitespace-nowrap">
                    {new Date(s.dob!).getDate()}/{new Date(s.dob!).getMonth() + 1}
                  </span>
                </div>
              ))}
              {operational.birthdayThisMonth.length === 0 && <p className="text-sm text-[#94a3b8]">Không có sinh nhật tháng này.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick actions + Focus items ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-black tracking-tight text-[#0f1729]">{shell.quickActionsTitle}</h2>
              <p className="mt-1 text-sm text-[#64748b]">Đi thẳng vào đúng tác vụ cần xử lý.</p>
            </div>
            <span className="inline-flex rounded-lg border border-[#e5eaf7] bg-[#f8faff] px-2.5 py-1 text-xs font-bold text-[#64748b]">{role ?? "DEFAULT"}</span>
          </div>
          <QuickActions title={shell.quickActionsTitle} columns={3} actions={quickActions.map((a) => ({
            id: a.id, label: a.label, description: a.description, href: a.href, color: a.tone,
            badge: "badge" in a ? (a as AppQuickAction & { badge?: string | number }).badge : undefined,
            icon: <ActionIcon icon={a.icon} />,
          }))} />
        </div>

        <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black tracking-tight text-[#0f1729] mb-4">{shell.focusTitle}</h2>
          <div className="space-y-3">
            {shell.focusItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#f97316]" />
                <span className="text-sm text-[#475569] leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] px-4 py-3">
            <p className="text-xs font-bold text-[#166534]">💡 Việc của tôi: <span className="text-lg font-black">{stats.myOpenTasks}</span> task đang mở</p>
          </div>
        </div>
      </div>

    </div>
  );
}
