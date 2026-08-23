import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";

type SearchParams = { status?: string; employeeId?: string };

function formatDateTime(value: Date) {
  return new Date(value).toLocaleString("vi-VN");
}

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

  const checks = await prisma.sessionRequirementCheck.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(employeeId ? { employeeId } : {}),
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
            <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-[#f97316] to-[#ea580c] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:shadow-md">
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

      <div className="overflow-hidden rounded-2xl border border-[#e5eaf7] bg-white shadow-sm" data-tour="teacher-tasks-table">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="min-w-[900px] w-full bg-white text-left text-sm">
            <thead className="border-b border-[#e5eaf7] bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9]">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#111827]">Nhân sự</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#111827]">Buổi học</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#111827]">Yêu cầu</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#111827]">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#111827]">Điểm trừ</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#111827]">Thời gian</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-[#111827]">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {checks.map((item) => (
                <tr key={item.id} className="align-top transition-colors hover:bg-[#fafafa]">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white shadow-md">
                        {item.employee.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-[#0f1729]">{item.employee.fullName}</p>
                        <p className="text-xs text-[#64748b]">{item.employee.employeeCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/classes/${item.session.classId}/sessions/${item.session.id}`} className="inline-flex items-center gap-2 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-sm font-bold text-[#1d4ed8] transition hover:border-[#3b82f6] hover:bg-[#dbeafe]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {new Date(item.session.sessionDate).toLocaleDateString("vi-VN")}
                    </Link>
                    <p className="mt-2 text-xs text-[#64748b]">{item.session.class.className}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <p className="line-clamp-2 text-sm leading-relaxed text-[#0f1729]">{item.requirementText}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${
                        item.status === "SUBMITTED" ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white" : "bg-gradient-to-r from-red-500 to-rose-600 text-white"
                      }`}
                    >
                      {item.status === "SUBMITTED" ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Đã nộp
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                          Chưa nộp
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {item.scoreEvent ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 text-sm font-black text-red-700">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        -{item.scoreEvent.points}
                      </span>
                    ) : (
                      <span className="text-[#94a3b8]">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-[#64748b]">{formatDateTime(item.checkedAt)}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/payroll/employees/${item.employee.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#e5eaf7] bg-white px-3 py-2 text-xs font-bold text-[#475569] transition hover:border-[#f97316] hover:text-[#f97316]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      Lịch sử & điểm
                    </Link>
                  </td>
                </tr>
              ))}
              {checks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="mx-auto max-w-sm space-y-3">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f1f5f9]">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                          <path d="M9 11l3 3L22 4"/>
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-[#0f1729]">Chưa có xác nhận nào</p>
                      <p className="text-xs text-[#64748b]">Các xác nhận sẽ xuất hiện khi trợ giảng đánh dấu tại từng buổi học</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
