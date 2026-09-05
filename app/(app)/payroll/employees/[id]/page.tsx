import BackButton from "@/components/ui/BackButton";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeContractStatus } from "@/lib/server/payroll-rules";
import PayrollEmployeeEditPanels from "@/components/payroll/PayrollEmployeeEditPanels";
import PageGuide from "@/components/ui/PageGuide";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreate, canUpdateWithOverride, canViewFullWithOverride } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";

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

// Trước đây trỏ vào 4 khối cột trái/phải (buổi dạy, chấm công, đơn giá) — các khối đó
// giờ đã chuyển vào trong PayrollEmployeeEditPanels (tab "Lịch sử"/"Thông tin cá nhân"),
// không còn nằm trực tiếp ở page này với data-tour riêng — thu gọn tour lại đúng những
// gì còn ở page, tránh trỏ vào target không tồn tại.
const EMPLOYEE_DETAIL_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="employee-header"]',
    title: "Hồ sơ nhân sự — nguồn công gốc cho lương",
    description: "Cảnh báo hợp đồng ở đây chỉ là nhắc việc, không tự động ảnh hưởng đến việc tính công/lương của người này. Buổi dạy, chấm công, đơn giá và lịch sử đều đã chia theo tab bên dưới.",
    placement: "bottom",
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
          <BackButton href="/payroll" className="text-sm text-primary">
            ← Quay lại Nhân sự & Lương
          </BackButton>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{employee.fullName}</h1>
          <p className="mt-1 text-sm text-ink-muted48">
            Mã NV: {employee.employeeCode} · Tên ngắn: {employee.shortName} · {employee.position ?? "—"}
          </p>
          {contractStatus === "Đã hết hạn HĐ" && <span className="badge-red mt-2 inline-flex">Đã hết hạn HĐ</span>}
          {contractStatus === "Sắp hết hạn HĐ" && <span className="badge-amber mt-2 inline-flex">Sắp hết hạn HĐ</span>}
        </div>
        <SpotlightTour steps={EMPLOYEE_DETAIL_TOUR_STEPS} />
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
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          position: employee.position,
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
        history={{
          sessionAssignments: employee.sessionAssignments.map((a) => ({
            id: a.id,
            hours: a.hours,
            amount: a.amount,
            role: a.role,
            session: { sessionDate: a.session.sessionDate.toISOString(), class: { className: a.session.class.className } },
          })),
          timesheetEntries: employee.timesheetEntries.map((entry) => ({
            id: entry.id,
            workDate: entry.workDate.toISOString(),
            checkInAm: entry.checkInAm,
            checkOutAm: entry.checkOutAm,
            checkInPm: entry.checkInPm,
            checkOutPm: entry.checkOutPm,
            hours: entry.hours,
            days: entry.days,
            notes: entry.notes,
          })),
          requirementCheckRows,
          contract: employee.contracts[0]
            ? {
                contractNo: employee.contracts[0].contractNo,
                signDate: employee.contracts[0].signDate ? employee.contracts[0].signDate.toISOString() : null,
                expiryDate: employee.contracts[0].expiryDate ? employee.contracts[0].expiryDate.toISOString() : null,
                contractType: employee.contracts[0].contractType,
                baseSalary: employee.contracts[0].baseSalary,
              }
            : null,
        }}
      />
    </div>
  );
}
