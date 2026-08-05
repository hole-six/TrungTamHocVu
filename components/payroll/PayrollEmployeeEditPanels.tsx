import EmployeeProfileEditor from "@/components/payroll/EmployeeProfileEditor";
import TimesheetQuickAddForm from "@/components/payroll/TimesheetQuickAddForm";
import AssistantScoreForm from "@/components/payroll/AssistantScoreForm";
import PayrollLineAdjustForm from "@/components/payroll/PayrollLineAdjustForm";
import type { EmployeeContractStatus } from "@/lib/server/payroll-rules";

type EmployeeProfile = {
  id: string;
  dob: string | null;
  phone: string | null;
  email: string | null;
  hometown: string | null;
  permanentAddress: string | null;
  idNumber: string | null;
  idIssueDate: string | null;
  idIssuePlace: string | null;
  resignDate: string | null;
  payMode: string;
  teachingHourlyRate: number | null;
  assistantHourlyRate: number | null;
  staffDailyRate: number | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
};

function getContractTone(status: string | null) {
  if (!status || status === "Chưa có info") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status.includes("Đã hết hạn")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (status.includes("Sắp")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

// Nội dung thật của drawer sửa nhân sự — tách riêng khỏi phần bọc SlideOver để trang tự
// xem lương cá nhân (/payroll/employees/[id]) render trực tiếp không cần drawer, dùng
// chung đúng 1 bộ form thay vì lặp lại markup ở 2 nơi.
export default function PayrollEmployeeEditPanels({
  headerSummary,
  profile,
  canEditProfile,
  canAddTimesheet,
  payrollLine,
  canEditPayrollLine,
  assistant,
}: {
  headerSummary: {
    fullName: string;
    employeeCode: string;
    position: string | null;
    contractStatus: EmployeeContractStatus;
    sourceLabel: string | null;
  };
  profile: EmployeeProfile;
  canEditProfile: boolean;
  canAddTimesheet: boolean;
  payrollLine: { id: string; bonus: number; penalty: number; notes: string | null } | null;
  canEditPayrollLine: boolean;
  assistant: { employeeId: string; month: string; branches: { id: string; name: string }[]; bonusByBranch: Record<string, number | null> } | null;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-hairline bg-[#fafafa] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-lg font-semibold tracking-tight">{headerSummary.fullName}</p>
          <span className="badge bg-ink/5 text-ink-muted80">{headerSummary.employeeCode}</span>
          {headerSummary.position ? <span className="text-sm text-ink-muted48">{headerSummary.position}</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getContractTone(headerSummary.contractStatus)}`}>
            {headerSummary.contractStatus || "Hợp đồng ổn"}
          </span>
          {headerSummary.sourceLabel ? (
            <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1 text-xs font-bold text-[#c2410c]">
              {headerSummary.sourceLabel}
            </span>
          ) : null}
        </div>
      </div>

      <EmployeeProfileEditor employee={profile} canEdit={canEditProfile} />

      {payrollLine ? (
        canEditPayrollLine ? (
          <PayrollLineAdjustForm
            lineId={payrollLine.id}
            bonus={payrollLine.bonus}
            penalty={payrollLine.penalty}
            notes={payrollLine.notes}
            employeeName={headerSummary.fullName}
          />
        ) : (
          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Dòng lương kỳ này</h2>
            <p className="mt-2 text-sm text-ink-muted48">Kỳ lương đã duyệt/khóa nên không thể sửa thưởng/phạt ở đây nữa.</p>
          </div>
        )
      ) : (
        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">Dòng lương kỳ này</h2>
          <p className="mt-2 text-sm text-ink-muted48">
            Kỳ lương chưa được tính — số liệu đang là xem trước. Bấm &quot;Tính lại lương&quot; ở thanh công cụ để tạo dòng
            lương chính thức cho người này, sau đó mới điều chỉnh thưởng/phạt được.
          </p>
        </div>
      )}

      {canAddTimesheet ? <TimesheetQuickAddForm employeeId={profile.id} /> : null}

      {assistant ? (
        <AssistantScoreForm
          employeeId={assistant.employeeId}
          month={assistant.month}
          branches={assistant.branches}
          bonusByBranch={assistant.bonusByBranch}
        />
      ) : null}
    </div>
  );
}
