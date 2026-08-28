import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView, canUpdate } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import TeacherTasksTable from "./TeacherTasksTable";

type SearchParams = {
  status?: string;
  employeeId?: string;
  sessionFrom?: string;
  sessionTo?: string;
  requirementText?: string;
  reason?: string;
  scoreDecision?: string;
  checkedAtFrom?: string;
  checkedAtTo?: string;
};

const STATUS_FILTERS = [
  { key: "", label: "Tất cả", icon: "📋", color: "border-[#e5eaf7] bg-white text-[#475569]", activeColor: "border-[#0f1729] bg-[#0f1729] text-white" },
  { key: "SUBMITTED", label: "Đã nộp", icon: "✓", color: "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]", activeColor: "border-[#059669] bg-[#059669] text-white" },
  { key: "NOT_SUBMITTED", label: "Chưa nộp", icon: "✗", color: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]", activeColor: "border-[#dc2626] bg-[#dc2626] text-white" },
];

const TEACHER_TASKS_TOUR: TourStep[] = [
  {
    target: '[data-tour="teacher-tasks-header"]',
    title: "Theo dõi bài tập giáo viên toàn hệ thống",
    description: "Trang này gom tất cả xác nhận 'việc giáo viên cần làm' từ mọi buổi học — giúp quản lý nhanh ai đã nộp, ai chưa, và điểm tích cực bị trừ.",
    placement: "bottom",
  },
  {
    target: '[data-tour="teacher-tasks-filters"]',
    title: "Lọc theo trạng thái và nhân sự",
    description: "Dùng các chip để lọc nhanh 'Đã nộp' hay 'Chưa nộp', hoặc chọn nhân sự cụ thể để xem lịch sử của từng người.",
    placement: "bottom",
  },
  {
    target: '[data-tour="teacher-tasks-table"]',
    title: "Bảng chi tiết xác nhận",
    description: "Mỗi dòng là 1 lần xác nhận — click vào ngày để mở buổi học gốc, hoặc vào 'Lịch sử & điểm' để xem profile nhân sự đó.",
    placement: "top",
  },
];

export default async function TeacherTasksPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("hr", role)) notFound();

  const activeBranchId = await getCurrentBranchId();
  const status = searchParams.status ?? "";
  const employeeId = searchParams.employeeId ?? "";
  const sessionFrom = searchParams.sessionFrom?.trim() ?? "";
  const sessionTo = searchParams.sessionTo?.trim() ?? "";
  const requirementTextFilter = searchParams.requirementText?.trim() ?? "";
  const reasonFilter = searchParams.reason?.trim() ?? "";
  const scoreDecisionFilter = searchParams.scoreDecision?.trim() ?? "";
  const checkedAtFrom = searchParams.checkedAtFrom?.trim() ?? "";
  const checkedAtTo = searchParams.checkedAtTo?.trim() ?? "";

  const checks = await prisma.sessionRequirementCheck.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(scoreDecisionFilter ? { scoreDecision: scoreDecisionFilter } : {}),
      ...(requirementTextFilter ? { requirementText: { contains: requirementTextFilter } } : {}),
      ...(reasonFilter ? { reason: { contains: reasonFilter } } : {}),
      ...(sessionFrom || sessionTo
        ? {
            session: {
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
    },
    include: {
      employee: { select: { id: true, fullName: true, employeeCode: true } },
      session: { select: { id: true, classId: true, sessionDate: true, class: { select: { className: true } } } },
      scoreEvent: { select: { points: true, type: true } },
    },
    orderBy: { checkedAt: "desc" },
    take: 200,
  });

  const employees = await prisma.employee.findMany({
    where: { branchId: activeBranchId ?? undefined, workStatus: "ACTIVE" },
    select: { id: true, fullName: true, employeeCode: true },
    orderBy: { fullName: "asc" },
  });

  const totalChecks = checks.length;
  const notSubmittedCount = checks.filter((item) => item.status === "NOT_SUBMITTED").length;

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="rounded-2xl border border-[#e5eaf7] bg-white p-4 shadow-sm">
          <form action="/teacher-tasks" method="get" className="space-y-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <label className="block text-xs font-bold uppercase tracking-wide text-[#64748b]">Lọc nhân sự</label>
            <select name="employeeId" className="w-full rounded-lg border border-[#e5eaf7] px-3 py-2 text-sm font-semibold outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20" defaultValue={employeeId}>
              <option value="">Tất cả nhân sự</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName} ({item.employeeCode})
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary-sm w-full">
              Áp dụng
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" data-tour="teacher-tasks-filters">
        {STATUS_FILTERS.map((item) => {
          const params = new URLSearchParams();
          if (item.key) params.set("status", item.key);
          if (employeeId) params.set("employeeId", employeeId);
          const query = params.toString();
          const active = item.key === status;
          return (
            <Link
              key={item.key || "ALL"}
              href={`/teacher-tasks${query ? `?${query}` : ""}`}
              className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all ${
                active ? item.activeColor + " shadow-md scale-[1.02]" : item.color + " hover:shadow-sm hover:scale-[1.01]"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      <div data-tour="teacher-tasks-table">
        <TeacherTasksTable
          initialData={checks}
          employees={employees}
          status={status}
          employeeId={employeeId}
          canDecide={canUpdate("hr", role)}
        />
      </div>
    </div>
  );
}
