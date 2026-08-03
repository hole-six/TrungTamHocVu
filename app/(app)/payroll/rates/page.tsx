import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride, canViewWithOverride } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import PayrollRatesWorkspace from "@/components/payroll/PayrollRatesWorkspace";

export default async function PayrollRatesPage() {
  const user = await getCurrentUser();
  if (!user) notFound();

  const access = await getUserRoleAndOverride(user.id, "hr");
  if (!canViewWithOverride("hr", access.role, access.override)) notFound();

  const activeBranchId = await getCurrentBranchId();
  const employees = await prisma.employee.findMany({
    where: activeBranchId ? { branchId: activeBranchId } : undefined,
    orderBy: [{ workStatus: "asc" }, { fullName: "asc" }],
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      position: true,
      payMode: true,
      teachingHourlyRate: true,
      assistantHourlyRate: true,
      staffDailyRate: true,
      workStatus: true,
      sessionAssignments: {
        where: { session: { status: "COMPLETED" } },
        select: { role: true, hours: true },
      },
      timesheetEntries: {
        select: { days: true },
      },
    },
  });

  const items = employees
    .map((employee) => {
      const teachingHours = employee.sessionAssignments
        .filter((assignment) => assignment.role === "TEACHER")
        .reduce((sum, assignment) => sum + (assignment.hours ?? 0), 0);
      const assistantHours = employee.sessionAssignments
        .filter((assignment) => assignment.role === "ASSISTANT" || assignment.role === "ASSISTANT2")
        .reduce((sum, assignment) => sum + (assignment.hours ?? 0), 0);
      const staffDays = employee.timesheetEntries.reduce((sum, entry) => sum + (entry.days ?? 0), 0);
      const estimatedImpact =
        (employee.teachingHourlyRate ?? 0) * teachingHours +
        (employee.assistantHourlyRate ?? 0) * assistantHours +
        (employee.staffDailyRate ?? 0) * staffDays;

      return {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        position: employee.position,
        payMode: employee.payMode,
        teachingHourlyRate: employee.teachingHourlyRate,
        assistantHourlyRate: employee.assistantHourlyRate,
        staffDailyRate: employee.staffDailyRate,
        teachingHours,
        assistantHours,
        staffDays,
        workStatus: employee.workStatus,
        estimatedImpact,
      };
    })
    .sort((a, b) => {
      const aMissing =
        (a.teachingHours > 0 && a.teachingHourlyRate == null) ||
        (a.assistantHours > 0 && a.assistantHourlyRate == null) ||
        (a.staffDays > 0 && a.staffDailyRate == null);
      const bMissing =
        (b.teachingHours > 0 && b.teachingHourlyRate == null) ||
        (b.assistantHours > 0 && b.assistantHourlyRate == null) ||
        (b.staffDays > 0 && b.staffDailyRate == null);
      if (aMissing !== bMissing) return aMissing ? -1 : 1;
      return b.estimatedImpact - a.estimatedImpact;
    });

  const missingCount = items.filter(
    (item) =>
      (item.teachingHours > 0 && item.teachingHourlyRate == null) ||
      (item.assistantHours > 0 && item.assistantHourlyRate == null) ||
      (item.staffDays > 0 && item.staffDailyRate == null),
  ).length;

  return (
    <div className="min-h-screen space-y-6 pb-20">
      <div>
        <Link href="/payroll" className="inline-flex items-center gap-2 text-sm font-medium text-[#6b7280] transition-colors hover:text-[#f97316]">
          ← Quay lại Payroll
        </Link>

        <div className="mt-4 overflow-hidden rounded-[32px] border-2 border-[#fed7aa] bg-gradient-to-r from-[#fff7ed] via-[#ffedd5] to-[#fed7aa] px-6 py-8 shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex rounded-full border-2 border-[#ea580c] bg-[#ea580c] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-white">
                Bảng đơn giá nhân sự
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">Thiết lập lương theo từng người</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#78716c]">
                Đây là nơi cấu hình tập trung cho dạy, trợ giảng và công hành chính. Khi đã cấu hình ở đây, Payroll sẽ tự tính đồng bộ và dễ kiểm soát hơn nhiều.
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 px-5 py-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a3412]">Tóm tắt</p>
              <p className="mt-2 text-lg font-black text-[#111827]">{items.length} nhân sự</p>
              <p className="mt-1 text-sm font-medium text-[#6b7280]">{missingCount} người đang thiếu đơn giá ảnh hưởng payroll</p>
            </div>
          </div>
        </div>
      </div>

      {canUpdateWithOverride("hr", access.role, access.override) ? (
        <PayrollRatesWorkspace items={items} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm font-medium text-amber-800">
          Bạn có quyền xem nhưng không có quyền sửa đơn giá.
        </div>
      )}

      <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-[#111827]">Quy tắc vận hành</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
            <p className="text-sm font-black text-blue-800">Dạy / Trợ giảng</p>
            <p className="mt-2 text-sm leading-6 text-blue-900">
              Chọn theo giờ nếu trả theo thời lượng thực tế. Chọn theo ca nếu mỗi buổi là một mức cố định.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-sm font-black text-emerald-800">Công hành chính</p>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Đơn giá 1 công HC được nhân trực tiếp với số công chấm trong kỳ để ra phần lương hành chính.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-sm font-black text-amber-800">Mục tiêu</p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Cấu hình một lần theo từng người, sau đó chỉ cần chấm công và hoàn thành buổi học là Payroll tự tính.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
