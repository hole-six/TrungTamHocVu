import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView, canUpdate } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import TeacherTasksTable from "./TeacherTasksTable";

type SearchParams = {
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

  const totalChecks = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const notSubmittedCount = statusCounts.find((row) => row.status === "NOT_SUBMITTED")?._count._all ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between" data-tour="teacher-tasks-header">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#0f1729]">Theo dõi bài tập giáo viên</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#64748b]">
            Danh sách xác nhận "việc giáo viên cần làm" theo từng buổi — ai đã nộp, ai chưa, và điểm tích cực bị trừ tương ứng.
          </p>
        </div>
        <SpotlightTour steps={TEACHER_TASKS_TOUR} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#dbeafe] bg-gradient-to-br from-[#eff6ff] to-[#dbeafe]/30 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3b82f6] text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#1d4ed8]">Tổng xác nhận</p>
          </div>
          <p className="mt-3 text-3xl font-black text-[#0f1729]">{totalChecks}</p>
        </div>
        <div className="rounded-2xl border border-[#fecaca] bg-gradient-to-br from-[#fef2f2] to-[#fecaca]/30 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ef4444] text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#b91c1c]">Chưa nộp</p>
          </div>
          <p className="mt-3 text-3xl font-black text-[#0f1729]">{notSubmittedCount}</p>
        </div>
        <div className="rounded-2xl border border-[#a7f3d0] bg-gradient-to-br from-[#ecfdf5] to-[#a7f3d0]/30 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#10b981] text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#065f46]">Đã nộp</p>
          </div>
          <p className="mt-3 text-3xl font-black text-[#0f1729]">{totalChecks - notSubmittedCount}</p>
        </div>
      </div>

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
        />
      </div>
    </div>
  );
}
