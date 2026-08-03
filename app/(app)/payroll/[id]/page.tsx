import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canViewFullWithOverride } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import {
  PAYROLL_RUN_STATUS_LABEL,
  SESSION_ROLE_LABEL,
  canEditPayroll,
} from "@/lib/server/payroll-rules";
import { monthRange } from "@/lib/server/tuition-rules";
import PayrollRunActions from "@/components/payroll/PayrollRunActions";
import PayrollLineEditor from "@/components/payroll/PayrollLineEditor";
import AddPayrollLineForm from "@/components/payroll/AddPayrollLineForm";
import PayrollRunExportButton from "@/components/payroll/PayrollRunExportButton";

const PAYROLL_WORKFLOW = [
  {
    status: "DRAFT",
    step: "Bước 0",
    title: "Tạo kỳ lương",
    description: "Khởi tạo kỳ lương theo tháng.",
  },
  {
    status: "CALCULATED",
    step: "Bước 1",
    title: "Tính lương",
    description: "Lấy dữ liệu buổi dạy, trợ giảng và chấm công.",
  },
  {
    status: "REVIEWED",
    step: "Bước 2",
    title: "Soát dữ liệu",
    description: "Kiểm tra giờ, công và các điều chỉnh.",
  },
  {
    status: "APPROVED",
    step: "Bước 3",
    title: "Duyệt",
    description: "Chốt số liệu để chuẩn bị chi lương.",
  },
  {
    status: "LOCKED",
    step: "Bước 4",
    title: "Khóa kỳ",
    description: "Ngừng chỉnh sửa trước khi trả lương.",
  },
  {
    status: "PAID",
    step: "Bước 5",
    title: "Đã trả",
    description: "Xác nhận đã chi lương thực tế.",
  },
] as const;

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatMetric(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function isClose(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

function statusBadgeClass(status: string) {
  if (status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOCKED") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "APPROVED") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "REVIEWED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "CALCULATED") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-stone-200 bg-stone-50 text-stone-700";
}

export default async function PayrollRunDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const access = await getUserRoleAndOverride(user.id, "hr");
  if (!canViewFullWithOverride("hr", access.role, access.override)) notFound();

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: {
      lines: {
        include: { employee: true },
        orderBy: { employee: { fullName: "asc" } },
      },
    },
  });
  if (!run) notFound();
  if (!(await canAccessBranch(run.branchId))) notFound();

  const editable = canEditPayroll(run.status);
  const totalPayroll = run.lines.reduce((sum, line) => sum + line.totalAmount, 0);
  const totalBaseSalary = run.lines.reduce(
    (sum, line) => sum + line.baseSalaryAmount,
    0,
  );
  const totalTeachingHours = run.lines.reduce(
    (sum, line) => sum + line.teachingHours,
    0,
  );
  const totalAssistantHours = run.lines.reduce(
    (sum, line) => sum + line.assistantHours,
    0,
  );
  const totalStaffDays = run.lines.reduce((sum, line) => sum + line.staffDays, 0);
  const totalBonus = run.lines.reduce((sum, line) => sum + line.bonus, 0);
  const totalPenalty = run.lines.reduce((sum, line) => sum + line.penalty, 0);
  const totalSourceAmount =
    totalPayroll - totalBaseSalary - totalBonus + totalPenalty;

  const eligibleEmployees = editable
    ? await prisma.employee.findMany({
        where: {
          branchId: run.branchId,
          resignDate: null,
          id: { notIn: run.lines.map((line) => line.employeeId) },
        },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      })
    : [];

  const { start, end } = monthRange(run.periodName);
  const employeeIds = run.lines.map((line) => line.employeeId);

  const [allAssignments, allTimesheetEntries] = await Promise.all([
    prisma.sessionAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        session: {
          sessionDate: { gte: start, lte: end },
          status: "COMPLETED",
        },
      },
      include: { session: { include: { class: true } } },
      orderBy: { session: { sessionDate: "asc" } },
    }),
    prisma.timesheetEntry.findMany({
      where: {
        employeeId: { in: employeeIds },
        workDate: { gte: start, lte: end },
      },
      orderBy: { workDate: "asc" },
    }),
  ]);

  const missingTeachingConfigCount = run.lines.filter(
    (line) =>
      line.teachingHours > 0 && line.employee.teachingHourlyRate == null,
  ).length;
  const missingAssistantConfigCount = run.lines.filter(
    (line) =>
      line.assistantHours > 0 && line.employee.assistantHourlyRate == null,
  ).length;
  const missingStaffConfigCount = run.lines.filter(
    (line) => line.staffDays > 0 && line.employee.staffDailyRate == null,
  ).length;

  const currentStepIndex = Math.max(
    PAYROLL_WORKFLOW.findIndex((item) => item.status === run.status),
    0,
  );

  const hasMismatch = run.lines.some((line) => {
    const assignments = allAssignments.filter(
      (assignment) => assignment.employeeId === line.employeeId,
    );
    const teaching = assignments.filter(
      (assignment) => assignment.role === "TEACHER",
    );
    const assisting = assignments.filter(
      (assignment) =>
        assignment.role === "ASSISTANT" || assignment.role === "ASSISTANT2",
    );
    const timesheetEntries = allTimesheetEntries.filter(
      (entry) => entry.employeeId === line.employeeId,
    );

    const liveTeachingHours = teaching.reduce(
      (sum, assignment) => sum + (assignment.hours ?? 0),
      0,
    );
    const liveAssistantHours = assisting.reduce(
      (sum, assignment) => sum + (assignment.hours ?? 0),
      0,
    );
    const liveStaffDays = timesheetEntries.reduce(
      (sum, entry) => sum + (entry.days ?? 0),
      0,
    );

    return (
      !isClose(liveTeachingHours, line.teachingHours) ||
      !isClose(liveAssistantHours, line.assistantHours) ||
      !isClose(liveStaffDays, line.staffDays)
    );
  });

  const checklistItems = [
    {
      label: "Đã có nhân sự trong kỳ lương",
      done: run.lines.length > 0,
      help:
        run.lines.length > 0
          ? `${run.lines.length} nhân sự đã có trong kỳ.`
          : "Kỳ này chưa có dòng lương nào.",
    },
    {
      label: "Đã cấu hình đơn giá dạy",
      done: missingTeachingConfigCount === 0,
      help:
        missingTeachingConfigCount === 0
          ? "Không có ai thiếu đơn giá dạy."
          : `${missingTeachingConfigCount} người đang dạy nhưng chưa có đơn giá.`,
    },
    {
      label: "Đã cấu hình đơn giá trợ giảng",
      done: missingAssistantConfigCount === 0,
      help:
        missingAssistantConfigCount === 0
          ? "Không có ai thiếu đơn giá trợ giảng."
          : `${missingAssistantConfigCount} người đang trợ giảng nhưng chưa có đơn giá.`,
    },
    {
      label: "Đã cấu hình đơn giá công hành chính",
      done: missingStaffConfigCount === 0,
      help:
        missingStaffConfigCount === 0
          ? "Không có ai thiếu đơn giá công hành chính."
          : `${missingStaffConfigCount} người có công hành chính nhưng chưa có đơn giá.`,
    },
    {
      label: "Số liệu nguồn đang khớp",
      done: !hasMismatch,
      help: !hasMismatch
        ? "Giờ dạy, giờ trợ giảng và công hành chính đều khớp dữ liệu gốc."
        : "Có dòng lương đang lệch dữ liệu gốc. Nên bấm tính lại trước khi duyệt.",
    },
  ];

  const checklistReadyCount = checklistItems.filter((item) => item.done).length;
  const isChecklistReady = checklistItems.every((item) => item.done);

  return (
    <div className="min-h-screen space-y-6 pb-20">
      <div className="space-y-4">
        <Link
          href="/payroll"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#6b7280] transition-colors hover:text-[#f97316]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại payroll
        </Link>

        <div className="rounded-[28px] border-2 border-[#fed7aa] bg-gradient-to-r from-[#fff7ed] via-white to-[#fff7ed] px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-[#fdba74] bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#c2410c]">
                Kỳ lương
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-[#111827]">
                {run.periodName}
              </h1>
              <p className="mt-2 text-sm text-[#6b7280]">
                {run.lines.length} nhân sự • Tổng lương {formatVnd(totalPayroll)}
              </p>
            </div>

            <span
              className={`inline-flex rounded-xl border px-4 py-2 text-sm font-bold ${statusBadgeClass(
                run.status,
              )}`}
            >
              {PAYROLL_RUN_STATUS_LABEL[run.status] ?? run.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border-2 border-[#e5e7eb] bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f97316]">
            Checklist bắt buộc
          </p>
          <h2 className="mt-2 text-xl font-black text-[#111827]">
            Chốt lương theo từng bước
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6b7280]">
            Mục tiêu là để người không chuyên chỉ cần đi tuần tự: tính lương →
            kiểm tra → duyệt → khóa → đánh dấu đã trả.
          </p>

          <div className="mt-4 rounded-2xl border border-[#fed7aa] bg-[#fffaf5] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[#111827]">Mức độ sẵn sàng</p>
                <p className="mt-1 text-sm text-[#6b7280]">
                  Hoàn thành {checklistReadyCount}/{checklistItems.length} mục trước
                  khi chốt kỳ lương.
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-4 py-2 text-sm font-black ${
                  isChecklistReady
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {isChecklistReady ? "Sẵn sàng duyệt" : "Chưa nên chốt"}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {checklistItems.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border px-4 py-3 ${
                    item.done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                        item.done
                          ? "bg-emerald-600 text-white"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      {item.done ? "✓" : "!"}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#111827]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#6b7280]">
                        {item.help}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PAYROLL_WORKFLOW.map((item, index) => {
              const completed = index < currentStepIndex;
              const active = index === currentStepIndex;

              return (
                <div
                  key={item.status}
                  className={`rounded-2xl border px-4 py-4 ${
                    active
                      ? "border-[#fdba74] bg-[#fff7ed]"
                      : completed
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-[#e5e7eb] bg-[#fafafa]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9ca3af]">
                        {item.step}
                      </p>
                      <p className="mt-1 text-base font-black text-[#111827]">
                        {item.title}
                      </p>
                    </div>
                    <span
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-black ${
                        active
                          ? "bg-[#f97316] text-white"
                          : completed
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-[#9ca3af]"
                      }`}
                    >
                      {completed ? "✓" : index + 1}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border-2 border-[#fed7aa] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f97316]">
              Công thức tổng lương
            </p>
            <h2 className="mt-2 text-xl font-black text-[#111827]">
              Người dùng sẽ thấy lương được tính như thế nào
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#6b7280]">
              Tổng lương = tiền dạy + tiền trợ giảng + lương cứng + thưởng - phạt.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-[#e5e7eb] px-4 py-3">
                <span className="text-sm text-[#6b7280]">Tiền dạy + trợ giảng</span>
                <span className="text-sm font-black text-[#111827]">
                  {formatVnd(totalSourceAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[#e5e7eb] px-4 py-3">
                <span className="text-sm text-[#6b7280]">Lương cứng</span>
                <span className="text-sm font-black text-[#111827]">
                  {formatVnd(totalBaseSalary)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[#e5e7eb] px-4 py-3">
                <span className="text-sm text-[#6b7280]">Thưởng</span>
                <span className="text-sm font-black text-emerald-600">
                  + {formatVnd(totalBonus)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[#e5e7eb] px-4 py-3">
                <span className="text-sm text-[#6b7280]">Phạt</span>
                <span className="text-sm font-black text-rose-600">
                  - {formatVnd(totalPenalty)}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-[#111827] px-4 py-4 text-white">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Tổng cuối cùng
              </p>
              <p className="mt-2 text-2xl font-black">{formatVnd(totalPayroll)}</p>
            </div>
          </div>

          <div className="rounded-3xl border-2 border-[#e5e7eb] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f97316]">
              Xuất file và bổ sung tay
            </p>
            <h2 className="mt-2 text-xl font-black text-[#111827]">
              Chỉ mở khi thật sự cần
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#6b7280]">
              Mặc định người dùng chỉ cần làm theo checklist. Các tác vụ phụ được
              gom riêng ở đây để đỡ rối.
            </p>

            <div className="mt-4">
              <PayrollRunExportButton
                runId={run.id}
              />
            </div>

            {editable && eligibleEmployees.length > 0 ? (
              <details className="mt-4 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
                <summary className="cursor-pointer text-sm font-bold text-[#6b7280]">
                  Thêm thủ công nhân sự còn thiếu
                </summary>
                <div className="mt-3">
                  <AddPayrollLineForm
                    payrollRunId={run.id}
                    employeeOptions={eligibleEmployees}
                  />
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </div>

      {hasMismatch ? (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-600">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-900">
                Phát hiện số liệu lệch
              </h3>
              <p className="mt-2 text-sm text-amber-800">
                Một số dòng lương đang khác với dữ liệu gốc. Nên bấm “Tính lại
                lương” trước khi duyệt hoặc khóa kỳ.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <PayrollRunActions
          runId={run.id}
          status={run.status}
          checklistReady={isChecklistReady}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Nhân sự
            </p>
            <p className="mt-2 text-3xl font-black text-[#111827]">
              {run.lines.length}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Giờ dạy + trợ giảng
            </p>
            <p className="mt-2 text-3xl font-black text-[#111827]">
              {formatMetric(totalTeachingHours + totalAssistantHours)}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Công hành chính
            </p>
            <p className="mt-2 text-3xl font-black text-[#111827]">
              {formatMetric(totalStaffDays)}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Lương cứng
            </p>
            <p className="mt-2 text-2xl font-black text-[#111827]">
              {formatVnd(totalBaseSalary)}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Thưởng
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-600">
              {formatVnd(totalBonus)}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
              Phạt
            </p>
            <p className="mt-2 text-2xl font-black text-rose-600">
              {formatVnd(totalPenalty)}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-[#e5e7eb] bg-white shadow-sm">
        <div className="border-b border-[#f3f4f6] px-6 py-5">
          <h2 className="text-xl font-bold text-[#111827]">
            Chi tiết lương từng nhân sự
          </h2>
          <p className="mt-1 text-sm text-[#6b7280]">
            Dòng trên để chốt lương nhanh. Mở phần chi tiết chỉ khi cần kiểm tra
            nguồn tính lương.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-[#f3f4f6] bg-[#fafafa]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Nhân sự
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Nguồn lương
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Lương cứng
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Điều chỉnh
                </th>
                <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Tổng
                </th>
                {editable ? (
                  <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-[#6b7280]">
                    Sửa
                  </th>
                ) : null}
              </tr>
            </thead>

            {run.lines.map((line) => {
              const assignments = allAssignments.filter(
                (assignment) => assignment.employeeId === line.employeeId,
              );
              const teaching = assignments.filter(
                (assignment) => assignment.role === "TEACHER",
              );
              const assisting = assignments.filter(
                (assignment) =>
                  assignment.role === "ASSISTANT" ||
                  assignment.role === "ASSISTANT2",
              );
              const timesheetEntries = allTimesheetEntries.filter(
                (entry) => entry.employeeId === line.employeeId,
              );

              const liveTeachingHours = teaching.reduce(
                (sum, assignment) => sum + (assignment.hours ?? 0),
                0,
              );
              const liveAssistantHours = assisting.reduce(
                (sum, assignment) => sum + (assignment.hours ?? 0),
                0,
              );
              const liveStaffDays = timesheetEntries.reduce(
                (sum, entry) => sum + (entry.days ?? 0),
                0,
              );

              const mismatch =
                !isClose(liveTeachingHours, line.teachingHours) ||
                !isClose(liveAssistantHours, line.assistantHours) ||
                !isClose(liveStaffDays, line.staffDays);

              return (
                <tbody key={line.id}>
                  <tr
                    className={`border-b border-[#f3f4f6] ${
                      mismatch ? "bg-amber-50/50" : "bg-white"
                    }`}
                  >
                    <td className="px-6 py-5 align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f97316] text-sm font-black text-white">
                          {line.employee.fullName.charAt(0)}
                        </div>
                        <div>
                          <Link
                            href={`/payroll/employees/${line.employeeId}`}
                            className="font-bold text-[#111827] transition-colors hover:text-[#f97316]"
                          >
                            {line.employee.fullName}
                          </Link>
                          <p className="mt-1 text-xs text-[#6b7280]">
                            {line.employee.employeeCode}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-5 align-top">
                      <div className="space-y-2">
                        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
                            Dạy chính
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#111827]">
                            {formatMetric(line.teachingHours)} giờ •{" "}
                            {formatVnd(line.teachingAmount)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-700">
                            Trợ giảng
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#111827]">
                            {formatMetric(line.assistantHours)} giờ •{" "}
                            {formatVnd(line.assistantAmount)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-5 align-top">
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                          Lương cứng
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#111827]">
                          {formatVnd(line.baseSalaryAmount)}
                        </p>
                        <p className="mt-1 text-xs text-[#6b7280]">
                          Công hành chính: {formatMetric(line.staffDays)}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-5 align-top">
                      <div className="space-y-2">
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                            Thưởng
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#111827]">
                            + {formatVnd(line.bonus)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-700">
                            Phạt
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#111827]">
                            - {formatVnd(line.penalty)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-5 text-right align-top">
                      <p className="text-xl font-black text-[#f97316]">
                        {formatVnd(line.totalAmount)}
                      </p>
                      <p className="mt-1 text-xs text-[#6b7280]">
                        Dạy + trợ giảng + lương cứng + thưởng - phạt
                      </p>
                    </td>

                    {editable ? (
                      <td className="px-6 py-5 text-right align-top">
                        <PayrollLineEditor
                          lineId={line.id}
                          bonus={line.bonus}
                          penalty={line.penalty}
                          employeeName={line.employee.fullName}
                        />
                      </td>
                    ) : null}
                  </tr>

                  <tr className="border-b border-[#f3f4f6] bg-[#fafafa]">
                    <td colSpan={editable ? 6 : 5} className="px-6 py-4">
                      <details className="group/details">
                        <summary className="flex cursor-pointer items-center gap-3 text-sm font-bold text-[#6b7280] transition-colors hover:text-[#f97316]">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="transition-transform group-open/details:rotate-90"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          <span>
                            Xem dữ liệu gốc ({assignments.length} buổi dạy/trợ
                            giảng • {timesheetEntries.length} ngày công)
                          </span>
                          {mismatch ? (
                            <span className="ml-2 inline-flex items-center rounded-lg border border-red-300 bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                              Đang lệch dữ liệu
                            </span>
                          ) : null}
                        </summary>

                        <div className="mt-4 space-y-4">
                          {teaching.length > 0 ? (
                            <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                              <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#6b7280]">
                                Buổi dạy chính • Tổng {formatMetric(liveTeachingHours)} giờ
                                {!isClose(liveTeachingHours, line.teachingHours) ? (
                                  <span className="text-red-600">
                                    {" "}
                                    (dòng lương đang ghi {formatMetric(line.teachingHours)} giờ)
                                  </span>
                                ) : null}
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="border-b border-[#f3f4f6] bg-[#fafafa]">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-bold text-[#6b7280]">
                                        Ngày
                                      </th>
                                      <th className="px-3 py-2 text-left font-bold text-[#6b7280]">
                                        Lớp
                                      </th>
                                      <th className="px-3 py-2 text-center font-bold text-[#6b7280]">
                                        Giờ
                                      </th>
                                      <th className="px-3 py-2 text-center font-bold text-[#6b7280]">
                                        Trừ
                                      </th>
                                      <th className="px-3 py-2 text-center font-bold text-[#6b7280]">
                                        Cộng
                                      </th>
                                      <th className="px-3 py-2 text-right font-bold text-[#6b7280]">
                                        Tiền
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#f3f4f6]">
                                    {teaching.map((assignment) => (
                                      <tr key={assignment.id}>
                                        <td className="px-3 py-2 font-medium text-[#111827]">
                                          {formatDate(assignment.session.sessionDate)}
                                        </td>
                                        <td className="px-3 py-2 text-[#6b7280]">
                                          {assignment.session.class.className}
                                        </td>
                                        <td className="px-3 py-2 text-center font-semibold text-[#111827]">
                                          {assignment.hours}
                                        </td>
                                        <td className="px-3 py-2 text-center text-rose-600">
                                          {assignment.deductedHours || "—"}
                                        </td>
                                        <td className="px-3 py-2 text-center text-emerald-600">
                                          {assignment.addedHours || "—"}
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-[#6b7280]">
                                          {formatVnd(assignment.amount ?? 0)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}

                          {assisting.length > 0 ? (
                            <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                              <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#6b7280]">
                                Buổi trợ giảng • Tổng {formatMetric(liveAssistantHours)} giờ
                                {!isClose(liveAssistantHours, line.assistantHours) ? (
                                  <span className="text-red-600">
                                    {" "}
                                    (dòng lương đang ghi {formatMetric(line.assistantHours)} giờ)
                                  </span>
                                ) : null}
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="border-b border-[#f3f4f6] bg-[#fafafa]">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-bold text-[#6b7280]">
                                        Ngày
                                      </th>
                                      <th className="px-3 py-2 text-left font-bold text-[#6b7280]">
                                        Lớp
                                      </th>
                                      <th className="px-3 py-2 text-center font-bold text-[#6b7280]">
                                        Vai trò
                                      </th>
                                      <th className="px-3 py-2 text-center font-bold text-[#6b7280]">
                                        Giờ
                                      </th>
                                      <th className="px-3 py-2 text-center font-bold text-[#6b7280]">
                                        Trừ
                                      </th>
                                      <th className="px-3 py-2 text-center font-bold text-[#6b7280]">
                                        Cộng
                                      </th>
                                      <th className="px-3 py-2 text-right font-bold text-[#6b7280]">
                                        Tiền
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#f3f4f6]">
                                    {assisting.map((assignment) => (
                                      <tr key={assignment.id}>
                                        <td className="px-3 py-2 font-medium text-[#111827]">
                                          {formatDate(assignment.session.sessionDate)}
                                        </td>
                                        <td className="px-3 py-2 text-[#6b7280]">
                                          {assignment.session.class.className}
                                        </td>
                                        <td className="px-3 py-2 text-center text-[#6b7280]">
                                          {SESSION_ROLE_LABEL[assignment.role] ??
                                            assignment.role}
                                        </td>
                                        <td className="px-3 py-2 text-center font-semibold text-[#111827]">
                                          {assignment.hours}
                                        </td>
                                        <td className="px-3 py-2 text-center text-rose-600">
                                          {assignment.deductedHours || "—"}
                                        </td>
                                        <td className="px-3 py-2 text-center text-emerald-600">
                                          {assignment.addedHours || "—"}
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-[#6b7280]">
                                          {formatVnd(assignment.amount ?? 0)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}

                          {timesheetEntries.length > 0 ? (
                            <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                              <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#6b7280]">
                                Công hành chính • Tổng {formatMetric(liveStaffDays)} công
                                {!isClose(liveStaffDays, line.staffDays) ? (
                                  <span className="text-red-600">
                                    {" "}
                                    (dòng lương đang ghi {formatMetric(line.staffDays)} công)
                                  </span>
                                ) : null}
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="border-b border-[#f3f4f6] bg-[#fafafa]">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-bold text-[#6b7280]">
                                        Ngày
                                      </th>
                                      <th className="px-3 py-2 text-center font-bold text-[#6b7280]">
                                        Giờ
                                      </th>
                                      <th className="px-3 py-2 text-right font-bold text-[#6b7280]">
                                        Công
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#f3f4f6]">
                                    {timesheetEntries.map((entry) => (
                                      <tr key={entry.id}>
                                        <td className="px-3 py-2 font-medium text-[#111827]">
                                          {formatDate(entry.workDate)}
                                        </td>
                                        <td className="px-3 py-2 text-center text-[#6b7280]">
                                          {entry.hours}
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-[#111827]">
                                          {entry.days}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}

                          {assignments.length === 0 && timesheetEntries.length === 0 ? (
                            <div className="rounded-xl border border-[#e5e7eb] bg-white px-6 py-8 text-center text-sm text-[#6b7280]">
                              Không có buổi dạy, trợ giảng hoặc chấm công nào trong kỳ
                              này.
                            </div>
                          ) : null}
                        </div>
                      </details>
                    </td>
                  </tr>
                </tbody>
              );
            })}

            {run.lines.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={editable ? 6 : 5} className="px-6 py-16 text-center">
                    <div className="space-y-2">
                      <p className="text-base font-semibold text-[#111827]">
                        Chưa có dòng lương nào
                      </p>
                      <p className="text-sm text-[#6b7280]">
                        Hãy dùng nút “Tính lại lương từ dữ liệu gốc” để tạo dữ liệu
                        ban đầu.
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
