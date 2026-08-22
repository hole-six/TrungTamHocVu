import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";

type SearchParams = { status?: string; employeeId?: string };

function formatDateTime(value: Date) {
  return new Date(value).toLocaleString("vi-VN");
}

const STATUS_FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "SUBMITTED", label: "Đã nộp" },
  { key: "NOT_SUBMITTED", label: "Chưa nộp" },
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
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[#0f1729]">Theo dõi bài tập giáo viên</h1>
        <p className="mt-1 max-w-3xl text-sm text-[#64748b]">
          Danh sách xác nhận "việc giáo viên cần làm" theo từng buổi — ai đã nộp, ai chưa, và điểm tích cực bị trừ tương ứng.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1d4ed8]">Tổng số xác nhận</p>
          <p className="mt-2 text-2xl font-black text-[#0f1729]">{totalChecks}</p>
        </div>
        <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b91c1c]">Chưa nộp</p>
          <p className="mt-2 text-2xl font-black text-[#0f1729]">{notSubmittedCount}</p>
        </div>
        <div className="rounded-2xl border border-[#e5eaf7] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748b]">Nhân sự</p>
          <form action="/payroll/teacher-tasks" method="get" className="mt-2 flex gap-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <select name="employeeId" className="input" defaultValue={employeeId}>
              <option value="">Tất cả nhân sự</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName} ({item.employeeCode})
                </option>
              ))}
            </select>
            <button type="submit" className="btn-ghost-sm shrink-0">
              Lọc
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((item) => {
          const params = new URLSearchParams();
          if (item.key) params.set("status", item.key);
          if (employeeId) params.set("employeeId", employeeId);
          const query = params.toString();
          const active = item.key === status;
          return (
            <Link
              key={item.key || "ALL"}
              href={`/payroll/teacher-tasks${query ? `?${query}` : ""}`}
              className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                active ? "border-[#0f1729] bg-[#0f1729] text-white shadow-sm" : "border-[#dbe3ef] bg-white text-[#475569] hover:border-[#3b82f6] hover:text-[#1d4ed8]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e5eaf7] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-[0.12em] text-[#64748b]">
              <tr>
                <th className="px-4 py-3">Nhân sự</th>
                <th className="px-4 py-3">Buổi học</th>
                <th className="px-4 py-3">Yêu cầu</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Điểm trừ</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7]">
              {checks.map((item) => (
                <tr key={item.id} className="align-top hover:bg-[#f8fbff]">
                  <td className="px-4 py-4">
                    <p className="font-bold text-[#0f1729]">{item.employee.fullName}</p>
                    <p className="mt-0.5 text-xs text-[#64748b]">{item.employee.employeeCode}</p>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/classes/${item.session.classId}/sessions/${item.session.id}`} className="font-bold text-[#1d4ed8] underline underline-offset-2">
                      {new Date(item.session.sessionDate).toLocaleDateString("vi-VN")}
                    </Link>
                    <p className="mt-0.5 text-xs text-[#64748b]">{item.session.class.className}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="line-clamp-2 text-xs text-[#0f1729]">{item.requirementText}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${
                        item.status === "SUBMITTED" ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fef2f2] text-[#b91c1c]"
                      }`}
                    >
                      {item.status === "SUBMITTED" ? "Đã nộp" : "Chưa nộp"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {item.scoreEvent ? <span className="font-bold text-[#b91c1c]">-{item.scoreEvent.points}</span> : <span className="text-[#94a3b8]">—</span>}
                  </td>
                  <td className="px-4 py-4 text-xs text-[#64748b]">{formatDateTime(item.checkedAt)}</td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/payroll/employees/${item.employee.id}`}
                      className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-1.5 text-xs font-bold text-[#1d4ed8] hover:bg-[#dbeafe]"
                    >
                      Lịch sử & điểm
                    </Link>
                  </td>
                </tr>
              ))}
              {checks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#64748b]">
                    Chưa có xác nhận nào khớp bộ lọc này.
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
