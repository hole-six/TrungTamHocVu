"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmployeeProfileEditor from "@/components/payroll/EmployeeProfileEditor";
import EmploymentContractPanel from "@/components/payroll/EmploymentContractPanel";
import TimesheetEntryForm from "@/components/timesheets/TimesheetEntryForm";
import AssistantScoreForm, { BranchBonusForm } from "@/components/payroll/AssistantScoreForm";
import PayrollLineAdjustForm from "@/components/payroll/PayrollLineAdjustForm";
import { Section, Stat, ACTION_CLASS } from "@/components/ui/DetailDrawerParts";
import { formatVnd } from "@/lib/export-utils";
import { SESSION_ROLE_LABEL, type EmployeeContractStatus } from "@/lib/server/payroll-rules";

type BranchScorecard = {
  branchId: string;
  branchName: string;
  countedShifts: number;
  deducted: number;
  added: number;
  ratio: number | null;
  bonus: { bonusPercent: number } | null;
};

// Client-side vì component này được PayrollEmployeeDrawer ("use client") render trực
// tiếp, không qua children slot — nên không thể gọi computeAssistantScorecard() (dùng
// prisma) thẳng ở đây, phải gọi qua route GET /api/employees/[id]/assistant-score có sẵn.
function AssistantScorecardSummary({ employeeId, month }: { employeeId: string; month: string }) {
  const [data, setData] = useState<{ byBranch: BranchScorecard[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/employees/${employeeId}/assistant-score?month=${month}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
          return;
        }
        setData(json);
      })
      .catch(() => {
        if (!cancelled) setError("Không tải được điểm đánh giá.");
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, month]);

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!data && !error ? <p className="text-sm text-[#94a3b8]">Đang tải...</p> : null}
      {data && data.byBranch.length === 0 ? (
        <p className="text-sm text-[#94a3b8]">Chưa có ca/điểm nào ghi nhận trong tháng {month}.</p>
      ) : null}

      {data && data.byBranch.length > 0
        ? data.byBranch.map((b) => (
            <div key={b.branchId} className="border-b border-[#f1f5f9] pb-3 last:border-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[#94a3b8]">{b.branchName}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
                <Stat label="Số ca tính">{b.countedShifts}</Stat>
                <Stat label="Điểm trừ">
                  <span className={b.deducted > 0 ? "text-red-600" : undefined}>{b.deducted}</span>
                </Stat>
                <Stat label="Điểm cộng">
                  <span className={b.added > 0 ? "text-emerald-700" : undefined}>{b.added}</span>
                </Stat>
                <Stat label="Tỉ lệ A">{b.ratio !== null ? `${b.ratio.toFixed(1)}%` : null}</Stat>
                <Stat label="% Thưởng">{b.bonus ? `${(b.bonus.bonusPercent * 100).toFixed(0)}%` : null}</Stat>
              </div>
            </div>
          ))
        : null}

      <Link href={`/teacher-tasks?employeeId=${employeeId}&status=NOT_SUBMITTED`} className={ACTION_CLASS}>
        Xem việc chưa nộp
      </Link>
    </div>
  );
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("vi-VN");
}

type TimesheetEntryRow = {
  id: string;
  workDate: string;
  checkInAm: string | null;
  checkOutAm: string | null;
  checkInPm: string | null;
  checkOutPm: string | null;
  hours: number | null;
  days: number | null;
  notes: string | null;
};

// Danh sách chấm công có sửa/xóa tại chỗ — tái dùng đúng TimesheetEntryForm.tsx (không
// viết form riêng) cho từng dòng khi "Sửa", và cho cả dòng "chấm công ngày mới" ở trên
// cùng: cùng 1 form, chỉ khác `existing` null hay không.
function TimesheetSection({
  employeeId,
  employeeName,
  entries,
  canEdit,
  onChanged,
}: {
  employeeId: string;
  employeeName: string;
  entries: TimesheetEntryRow[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingDate, setAddingDate] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {canEdit ? (
        addingDate === null ? (
          <button type="button" onClick={() => setAddingDate(new Date().toISOString().slice(0, 10))} className={ACTION_CLASS}>
            + Chấm công một ngày
          </button>
        ) : (
          <div className="space-y-2 border-b border-[#f1f5f9] pb-3">
            <label className="block space-y-1">
              <span className="label-sm">Ngày công</span>
              <input type="date" className="input" value={addingDate} onChange={(event) => setAddingDate(event.target.value)} />
            </label>
            {addingDate ? (
              <TimesheetEntryForm
                key={addingDate}
                employeeId={employeeId}
                employeeName={employeeName}
                selectedDate={addingDate}
                selectedDateLabel={formatDate(addingDate)}
                existing={null}
                canDeleteTimesheet={false}
                onSaved={() => {
                  setAddingDate(null);
                  onChanged();
                }}
              />
            ) : null}
            <button type="button" onClick={() => setAddingDate(null)} className="btn-ghost-sm">
              Hủy
            </button>
          </div>
        )
      ) : null}

      {entries.length === 0 ? (
        <p className="text-sm text-[#94a3b8]">Chưa có chấm công nào.</p>
      ) : (
        <div>
          {entries.map((entry) =>
            editingId === entry.id ? (
              <div key={entry.id} className="space-y-2 border-b border-[#f1f5f9] py-3 last:border-0">
                <p className="text-sm font-bold text-[#0f1729]">{formatDate(entry.workDate)}</p>
                <TimesheetEntryForm
                  employeeId={employeeId}
                  employeeName={employeeName}
                  selectedDate={new Date(entry.workDate).toISOString().slice(0, 10)}
                  selectedDateLabel={formatDate(entry.workDate)}
                  existing={entry}
                  canDeleteTimesheet={canEdit}
                  onSaved={() => {
                    setEditingId(null);
                    onChanged();
                  }}
                />
                <button type="button" onClick={() => setEditingId(null)} className="btn-ghost-sm">
                  Đóng
                </button>
              </div>
            ) : (
              <div key={entry.id} className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] py-2.5 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-[#0f1729]">{formatDate(entry.workDate)}</p>
                  <p className="text-xs text-[#64748b]">
                    {entry.hours ?? 0} giờ · {entry.days ?? 0} công{entry.notes ? ` · ${entry.notes}` : ""}
                  </p>
                </div>
                {canEdit ? (
                  <button type="button" onClick={() => setEditingId(entry.id)} className="btn-ghost-sm">
                    Sửa
                  </button>
                ) : null}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

type SessionAssignmentRow = {
  id: string;
  hours: number | null;
  amount: number | null;
  role: string;
  session: { sessionDate: string; class: { className: string } };
};

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

type EmployeeHistory = {
  sessionAssignments: SessionAssignmentRow[];
  timesheetEntries: TimesheetEntryRow[];
  requirementCheckRows: RequirementCheckRow[];
  contract: { contractNo: string | null; signDate: string | null; expiryDate: string | null; contractType: string | null; baseSalary: number | null } | null;
};

type EmployeeProfile = {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string | null;
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

// Nội dung thật của drawer nhân sự — tách riêng khỏi phần bọc ResponsiveDrawer để trang
// tự xem lương cá nhân (/payroll/employees/[id]) render trực tiếp không cần drawer, dùng
// chung đúng 1 bộ form thay vì lặp lại markup ở 2 nơi. Trước đây đây là 5 TAB, mỗi tab
// lại gồm nhiều .card lồng nhau (card trong tab trong drawer) — giờ là các Section gập
// mở phẳng, đúng 1 lớp khung, giống hệt drawer học viên và lớp học.
export default function PayrollEmployeeEditPanels({
  headerSummary,
  profile,
  canEditProfile,
  canAddTimesheet,
  payrollLine,
  canEditPayrollLine,
  assistant,
  history: initialHistory,
}: {
  headerSummary: {
    fullName: string;
    employeeCode: string;
    position: string | null;
    contractStatus: EmployeeContractStatus;
    sourceLabel: string | null;
    /** Tổng lương tháng đang xem — chỉ có ở ngữ cảnh /payroll, /employees không có. */
    totalAmount?: number | null;
    workSummary?: string | null;
    month?: string | null;
  };
  profile: EmployeeProfile;
  canEditProfile: boolean;
  canAddTimesheet: boolean;
  payrollLine: {
    id: string;
    otHours: number;
    otAmount: number;
    kpiBonus: number;
    assistantRatingBonus: number;
    parkingAllowance: number;
    supportAllowance: number;
    bonus: number;
    penalty: number;
    socialInsuranceDeduction: number;
    utilityDeduction: number;
    holidayBonus: number;
    otherDeduction: number;
    notes: string | null;
  } | null;
  canEditPayrollLine: boolean;
  assistant: { employeeId: string; month: string; branches: { id: string; name: string }[]; bonusByBranch: Record<string, number | null> } | null;
  /** Trang /payroll/employees/[id] đã tự query sẵn — truyền thẳng vào đây. Drawer quản
   *  lý ở /payroll không có sẵn (không muốn nặng thêm mỗi dòng danh sách) nên để trống,
   *  component tự fetch lười qua GET /api/employees/[id] khi mount. */
  history?: EmployeeHistory;
}) {
  const router = useRouter();
  const [history, setHistory] = useState<EmployeeHistory | null>(initialHistory ?? null);

  useEffect(() => {
    if (initialHistory) return;
    let cancelled = false;
    fetch(`/api/employees/${profile.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || data.error) return;
        setHistory({
          sessionAssignments: data.item.sessionAssignments.map((a: SessionAssignmentRow) => ({
            id: a.id,
            hours: a.hours,
            amount: a.amount,
            role: a.role,
            session: { sessionDate: a.session.sessionDate, class: { className: a.session.class.className } },
          })),
          timesheetEntries: data.item.timesheetEntries,
          requirementCheckRows: (data.requirementChecks ?? []).map((item: any) => ({
            id: item.id,
            sessionDate: formatDate(item.session.sessionDate),
            className: item.session.class.className,
            classId: item.session.classId,
            sessionId: item.session.id,
            requirementText: item.requirementText,
            status: item.status,
            deductedPoints: item.scoreEvent && item.scoreEvent.type === "DEDUCT" ? item.scoreEvent.points : null,
          })),
          contract: data.item.contracts[0]
            ? {
                contractNo: data.item.contracts[0].contractNo,
                signDate: data.item.contracts[0].signDate,
                expiryDate: data.item.contracts[0].expiryDate,
                contractType: data.item.contracts[0].contractType,
                baseSalary: data.item.contracts[0].baseSalary,
              }
            : null,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const timesheetEntries = history?.timesheetEntries ?? [];
  const notSubmittedCount = (history?.requirementCheckRows ?? []).filter((item) => item.status !== "SUBMITTED").length;
  const rateSummary = [
    profile.teachingHourlyRate ? `Dạy ${formatVnd(profile.teachingHourlyRate)}` : null,
    profile.assistantHourlyRate ? `TG ${formatVnd(profile.assistantHourlyRate)}` : null,
    profile.staffDailyRate ? `HC ${formatVnd(profile.staffDailyRate)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      {/* Danh tính: mã NV, vị trí, trạng thái HĐ — 1 dòng, không lặp tên (tiêu đề drawer đã có) */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md border border-[#e2e8f0] bg-[#f8faff] px-2 py-1 font-mono font-bold text-[#475569]">
          {headerSummary.employeeCode}
        </span>
        {headerSummary.position ? (
          <span className="rounded-md border border-[#e2e8f0] bg-white px-2 py-1 font-semibold text-[#475569]">{headerSummary.position}</span>
        ) : null}
        {headerSummary.contractStatus ? (
          <span className="rounded-md bg-[#b45309] px-2 py-1 font-bold text-white">{headerSummary.contractStatus}</span>
        ) : null}
        {headerSummary.sourceLabel ? <span className="text-[#64748b]">{headerSummary.sourceLabel}</span> : null}
      </div>

      {/* Hai con số thật sự cần khi mở 1 nhân sự trong tháng: tiền và công */}
      {headerSummary.totalAmount != null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">
              Lương tháng {headerSummary.month ?? ""}
            </p>
            <p className="mt-1 text-3xl font-black text-[#0f1729]">{formatVnd(headerSummary.totalAmount)}</p>
            <p className="mt-0.5 text-sm text-[#64748b]">{payrollLine ? "Đã tính lương" : "Số xem trước, chưa tính lương"}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Công trong tháng</p>
            <p className="mt-1 text-3xl font-black text-[#0f1729]">{headerSummary.workSummary || "—"}</p>
            <p className="mt-0.5 text-sm text-[#64748b]">{rateSummary || "Chưa cấu hình đơn giá"}</p>
          </div>
        </div>
      ) : null}

      <Section title="Hồ sơ nhân sự" hint={profile.phone ?? profile.email ?? null} defaultOpen={headerSummary.totalAmount == null}>
        <EmployeeProfileEditor employee={profile} canEdit={canEditProfile} bare />
      </Section>

      <Section
        title={`Lương tháng ${headerSummary.month ?? ""}`.trim()}
        hint={payrollLine ? "Đã có dòng lương" : "Chưa tính lương"}
        defaultOpen={Boolean(payrollLine) && canEditPayrollLine}
      >
        {payrollLine ? (
          canEditPayrollLine ? (
            <PayrollLineAdjustForm
              lineId={payrollLine.id}
              otHours={payrollLine.otHours}
              otAmount={payrollLine.otAmount}
              kpiBonus={payrollLine.kpiBonus}
              assistantRatingBonus={payrollLine.assistantRatingBonus}
              parkingAllowance={payrollLine.parkingAllowance}
              supportAllowance={payrollLine.supportAllowance}
              bonus={payrollLine.bonus}
              penalty={payrollLine.penalty}
              socialInsuranceDeduction={payrollLine.socialInsuranceDeduction}
              utilityDeduction={payrollLine.utilityDeduction}
              holidayBonus={payrollLine.holidayBonus}
              otherDeduction={payrollLine.otherDeduction}
              notes={payrollLine.notes}
              employeeName={headerSummary.fullName}
              bare
            />
          ) : (
            <p className="text-sm text-[#94a3b8]">Tháng lương đã duyệt/khóa nên không sửa thưởng/phạt ở đây được nữa.</p>
          )
        ) : (
          <p className="text-sm text-[#94a3b8]">
            Tháng này chưa tính lương — số đang hiển thị là xem trước. Bấm &quot;Tính lại lương&quot; ở trang lương để tạo dòng
            lương chính thức, sau đó mới điều chỉnh thưởng/phạt được.
          </p>
        )}
      </Section>

      <Section title="Chấm công" hint={history ? `${timesheetEntries.length} ngày đã chấm` : "Đang tải..."}>
        {history ? (
          <TimesheetSection
            employeeId={profile.id}
            employeeName={headerSummary.fullName}
            entries={timesheetEntries}
            canEdit={canAddTimesheet}
            onChanged={() => router.refresh()}
          />
        ) : (
          <p className="text-sm text-[#94a3b8]">Đang tải...</p>
        )}
      </Section>

      <Section title="Hợp đồng lao động" hint={history?.contract?.contractNo ?? (history ? "Chưa có hợp đồng" : "Đang tải...")}>
        <EmploymentContractPanel employeeId={profile.id} contract={history?.contract ?? null} canEdit={canEditProfile} bare />
      </Section>

      {assistant ? (
        <>
          <Section title="Đánh giá trợ giảng" hint={`Tháng ${assistant.month}`}>
            <AssistantScorecardSummary employeeId={assistant.employeeId} month={assistant.month} />
          </Section>
          <Section title="Mức thưởng theo cơ sở" hint={`${assistant.branches.length} cơ sở`}>
            <BranchBonusForm
              employeeId={assistant.employeeId}
              month={assistant.month}
              branches={assistant.branches}
              bonusByBranch={assistant.bonusByBranch}
            />
          </Section>
          <Section title="Ghi nhận điểm trừ/cộng">
            <AssistantScoreForm employeeId={assistant.employeeId} month={assistant.month} branches={assistant.branches} />
          </Section>
        </>
      ) : null}

      <Section title="Buổi dạy / trợ giảng" hint={history ? `${history.sessionAssignments.length} buổi` : "Đang tải..."}>
        {!history ? (
          <p className="text-sm text-[#94a3b8]">Đang tải...</p>
        ) : history.sessionAssignments.length === 0 ? (
          <p className="text-sm text-[#94a3b8]">Chưa được phân công buổi dạy nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  <th className="pb-2 font-semibold">Ngày</th>
                  <th className="pb-2 font-semibold">Lớp</th>
                  <th className="pb-2 font-semibold">Vai trò</th>
                  <th className="pb-2 text-right font-semibold">Giờ</th>
                  <th className="pb-2 text-right font-semibold">Tiền</th>
                </tr>
              </thead>
              <tbody>
                {history.sessionAssignments.map((a) => (
                  <tr key={a.id} className="border-t border-[#f1f5f9]">
                    <td className="py-2">{formatDate(a.session.sessionDate)}</td>
                    <td className="py-2 text-[#475569]">{a.session.class.className}</td>
                    <td className="py-2 text-[#475569]">{SESSION_ROLE_LABEL[a.role] ?? a.role}</td>
                    <td className="py-2 text-right text-[#475569]">{a.hours ?? 0}</td>
                    <td className="py-2 text-right font-semibold">{formatVnd(a.amount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Việc theo buổi cần nộp"
        hint={history ? (notSubmittedCount > 0 ? `${notSubmittedCount} chưa nộp` : "Đã nộp đủ") : "Đang tải..."}
      >
        {!history ? (
          <p className="text-sm text-[#94a3b8]">Đang tải...</p>
        ) : history.requirementCheckRows.length === 0 ? (
          <p className="text-sm text-[#94a3b8]">Chưa có xác nhận nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  <th className="pb-2 font-semibold">Ngày</th>
                  <th className="pb-2 font-semibold">Lớp</th>
                  <th className="pb-2 font-semibold">Yêu cầu</th>
                  <th className="pb-2 font-semibold">Trạng thái</th>
                  <th className="pb-2 text-right font-semibold">Điểm trừ</th>
                </tr>
              </thead>
              <tbody>
                {history.requirementCheckRows.map((item) => (
                  <tr key={item.id} className="border-t border-[#f1f5f9]">
                    <td className="py-2">{item.sessionDate}</td>
                    <td className="py-2 text-[#475569]">{item.className}</td>
                    <td className="py-2 text-[#475569]">
                      <span className="line-clamp-2 max-w-xs">{item.requirementText}</span>
                    </td>
                    <td className={`py-2 font-semibold ${item.status === "SUBMITTED" ? "text-emerald-700" : "text-rose-700"}`}>
                      {item.status === "SUBMITTED" ? "Đã nộp" : "Chưa nộp"}
                    </td>
                    <td className="py-2 text-right">
                      {item.deductedPoints != null ? <span className="font-bold text-rose-600">-{item.deductedPoints}</span> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
