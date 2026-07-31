import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { getAppShellConfig, type AppQuickAction } from "@/lib/app-shell";
import { getReportsDashboardData } from "@/lib/server/reporting";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";
import QuickActions from "@/components/dashboard/QuickActions";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

async function getStats(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const branchWhere = user?.branchId ? { branchId: user.branchId } : {};
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const [
    activeStudents,
    totalStudents,
    activeClasses,
    openLeads,
    unpaidCharges,
    paid,
    branchSessionsToday,
    mySessionsToday,
    openBillingPeriods,
    openPayrollRuns,
    myOpenTasks,
  ] = await Promise.all([
    prisma.student.count({ where: { ...branchWhere, status: "ACTIVE" } }),
    prisma.student.count({ where: branchWhere }),
    prisma.class.count({ where: { ...branchWhere, status: "ACTIVE" } }),
    prisma.lead.count({ where: { ...branchWhere, status: { notIn: ["ENROLLED", "LOST"] } } }),
    prisma.charge.aggregate({
      where: user?.branchId ? { student: { branchId: user.branchId } } : {},
      _sum: { totalAmount: true },
    }),
    prisma.paymentAllocation.aggregate({
      where: user?.branchId ? { charge: { student: { branchId: user.branchId } } } : {},
      _sum: { amount: true },
    }),
    prisma.classSession.count({
      where: user?.branchId
        ? { class: { branchId: user.branchId }, sessionDate: { gte: todayStart, lte: todayEnd } }
        : { sessionDate: { gte: todayStart, lte: todayEnd } },
    }),
    user?.employeeId
      ? prisma.sessionAssignment.count({
          where: {
            employeeId: user.employeeId,
            session: { sessionDate: { gte: todayStart, lte: todayEnd } },
          },
        })
      : Promise.resolve(0),
    prisma.billingPeriod.count({
      where: { ...branchWhere, status: { in: ["DRAFT", "GENERATED", "REVIEWED", "POSTED", "REOPENED"] } },
    }),
    prisma.payrollRun.count({
      where: { ...branchWhere, status: { in: ["DRAFT", "CALCULATED", "REVIEWED", "APPROVED"] } },
    }),
    user?.id ? prisma.task.count({ where: { assignedToId: user.id, status: "OPEN" } }) : Promise.resolve(0),
  ]);

  return {
    activeStudents,
    totalStudents,
    activeClasses,
    openLeads,
    outstanding: (unpaidCharges._sum.totalAmount ?? 0) - (paid._sum.amount ?? 0),
    branchSessionsToday,
    mySessionsToday,
    openBillingPeriods,
    openPayrollRuns,
    myOpenTasks,
  };
}

// Giám đốc/vai trò không gắn 1 cơ sở cụ thể (branchId=null) thấy số liệu TOÀN HỆ
// THỐNG gộp lại ở getStats() phía trên — không đủ để "nắm được mọi tình hình" theo
// từng cơ sở. Hàm này tính lại đúng bộ chỉ số đó nhưng tách riêng cho mỗi cơ sở.
async function getBranchBreakdown() {
  const branches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  return Promise.all(
    branches.map(async (branch) => {
      const [activeStudents, activeClasses, sessionsToday, openLeads, chargeSum, paidSum, openBillingPeriods, openPayrollRuns] =
        await Promise.all([
          prisma.student.count({ where: { branchId: branch.id, status: "ACTIVE" } }),
          prisma.class.count({ where: { branchId: branch.id, status: "ACTIVE" } }),
          prisma.classSession.count({ where: { class: { branchId: branch.id }, sessionDate: { gte: todayStart, lte: todayEnd } } }),
          prisma.lead.count({ where: { branchId: branch.id, status: { notIn: ["ENROLLED", "LOST"] } } }),
          prisma.charge.aggregate({ where: { student: { branchId: branch.id } }, _sum: { totalAmount: true } }),
          prisma.paymentAllocation.aggregate({ where: { charge: { student: { branchId: branch.id } } }, _sum: { amount: true } }),
          prisma.billingPeriod.count({ where: { branchId: branch.id, status: { in: ["DRAFT", "GENERATED", "REVIEWED", "POSTED", "REOPENED"] } } }),
          prisma.payrollRun.count({ where: { branchId: branch.id, status: { in: ["DRAFT", "CALCULATED", "REVIEWED", "APPROVED"] } } }),
        ]);
      return {
        id: branch.id,
        code: branch.code,
        name: branch.name,
        activeStudents,
        activeClasses,
        sessionsToday,
        openLeads,
        outstanding: (chargeSum._sum.totalAmount ?? 0) - (paidSum._sum.amount ?? 0),
        openBillingPeriods,
        openPayrollRuns,
      };
    })
  );
}

// Phễu tuyển sinh theo đúng thứ tự state machine (lib/server/lead-rules.ts) — thứ tự
// cố định chứ không sort theo số lượng, để "màu theo nhóm, không theo hạng" (mỗi cột
// luôn là 1 giai đoạn cụ thể dù số liệu đổi qua từng ngày).
async function getLeadPipeline(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const branchWhere = user?.branchId ? { branchId: user.branchId } : {};
  const rows = await prisma.lead.groupBy({ by: ["status"], where: branchWhere, _count: { _all: true } });
  const countByStatus = new Map(rows.map((r) => [r.status, r._count._all]));
  return LEAD_STATUSES.map((status) => ({ status, label: LEAD_STATUS_LABEL[status], count: countByStatus.get(status) ?? 0 }));
}

// Học bổng giờ gắn theo TỪNG ghi danh (Scholarship.enrollmentId, sửa trong session
// này) thay vì gắn thẳng học viên — trước đó bảng scholarships trống 0 dòng dù có
// hàng trăm học viên, đây là chỉ số để xác nhận việc nhập học bổng đã thực sự chạy.
async function getScholarshipCoverage(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const now = new Date();
  const branchWhere = user?.branchId ? { student: { branchId: user.branchId } } : {};
  return prisma.scholarship.count({
    where: { ...branchWhere, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
  });
}

// Cùng logic cảnh báo đỏ/vàng đang dùng ở /leads/test-schedule (lib/server/lead-rules
// dateUrgency) — lặp lại ở đây để Director/CSO thấy ngay tình trạng test mà không
// phải rời dashboard, đúng tinh thần "thống kê đúng và đủ dữ liệu đã sửa" của hệ thống.
async function getTestOverview(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const branchWhere = user?.branchId ? { branchId: user.branchId } : {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soonBoundary = new Date(today);
  soonBoundary.setDate(soonBoundary.getDate() + 3);
  soonBoundary.setHours(23, 59, 59, 999);

  const [missingTest, overdue, soon] = await Promise.all([
    prisma.lead.count({ where: { ...branchWhere, status: { notIn: ["ENROLLED", "LOST"] }, placementTests: { none: {} } } }),
    prisma.placementTest.count({ where: { status: "SCHEDULED", scheduledDate: { lt: today }, lead: branchWhere } }),
    prisma.placementTest.count({ where: { status: "SCHEDULED", scheduledDate: { gte: today, lte: soonBoundary }, lead: branchWhere } }),
  ]);

  return { missingTest, overdue, soon };
}

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

// Chart thanh ngang 1-hue duy nhất (magnitude qua các giai đoạn có thứ tự cố định,
// không phải identity nhiều nhóm) — theo skill dataviz: mảnh, bo tròn đầu vạch dữ
// liệu, nhãn giá trị trực tiếp, không dùng dual-axis, không đổi màu theo thứ hạng.
function PipelineBarChart({ rows, href }: { rows: { status: string; label: string; count: number }[]; href: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <Link
          key={row.status}
          href={`${href}?status=${row.status}`}
          className="group flex items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-primary/5"
        >
          <span className="w-32 shrink-0 truncate text-xs font-medium text-ink-muted80" title={row.label}>
            {row.label}
          </span>
          <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-primary/10">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all group-hover:bg-primary/80"
              style={{ width: `${Math.max(row.count > 0 ? 3 : 0, (row.count / max) * 100)}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-ink">{row.count}</span>
        </Link>
      ))}
    </div>
  );
}

function BoardCard({
  title,
  subtitle,
  href,
  metric,
  hint,
  tone = "primary",
}: {
  title: string;
  subtitle: string;
  href: string;
  metric: string;
  hint: string;
  tone?: "primary" | "warning" | "success" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-primary/20 bg-primary/5";

  return (
    <Link href={href} className={`block rounded-[24px] border p-5 transition hover:-translate-y-0.5 hover:shadow-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-xs text-ink-muted48">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold text-primary">Mở →</span>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">{metric}</p>
      <p className="mt-1 text-xs text-ink-muted48">{hint}</p>
    </Link>
  );
}

function actionToneClasses(tone: AppQuickAction["tone"]) {
  switch (tone) {
    case "success":
      return "bg-emerald-50 text-emerald-700";
    case "warning":
      return "bg-amber-50 text-amber-700";
    case "danger":
      return "bg-rose-50 text-rose-700";
    case "info":
      return "bg-sky-50 text-sky-700";
    default:
      return "bg-primary/10 text-primary";
  }
}

function ActionIcon({ icon }: { icon: AppQuickAction["icon"] }) {
  switch (icon) {
    case "plus":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case "calendar":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "users":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "money":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case "clipboard":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
      );
    case "graduation":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case "shield":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
  }
}

function enrichQuickActions(
  actions: AppQuickAction[],
  role: string | null,
  stats: Awaited<ReturnType<typeof getStats>>,
  operational: Awaited<ReturnType<typeof getReportsDashboardData>> | null
) {
  return actions.map((action) => {
    if (action.href === "/leads") {
      return { ...action, badge: stats.openLeads > 0 ? stats.openLeads : undefined };
    }
    if (action.href === "/students") {
      return { ...action, badge: operational && operational.studentsWithoutPortal > 0 ? operational.studentsWithoutPortal : undefined };
    }
    if (action.href === "/guardians") {
      return { ...action, badge: operational && operational.convertedStudentsWithoutPortal > 0 ? operational.convertedStudentsWithoutPortal : undefined };
    }
    if (action.href === "/tuition") {
      return { ...action, badge: operational?.debtors.length ? operational.debtors.length : undefined };
    }
    if (action.href === "/classes" && (role === "BRANCH_MANAGER" || role === "REGISTRAR")) {
      return { ...action, badge: stats.branchSessionsToday > 0 ? stats.branchSessionsToday : undefined };
    }
    if (action.href === "/calendar" && (role === "TEACHER" || role === "TEACHING_ASSISTANT")) {
      return { ...action, badge: stats.mySessionsToday > 0 ? stats.mySessionsToday : undefined };
    }
    return action;
  });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const shellConfig = getAppShellConfig(role);
  const stats = await getStats(user);
  const showCrmWidgets = role !== "TEACHER" && role !== "TEACHING_ASSISTANT";
  const [operational, leadPipeline, scholarshipCoverage, testOverview] = await Promise.all([
    showCrmWidgets ? getReportsDashboardData(user?.branchId ?? null) : Promise.resolve(null),
    showCrmWidgets ? getLeadPipeline(user) : Promise.resolve(null),
    showCrmWidgets ? getScholarshipCoverage(user) : Promise.resolve(0),
    showCrmWidgets ? getTestOverview(user) : Promise.resolve(null),
  ]);
  // Giám đốc luôn cần thấy tình hình MỌI cơ sở, kể cả khi tài khoản của họ vẫn
  // đang gắn 1 branchId cụ thể (vd hệ thống hiện chỉ có 1 cơ sở) — nên xét theo
  // vai trò DIRECTOR, không xét branchId có null hay không.
  const branchBreakdown = role === "DIRECTOR" ? await getBranchBreakdown() : null;

  const sessionsCardValue = role === "TEACHER" || role === "TEACHING_ASSISTANT" ? stats.mySessionsToday : stats.branchSessionsToday;
  const quickActions = enrichQuickActions(shellConfig.quickActions, role, stats, operational);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">{shellConfig.dashboardTitle}</h1>
          <p className="page-subtitle">{shellConfig.dashboardSubtitle}</p>
        </div>
      </div>

      {/* 1 hàng duy nhất — trước đây có 2 hàng (StatCard + BoardCard) lặp lại gần
          như y hệt nhau (cùng 1 số hiện ra 2-3 lần ở 2 hàng khác nhau, có thẻ còn
          tự lặp số của chính nó giữa "metric" và "hint"), nhìn rối. Giờ mỗi thẻ chỉ
          hiện 1 con số chính + 1 thông tin bổ sung THỰC SỰ khác, không trùng nhau. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BoardCard
          title="Student 360"
          subtitle="Hồ sơ HV, phụ huynh, portal, lớp, công nợ"
          href="/students"
          metric={String(stats.activeStudents)}
          hint={`trên tổng ${stats.totalStudents} học viên`}
          tone="primary"
        />
        <BoardCard
          title="Class Operating Board"
          subtitle="Lớp, buổi học, roster, journal, điểm danh"
          href="/classes"
          metric={String(stats.activeClasses)}
          hint={`${sessionsCardValue} buổi học hôm nay`}
          tone="success"
        />
        <BoardCard
          title="Tuition Control Board"
          subtitle="Kỳ thu, công nợ, phụ huynh, nhắc thanh toán"
          href="/tuition"
          metric={formatVnd(stats.outstanding)}
          hint={
            operational
              ? `${operational.debtors.length} học viên đang nợ`
              : `${stats.openBillingPeriods} kỳ học phí đang mở`
          }
          tone="warning"
        />
        <BoardCard
          title="Teaching Payroll Board"
          subtitle="Công GV/TG, kỳ lương, đánh giá, thanh toán"
          href="/payroll"
          metric={String(stats.openPayrollRuns)}
          hint="kỳ lương chưa khóa sổ"
          tone="danger"
        />
      </div>

      {branchBreakdown && (
        <div className="card overflow-x-auto">
          <h2 className="font-display text-lg font-semibold tracking-tight">Tình hình theo từng cơ sở</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
              <tr>
                <th className="py-2 font-medium">Cơ sở</th>
                <th className="py-2 font-medium">HV đang học</th>
                <th className="py-2 font-medium">Lớp hoạt động</th>
                <th className="py-2 font-medium">Buổi học hôm nay</th>
                <th className="py-2 font-medium">Công nợ học phí</th>
                <th className="py-2 font-medium">Kỳ học phí mở</th>
                <th className="py-2 font-medium">Kỳ lương mở</th>
                <th className="py-2 font-medium">Lead đang xử lý</th>
              </tr>
            </thead>
            <tbody>
              {branchBreakdown.map((b) => (
                <tr key={b.id} className="border-b border-hairline last:border-0">
                  <td className="py-2 font-medium">{b.name} <span className="text-ink-muted48">({b.code})</span></td>
                  <td className="py-2">{b.activeStudents}</td>
                  <td className="py-2">{b.activeClasses}</td>
                  <td className="py-2">{b.sessionsToday}</td>
                  <td className={`py-2 ${b.outstanding > 0 ? "text-red-600 font-medium" : ""}`}>{formatVnd(b.outstanding)}</td>
                  <td className="py-2">{b.openBillingPeriods}</td>
                  <td className="py-2">{b.openPayrollRuns}</td>
                  <td className="py-2">{b.openLeads}</td>
                </tr>
              ))}
              {branchBreakdown.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-ink-muted48">Chưa có cơ sở nào đang hoạt động.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {leadPipeline && testOverview && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Phễu tuyển sinh</h2>
                <p className="mt-1 text-sm text-ink-muted48">Số lead theo từng giai đoạn — bấm vào 1 giai đoạn để lọc thẳng trong CRM.</p>
              </div>
              <Link href="/leads" className="shrink-0 text-sm font-medium text-primary">
                Mở CRM →
              </Link>
            </div>
            <div className="mt-5">
              <PipelineBarChart rows={leadPipeline} href="/leads" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Danh sách test</h2>
                <p className="mt-1 text-sm text-ink-muted48">Sổ hẹn test chủ động, cảnh báo theo hạn.</p>
              </div>
              <Link href="/leads/test-schedule" className="shrink-0 text-sm font-medium text-primary">
                Mở →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Link href="/leads/test-schedule?testStatus=SCHEDULED" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-center hover:bg-red-100">
                <p className="font-display text-2xl font-bold text-red-700">{testOverview.overdue}</p>
                <p className="mt-0.5 text-[11px] font-medium text-red-700">Quá hạn</p>
              </Link>
              <Link href="/leads/test-schedule?testStatus=SCHEDULED" className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center hover:bg-amber-100">
                <p className="font-display text-2xl font-bold text-amber-700">{testOverview.soon}</p>
                <p className="mt-0.5 text-[11px] font-medium text-amber-700">Sắp tới (3 ngày)</p>
              </Link>
              <Link href="/leads/test-schedule?testStatus=NONE" className="rounded-2xl border border-hairline bg-canvas-parchment/60 p-3 text-center hover:bg-canvas-parchment">
                <p className="font-display text-2xl font-bold text-ink">{testOverview.missingTest}</p>
                <p className="mt-0.5 text-[11px] font-medium text-ink-muted48">Chưa hẹn</p>
              </Link>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-medium text-emerald-800">Học viên đang có học bổng áp dụng</p>
              <p className="font-display text-xl font-bold text-emerald-700">{scholarshipCoverage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">{shellConfig.quickActionsTitle}</h2>
              <p className="mt-1 text-sm text-ink-muted48">Đi thẳng vào đúng tác vụ để nhập liệu nhanh, đúng form và đúng quyền.</p>
            </div>
            <span className="badge bg-primary/10 text-primary">{role ?? "DEFAULT"}</span>
          </div>

          <div className="mt-4">
            <QuickActions
              title={shellConfig.quickActionsTitle}
              columns={3}
              actions={quickActions.map((action) => ({
                id: action.id,
                label: action.label,
                description: action.description,
                href: action.href,
                color: action.tone,
                badge: "badge" in action ? (action as AppQuickAction & { badge?: string | number }).badge : undefined,
                icon: <ActionIcon icon={action.icon} />,
              }))}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">{shellConfig.focusTitle}</h2>
          <div className="mt-4 space-y-3">
            {shellConfig.focusItems.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-ink-muted80">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted48">Việc của tôi</p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{stats.myOpenTasks}</p>
          <p className="mt-1 text-sm text-ink-muted48">task đang mở được giao trực tiếp</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted48">Kỳ học phí mở</p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{stats.openBillingPeriods}</p>
          <p className="mt-1 text-sm text-ink-muted48">kỳ cần rà soát / chốt / theo dõi</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted48">Kỳ lương mở</p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{stats.openPayrollRuns}</p>
          <p className="mt-1 text-sm text-ink-muted48">kỳ lương chưa khóa sổ</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted48">Lead đang xử lý</p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{stats.openLeads}</p>
          <p className="mt-1 text-sm text-ink-muted48">đầu mối chưa chuyển đổi hoặc chưa đóng</p>
        </div>
      </div>

      {operational ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Cảnh báo vận hành</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-ink-muted48">HV đã có portal PH</p>
                <p className="font-display text-2xl font-semibold text-emerald-700">{operational.portalCoverageCount}</p>
              </div>
              <div>
                <p className="text-ink-muted48">HV chưa có portal PH</p>
                <p className="font-display text-2xl font-semibold text-amber-700">{operational.studentsWithoutPortal}</p>
              </div>
              <div>
                <p className="text-ink-muted48">Đã convert chưa có portal</p>
                <p className="font-display text-2xl font-semibold text-rose-700">{operational.convertedStudentsWithoutPortal}</p>
              </div>
              <div>
                <p className="text-ink-muted48">Lead đủ điều kiện chưa xếp lớp</p>
                <p className="font-display text-2xl font-semibold text-sky-700">{operational.qualifiedLeadsWithoutClass}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">Công nợ cần xử lý trước</h2>
              <Link href="/reports" className="text-sm font-medium text-primary">
                Mở báo cáo →
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {operational.debtors.slice(0, 5).map((student) => (
                <div key={student.id} className="rounded-xl border border-hairline px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/students/${student.id}`} className="font-medium text-primary">
                      {student.fullName} ({student.studentDisplayId ?? student.studentCode})
                    </Link>
                    <span className="font-semibold text-rose-700">{formatVnd(student.outstanding)}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted48">
                    {student.className ?? "Chưa có lớp"} · {student.leadCode ? `Lead ${student.leadCode}` : "Không gắn lead"}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted48">
                    {student.guardianName ?? "Chưa có phụ huynh"} · {student.guardianPortalEmail ?? "Chưa cấp portal"}
                  </p>
                </div>
              ))}
              {operational.debtors.length === 0 ? <p className="text-sm text-ink-muted48">Không có học viên nợ học phí.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="alert-info flex items-start gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" />
        </svg>
        <p>
          Dashboard này đã chuyển sang logic <strong>theo vai trò</strong>: cùng dữ liệu lõi nhưng khác trọng tâm, khác lối tắt và khác cách điều phối.
          Dữ liệu nhập vẫn phải đi qua form nghiệp vụ; báo cáo chỉ dùng để xem, lọc, export và chốt kỳ.
        </p>
      </div>
    </div>
  );
}
