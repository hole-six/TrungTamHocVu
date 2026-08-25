import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_ROLE_LABEL, computeContractStatus } from "@/lib/server/payroll-rules";
import PayrollEmployeeEditPanels from "@/components/payroll/PayrollEmployeeEditPanels";
import PageGuide from "@/components/ui/PageGuide";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column } from "@/components/ui/DataTable";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreate, canUpdateWithOverride, canViewFullWithOverride } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { formatVnd } from "@/lib/export-utils";

type RequirementCheckRow = {
  id: string;
  sessionDate: string;
  className: string;
  classId: string;
  sessionId: string;
  requirementText: string;
  status: string;
  deductedPoints: number | null;
};

const REQUIREMENT_CHECK_COLUMNS: Column<RequirementCheckRow>[] = [
  { key: "sessionDate", label: "Ngày buổi học", sortable: true },
  { key: "className", label: "Lớp" },
  {
    key: "requirementText",
    label: "Yêu cầu",
    render: (value: string) => <p className="line-clamp-2 max-w-xs text-sm text-ink-muted80">{value}</p>,
  },
  {
    key: "status",
    label: "Trạng thái",
    render: (value: string) => (
      <span className={`badge ${value === "SUBMITTED" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
        {value === "SUBMITTED" ? "Đã nộp" : "Chưa nộp"}
      </span>
    ),
  },
  {
    key: "deductedPoints",
    label: "Điểm trừ",
    render: (value: number | null) => (value != null ? <span className="font-bold text-rose-600">-{value}</span> : <span className="text-ink-muted48">—</span>),
  },
];

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

const EMPLOYEE_DETAIL_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu trang này",
    items: [
      "Đây là hồ sơ nhân sự chi tiết: buổi dạy, buổi trợ giảng, chấm công và thông tin lương cơ bản của một người.",
      "Trang này dùng để đối chiếu dữ liệu làm việc thực tế trước khi chốt payroll.",
      "Nếu số liệu lương đang lệch, đây là nơi nên mở đầu tiên để kiểm tra nguồn công gốc.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách dùng nhanh",
    items: [
      "Xem bảng buổi dạy/trợ giảng để biết nhân viên đã phát sinh công việc và tiền theo buổi ra sao.",
      "Xem bảng chấm công ngày để đối chiếu thêm số giờ, số công ngoài hoạt động giảng dạy.",
      "Dùng khối bên phải để cập nhật hồ sơ hoặc thêm chấm công nhanh khi bạn có quyền thao tác.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Số liệu ở đây là dữ liệu gốc cho payroll nên không nên sửa tay nếu chưa hiểu nó đến từ đâu.",
      "Hết hạn hợp đồng là cảnh báo vận hành, không tự động có nghĩa là người đó không còn phát sinh công.",
      "Nếu nhân viên vừa có buổi dạy vừa có chấm công hành chính, cần đối chiếu cả hai nguồn trước khi chốt.",
    ],
    tone: "warning" as const,
  },
];

const EMPLOYEE_DETAIL_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="employee-header"]',
    title: "Hồ sơ nhân sự — nguồn công gốc cho lương",
    description: "Cảnh báo hợp đồng ở đây chỉ là nhắc việc, không tự động ảnh hưởng đến việc tính công/lương của người này.",
    placement: "bottom",
  },
  {
    target: '[data-tour="employee-sessions"]',
    title: "Buổi dạy/trợ giảng — tự sinh từ phân công lớp",
    description: "Không nhập tay: mỗi khi được phân công dạy/trợ giảng một buổi, dòng này tự xuất hiện với số giờ và tiền tính theo đơn giá + payMode (theo ca hoặc theo giờ).",
    placement: "right",
  },
  {
    target: '[data-tour="employee-timesheet"]',
    title: "Chấm công ngày — riêng cho công hành chính",
    description: "Tách biệt hoàn toàn với buổi dạy — chỉ cộng thêm khi người này có làm việc hành chính ngoài giờ dạy.",
    placement: "right",
  },
  {
    target: '[data-tour="employee-summary"]',
    title: "Đơn giá áp dụng cho người này",
    description: "Đơn giá dạy/TG/công HC ở đây là nguồn tính tiền cho mọi buổi/công phía trên — đổi đơn giá không ảnh hưởng ngược lại các dòng đã tính trong kỳ lương đã chốt.",
    placement: "left",
  },
];

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();
  const access = await getUserRoleAndOverride(currentUser.id, "hr");
  const isSelf = currentUser?.employeeId === params.id;
  const canManageFromMainPayroll =
    !isSelf && (canViewFullWithOverride("hr", access.role, access.override) || canUpdateWithOverride("hr", access.role, access.override));

  if (canManageFromMainPayroll) {
    redirect(`/payroll?employeeId=${params.id}`);
  }

  if (!isSelf && !canViewFullWithOverride("hr", access.role, access.override)) notFound();

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      sessionAssignments: { include: { session: { include: { class: true } } }, orderBy: { id: "desc" } },
      timesheetEntries: { orderBy: { workDate: "desc" } },
      contracts: { orderBy: { signDate: "desc" }, take: 1 },
    },
  });
  if (!employee) notFound();
  if (!(await canAccessBranch(employee.branchId))) notFound();

  const contractStatus = computeContractStatus(employee.resignDate, employee.contracts[0]?.expiryDate ?? null);

  // Cùng shape truy vấn với /teacher-tasks (xem app/(app)/teacher-tasks/page.tsx), thu hẹp
  // về đúng 1 nhân sự này để hiển thị lịch sử "việc đã nộp/chưa nộp" ngay tại hồ sơ.
  const requirementChecks = await prisma.sessionRequirementCheck.findMany({
    where: { employeeId: params.id },
    include: {
      session: { select: { id: true, classId: true, sessionDate: true, class: { select: { className: true } } } },
      scoreEvent: { select: { points: true, type: true } },
    },
    orderBy: { checkedAt: "desc" },
    take: 100,
  });

  const requirementCheckRows: RequirementCheckRow[] = requirementChecks.map((item) => ({
    id: item.id,
    sessionDate: formatDate(item.session.sessionDate),
    className: item.session.class.className,
    classId: item.session.classId,
    sessionId: item.session.id,
    requirementText: item.requirementText,
    status: item.status,
    deductedPoints: item.scoreEvent && item.scoreEvent.type === "DEDUCT" ? item.scoreEvent.points : null,
  }));

  return (
    <div className="space-y-6">
      <PageGuide
        title="Guide hồ sơ nhân sự"
        summary="Giải thích nhanh cách đọc buổi dạy, chấm công và thông tin lương của từng nhân viên."
        sections={EMPLOYEE_DETAIL_GUIDE_SECTIONS}
        buttonLabel="Guide nhân sự"
      />
      <div className="flex items-start justify-between gap-3" data-tour="employee-header">
        <div>
          <Link href="/payroll" className="text-sm text-primary">
            ← Quay lại Nhân sự & Lương
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{employee.fullName}</h1>
          <p className="mt-1 text-sm text-ink-muted48">
            Mã NV: {employee.employeeCode} · Tên ngắn: {employee.shortName} · {employee.position ?? "—"}
          </p>
          {contractStatus === "Đã hết hạn HĐ" && <span className="badge-red mt-2 inline-flex">Đã hết hạn HĐ</span>}
          {contractStatus === "Sắp hết hạn HĐ" && <span className="badge-amber mt-2 inline-flex">Sắp hết hạn HĐ</span>}
        </div>
        <SpotlightTour steps={EMPLOYEE_DETAIL_TOUR_STEPS} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Sessions Table - Desktop: Table, Mobile: Cards */}
          <div className="card" data-tour="employee-sessions">
            <h2 className="font-display text-lg font-semibold tracking-tight mb-3">Tất cả buổi dạy/trợ giảng ({employee.sessionAssignments.length})</h2>
            
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                  <tr>
                    <th className="py-2 font-medium">Ngày</th>
                    <th className="py-2 font-medium">Lớp</th>
                    <th className="py-2 font-medium">Vai trò</th>
                    <th className="py-2 font-medium">Giờ</th>
                    <th className="py-2 font-medium">Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.sessionAssignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-hairline last:border-0">
                      <td className="py-2">{formatDate(assignment.session.sessionDate)}</td>
                      <td className="py-2 text-ink-muted80">{assignment.session.class.className}</td>
                      <td className="py-2 text-ink-muted80">{SESSION_ROLE_LABEL[assignment.role] ?? assignment.role}</td>
                      <td className="py-2 text-ink-muted80">{assignment.hours}</td>
                      <td className="py-2 font-medium">{formatVnd(assignment.amount ?? 0)}</td>
                    </tr>
                  ))}
                  {employee.sessionAssignments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-ink-muted48">
                        Chưa được phân công buổi dạy nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {employee.sessionAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-xl border border-hairline bg-canvas-parchment/40 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink text-sm">{assignment.session.class.className}</p>
                      <p className="text-xs text-ink-muted48 mt-0.5">{formatDate(assignment.session.sessionDate)}</p>
                    </div>
                    <span className="inline-flex rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary whitespace-nowrap">
                      {SESSION_ROLE_LABEL[assignment.role] ?? assignment.role}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-hairline">
                    <div>
                      <p className="text-xs text-ink-muted48">Số giờ</p>
                      <p className="font-semibold text-ink text-sm">{assignment.hours} giờ</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-muted48">Thù lao</p>
                      <p className="font-bold text-primary text-sm">{formatVnd(assignment.amount ?? 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {employee.sessionAssignments.length === 0 && (
                <div className="py-8 text-center text-sm text-ink-muted48 bg-canvas-parchment/30 rounded-xl border border-dashed border-hairline">
                  Chưa được phân công buổi dạy nào.
                </div>
              )}
            </div>
          </div>

          {/* Timesheet Table - Desktop: Table, Mobile: Cards */}
          <div className="card" data-tour="employee-timesheet">
            <h2 className="font-display text-lg font-semibold tracking-tight mb-3">Tất cả chấm công ngày ({employee.timesheetEntries.length})</h2>
            
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                  <tr>
                    <th className="py-2 font-medium">Ngày</th>
                    <th className="py-2 font-medium">Giờ</th>
                    <th className="py-2 font-medium">Công</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.timesheetEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-hairline last:border-0">
                      <td className="py-2">{formatDate(entry.workDate)}</td>
                      <td className="py-2 text-ink-muted80">{entry.hours}</td>
                      <td className="py-2 font-medium">{entry.days}</td>
                    </tr>
                  ))}
                  {employee.timesheetEntries.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-ink-muted48">
                        Chưa có chấm công nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {employee.timesheetEntries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-hairline bg-canvas-parchment/40 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-ink text-sm">{formatDate(entry.workDate)}</p>
                      <p className="text-xs text-ink-muted48 mt-0.5">{entry.hours} giờ</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-muted48">Số công</p>
                      <p className="font-bold text-primary text-lg">{entry.days}</p>
                    </div>
                  </div>
                </div>
              ))}
              {employee.timesheetEntries.length === 0 && (
                <div className="py-8 text-center text-sm text-ink-muted48 bg-canvas-parchment/30 rounded-xl border border-dashed border-hairline">
                  Chưa có chấm công nào.
                </div>
              )}
            </div>
          </div>

          {/* Việc giáo viên cần làm — nộp/chưa nộp theo buổi (xem thêm /teacher-tasks) */}
          <div className="card" data-tour="employee-requirement-checks">
            <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
              Việc giáo viên cần làm theo buổi ({requirementCheckRows.length})
            </h2>
            <DataTableResponsive
              data={requirementCheckRows}
              columns={REQUIREMENT_CHECK_COLUMNS}
              rowKey="id"
              primaryColumn="sessionDate"
              secondaryColumns={["className", "status"]}
              sortable
              emptyState={{
                title: "Chưa có xác nhận nào",
                description: "Các xác nhận sẽ xuất hiện khi trợ giảng đánh dấu tại từng buổi học.",
              }}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card" data-tour="employee-summary">
            <h2 className="font-display text-lg font-semibold tracking-tight">Công việc & Lương</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">Trạng thái làm việc</dt>
                <dd>
                  <span className={`badge ${employee.workStatus === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-ink/5 text-ink-muted48"}`}>
                    {employee.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">Ngày ký HĐ</dt>
                <dd className="font-medium">{employee.contracts[0]?.signDate ? formatDate(employee.contracts[0].signDate) : "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">Hạn HĐ</dt>
                <dd className="font-medium">{employee.contracts[0]?.expiryDate ? formatDate(employee.contracts[0].expiryDate) : "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">Kiểu tính dạy/TG</dt>
                <dd className="font-medium">{employee.payMode === "SESSION" ? "Theo ca" : "Theo giờ"}</dd>
              </div>
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">{employee.payMode === "SESSION" ? "Đơn giá dạy/ca" : "Đơn giá dạy/giờ"}</dt>
                <dd className="font-medium">{employee.teachingHourlyRate != null ? formatVnd(employee.teachingHourlyRate) : "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-hairline/60 py-1">
                <dt className="text-ink-muted48">{employee.payMode === "SESSION" ? "Đơn giá TG/ca" : "Đơn giá TG/giờ"}</dt>
                <dd className="font-medium">{employee.assistantHourlyRate != null ? formatVnd(employee.assistantHourlyRate) : "—"}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-ink-muted48">Đơn giá 1 công HC</dt>
                <dd className="font-medium">{employee.staffDailyRate != null ? formatVnd(employee.staffDailyRate) : "—"}</dd>
              </div>
            </dl>
          </div>

          <PayrollEmployeeEditPanels
            headerSummary={{
              fullName: employee.fullName,
              employeeCode: employee.employeeCode,
              position: employee.position,
              contractStatus,
              sourceLabel: null,
            }}
            profile={{
              id: employee.id,
              dob: employee.dob ? employee.dob.toISOString() : null,
              phone: employee.phone,
              email: employee.email,
              hometown: employee.hometown,
              permanentAddress: employee.permanentAddress,
              idNumber: employee.idNumber,
              idIssueDate: employee.idIssueDate ? employee.idIssueDate.toISOString() : null,
              idIssuePlace: employee.idIssuePlace,
              resignDate: employee.resignDate ? employee.resignDate.toISOString() : null,
              payMode: employee.payMode,
              teachingHourlyRate: employee.teachingHourlyRate,
              assistantHourlyRate: employee.assistantHourlyRate,
              staffDailyRate: employee.staffDailyRate,
              bankName: employee.bankName,
              bankAccountNumber: employee.bankAccountNumber,
              bankAccountHolder: employee.bankAccountHolder,
            }}
            canEditProfile={canUpdateWithOverride("hr", access.role, access.override)}
            canAddTimesheet={canCreate("timesheet", access.role) && (isSelf || canUpdateWithOverride("hr", access.role, access.override))}
            payrollLine={null}
            canEditPayrollLine={false}
            assistant={null}
          />
        </div>
      </div>
    </div>
  );
}
