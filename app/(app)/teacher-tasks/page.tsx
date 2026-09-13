import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView, canUpdate } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import DetailTabs from "@/components/ui/DetailTabs";
import TeacherScoreboard from "@/components/teacher-scores/TeacherScoreboard";
import { computeMonthlyScoreboard } from "@/lib/server/assistant-score-rules";
import { getVietnamToday } from "@/lib/server/class-rules";
import { getAccessibleBranches } from "@/lib/branch-filter";
import TeacherTasksTable from "./TeacherTasksTable";

type SearchParams = {
  /** "YYYY-MM" — tháng của bảng điểm tích cực. */
  month?: string;
  q?: string;
  status?: string;
  employeeId?: string;
  classId?: string;
  sessionFrom?: string;
  sessionTo?: string;
  requirementText?: string;
  reason?: string;
  scoreDecision?: string;
  checkedAtFrom?: string;
  checkedAtTo?: string;
  page?: string;
  pageSize?: string;
};

const PAGE_SIZE = 20;

const TEACHER_TASKS_TOUR: TourStep[] = [
  {
    target: '[data-tour="teacher-tasks-header"]',
    title: "Theo dõi bài tập giáo viên toàn hệ thống",
    description: "Trang này gom tất cả xác nhận 'việc giáo viên cần làm' từ mọi buổi học — giúp quản lý nhanh ai đã nộp, ai chưa, và điểm tích cực bị trừ.",
    placement: "bottom",
  },
  {
    target: '[data-tour="teacher-tasks-table"]',
    title: "Bảng chi tiết xác nhận",
    description:
      "Mỗi dòng là 1 lần xác nhận — dùng ô lọc 'Trạng thái' ngay trên bảng để lọc nhanh Đã nộp/Chưa nộp, click vào ngày để mở buổi học gốc, hoặc vào 'Lịch sử & điểm' để xem profile nhân sự đó.",
    placement: "top",
  },
];

export default async function TeacherTasksPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("hr", role)) notFound();

  const activeBranchId = await getCurrentBranchId();
  const today = getVietnamToday().toISOString().slice(0, 10);
  const month = searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : today.slice(0, 7);
  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "";
  const employeeId = searchParams.employeeId ?? "";
  const classId = searchParams.classId ?? "";
  const sessionFrom = searchParams.sessionFrom?.trim() ?? "";
  const sessionTo = searchParams.sessionTo?.trim() ?? "";
  const requirementTextFilter = searchParams.requirementText?.trim() ?? "";
  const reasonFilter = searchParams.reason?.trim() ?? "";
  const scoreDecisionFilter = searchParams.scoreDecision?.trim() ?? "";
  const checkedAtFrom = searchParams.checkedAtFrom?.trim() ?? "";
  const checkedAtTo = searchParams.checkedAtTo?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);

  const where = {
    ...(status ? { status } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(classId ? { session: { classId } } : {}),
    ...(scoreDecisionFilter ? { scoreDecision: scoreDecisionFilter } : {}),
    ...(requirementTextFilter ? { requirementText: { contains: requirementTextFilter } } : {}),
    ...(reasonFilter ? { reason: { contains: reasonFilter } } : {}),
    ...(sessionFrom || sessionTo
      ? {
          session: {
            ...(classId ? { classId } : {}),
            sessionDate: {
              ...(sessionFrom ? { gte: new Date(`${sessionFrom}T00:00:00`) } : {}),
              ...(sessionTo ? { lte: new Date(`${sessionTo}T23:59:59`) } : {}),
            },
          },
        }
      : {}),
    ...(checkedAtFrom || checkedAtTo
      ? {
          checkedAt: {
            ...(checkedAtFrom ? { gte: new Date(`${checkedAtFrom}T00:00:00`) } : {}),
            ...(checkedAtTo ? { lte: new Date(`${checkedAtTo}T23:59:59`) } : {}),
          },
        }
      : {}),
    employee: activeBranchId ? { branchId: activeBranchId } : {},
    ...(q
      ? {
          OR: [
            { requirementText: { contains: q } },
            { employee: { fullName: { contains: q } } },
            { employee: { employeeCode: { contains: q } } },
            { session: { class: { className: { contains: q } } } },
          ],
        }
      : {}),
  };

  const [checks, total, statusCounts] = await Promise.all([
    prisma.sessionRequirementCheck.findMany({
      where,
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        session: { select: { id: true, classId: true, sessionDate: true, class: { select: { className: true } } } },
        scoreEvent: { select: { points: true, type: true } },
      },
      orderBy: { checkedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sessionRequirementCheck.count({ where }),
    prisma.sessionRequirementCheck.groupBy({
      by: ["status"],
      where: { employee: activeBranchId ? { branchId: activeBranchId } : {} },
      _count: { _all: true },
    }),
  ]);

  const employees = await prisma.employee.findMany({
    where: { branchId: activeBranchId ?? undefined, workStatus: "ACTIVE" },
    select: { id: true, fullName: true, employeeCode: true },
    orderBy: { fullName: "asc" },
  });

  // "Lọc theo danh mục" — danh mục ở đây là LỚP, vì nhân sự (employee) và trạng thái
  // (status) đã có sẵn bộ lọc riêng; lớp là chiều lọc còn thiếu để tra theo đúng lớp
  // cụ thể thay vì phải nhớ khoảng ngày buổi học.
  const classes = await prisma.class.findMany({
    where: { branchId: activeBranchId ?? undefined },
    select: { id: true, className: true, classCode: true },
    orderBy: { className: "asc" },
  });

  // ---- Dữ liệu tab "Chấm điểm tích cực" ----
  const [scoreboard, pendingRaw, accessibleBranches] = await Promise.all([
    computeMonthlyScoreboard({ branchId: activeBranchId, month }),
    // Buổi khai CHƯA NỘP mà admin chưa quyết định — đây là việc cần làm hằng ngày.
    prisma.sessionRequirementCheck.findMany({
      where: {
        status: "NOT_SUBMITTED",
        scoreDecision: "PENDING",
        employee: activeBranchId ? { branchId: activeBranchId } : {},
      },
      include: {
        employee: { select: { id: true, fullName: true } },
        session: { select: { id: true, classId: true, sessionDate: true, class: { select: { className: true } } } },
      },
      orderBy: { checkedAt: "desc" },
      take: 50,
    }),
    getAccessibleBranches(),
  ]);
  const pendingChecks = pendingRaw.map((item) => ({
    sessionId: item.sessionId,
    classId: item.session.classId,
    className: item.session.class.className,
    sessionDate: item.session.sessionDate.toISOString(),
    employeeId: item.employeeId,
    employeeName: item.employee.fullName,
    requirementText: item.requirementText,
    reason: item.reason,
    status: item.status,
    scoreDecision: item.scoreDecision,
  }));

  const totalChecks = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const notSubmittedCount = statusCounts.find((row) => row.status === "NOT_SUBMITTED")?._count._all ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between" data-tour="teacher-tasks-header">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#0f1729]">Điểm tích cực giáo viên & trợ giảng</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#64748b]">
            Chấm điểm trừ / điểm cộng theo tháng, xử lý buổi chưa nộp bài tập, và xem lại toàn bộ lịch sử xác nhận theo từng buổi.
          </p>
        </div>
        <SpotlightTour steps={TEACHER_TASKS_TOUR} />
      </div>

      <DetailTabs
        defaultTabKey="scores"
        tabs={[
          {
            key: "scores",
            label: `Chấm điểm tích cực${pendingChecks.length > 0 ? ` (${pendingChecks.length} chờ)` : ""}`,
            content: (
              <TeacherScoreboard
                month={month}
                today={today}
                rows={scoreboard.rows}
                totals={scoreboard.totals}
                allEmployees={scoreboard.allEmployees}
                branches={accessibleBranches.map((branch) => ({ id: branch.id, name: branch.name }))}
                defaultBranchId={activeBranchId ?? accessibleBranches[0]?.id ?? ""}
                pendingChecks={pendingChecks}
                canDecide={canUpdate("hr", role)}
              />
            ),
          },
          {
            key: "history",
            label: "Lịch sử xác nhận bài tập",
            content: (
              <div data-tour="teacher-tasks-table">
                <TeacherTasksTable
                  initialData={checks}
                  employees={employees}
                  classes={classes}
                  status={status}
                  employeeId={employeeId}
                  searchQuery={q}
                  total={total}
                  page={page}
                  pageSize={pageSize}
                  canDecide={canUpdate("hr", role)}
                  counts={{ total: totalChecks, notSubmitted: notSubmittedCount, submitted: totalChecks - notSubmittedCount }}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
