"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmployeeProfileEditor from "@/components/payroll/EmployeeProfileEditor";
import EmploymentContractPanel from "@/components/payroll/EmploymentContractPanel";
import TimesheetQuickAddForm from "@/components/payroll/TimesheetQuickAddForm";
import TimesheetEntryForm from "@/components/timesheets/TimesheetEntryForm";
import AssistantScoreForm, { BranchBonusForm } from "@/components/payroll/AssistantScoreForm";
import PayrollLineAdjustForm from "@/components/payroll/PayrollLineAdjustForm";
import DetailTabs, { type DetailTab } from "@/components/ui/DetailTabs";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column } from "@/components/ui/DataTable";
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
    <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Tổng hợp điểm đánh giá tháng {month}</h3>
          <p className="text-sm text-[#6b7280]">Số ca, điểm trừ/cộng và tỉ lệ A — tính riêng theo từng cơ sở.</p>
        </div>
        <Link
          href={`/teacher-tasks?employeeId=${employeeId}&status=NOT_SUBMITTED`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border-2 border-[#f97316] px-3 py-2 text-xs font-bold text-[#f97316] transition hover:bg-[#fff7ed]"
        >
          Xem việc chưa nộp →
        </Link>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {!data && !error ? <p className="mt-3 text-sm text-[#9ca3af]">Đang tải...</p> : null}
      {data && data.byBranch.length === 0 ? (
        <p className="mt-3 text-sm text-[#9ca3af]">Chưa có ca/điểm nào ghi nhận trong tháng {month}.</p>
      ) : null}

      {data && data.byBranch.length > 0 ? (
        <div className="mt-4 space-y-3">
          {data.byBranch.map((b) => (
            <div key={b.branchId} className="rounded-xl border border-[#e5e7eb] bg-[#fbfbfc] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280]">{b.branchName}</p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div>
                  <p className="text-[11px] text-[#9ca3af]">Số ca tính</p>
                  <p className="text-lg font-black text-[#0f1729]">{b.countedShifts}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#9ca3af]">Điểm trừ</p>
                  <p className="text-lg font-black text-red-600">{b.deducted}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#9ca3af]">Điểm cộng</p>
                  <p className="text-lg font-black text-emerald-600">{b.added}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#9ca3af]">Tỉ lệ A</p>
                  <p className="text-lg font-black text-[#0f1729]">{b.ratio !== null ? `${b.ratio.toFixed(1)}%` : "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#9ca3af]">% Thưởng hiện tại</p>
                  <p className="text-lg font-black text-[#f97316]">{b.bonus ? `${(b.bonus.bonusPercent * 100).toFixed(0)}%` : "—"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
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

// Danh sách chấm công có sửa/xóa tại chỗ — trước đây drawer nhân sự chỉ TẠO được
// chấm công mới (TimesheetQuickAddForm), không có chỗ xem lại/sửa/xóa dù API
// PUT/DELETE /api/timesheet-entries đã hoạt động đầy đủ ở trang /timesheets. Tái
// dùng đúng TimesheetEntryForm.tsx (không viết form riêng) cho từng dòng khi "Sửa".
function TimesheetEditableList({
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

  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted48">Chưa có chấm công nào.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) =>
        editingId === entry.id ? (
          <div key={entry.id} className="rounded-xl border-2 border-[#f97316] bg-[#fff7ed] p-3">
            <p className="mb-2 text-sm font-semibold text-ink">{formatDate(entry.workDate)}</p>
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
            <button type="button" onClick={() => setEditingId(null)} className="btn-ghost-sm mt-2">
              Đóng
            </button>
          </div>
        ) : (
          <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-white px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold text-ink">{formatDate(entry.workDate)}</p>
              <p className="text-xs text-ink-muted48">{entry.hours ?? 0} giờ · {entry.days ?? 0} công{entry.notes ? ` · ${entry.notes}` : ""}</p>
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

type EmployeeHistory = {
  sessionAssignments: SessionAssignmentRow[];
  timesheetEntries: TimesheetEntryRow[];
  requirementCheckRows: RequirementCheckRow[];
  contract: { contractNo: string | null; signDate: string | null; expiryDate: string | null; contractType: string | null; baseSalary: number | null } | null;
};

function getContractTone(status: string | null) {
  if (!status || status === "Chưa có info") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status.includes("Đã hết hạn")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (status.includes("Sắp")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

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

// Nội dung thật của drawer sửa nhân sự — tách riêng khỏi phần bọc SlideOver để trang tự
// xem lương cá nhân (/payroll/employees/[id]) render trực tiếp không cần drawer, dùng
// chung đúng 1 bộ form thay vì lặp lại markup ở 2 nơi. Trước đây đây là 1 cột dọc gồm
// sửa hồ sơ + dòng lương + chấm công + điểm đánh giá xếp chồng lên nhau không phân
// biệt — giờ tách theo đúng 5 tab người dùng yêu cầu (Thông tin cá nhân / Lương thưởng
// / Cơ sở / Cơ chế điểm / Lịch sử), đúng pattern DetailTabs đã dùng ở StudentDetailDrawer.
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

  const recentTimesheetEntries = (history?.timesheetEntries ?? []).slice(0, 10);

  const tabs: DetailTab[] = [
    {
      key: "thongtin",
      label: "Thông tin cá nhân",
      content: (
        <div className="space-y-5">
          <EmployeeProfileEditor employee={profile} canEdit={canEditProfile} />
          <EmploymentContractPanel employeeId={profile.id} contract={history?.contract ?? null} canEdit={canEditProfile} />
        </div>
      ),
    },
    {
      key: "luongthuong",
      label: "Lương thưởng",
      content: (
        <div className="space-y-5">
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

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Chấm công gần đây</h2>
            <p className="mt-1 text-sm text-ink-muted48">Sửa/xóa lại chấm công đã ghi nếu có sai sót — xem đầy đủ ở tab &quot;Lịch sử&quot;.</p>
            <div className="mt-3">
              {history ? (
                <TimesheetEditableList
                  employeeId={profile.id}
                  employeeName={headerSummary.fullName}
                  entries={recentTimesheetEntries}
                  canEdit={canAddTimesheet}
                  onChanged={() => router.refresh()}
                />
              ) : (
                <p className="text-sm text-ink-muted48">Đang tải...</p>
              )}
            </div>
          </div>
        </div>
      ),
    },
  ];

  if (assistant) {
    tabs.push({
      key: "coso",
      label: "Cơ sở",
      content: <BranchBonusForm employeeId={assistant.employeeId} month={assistant.month} branches={assistant.branches} bonusByBranch={assistant.bonusByBranch} />,
    });
    tabs.push({
      key: "cochediem",
      label: "Cơ chế điểm",
      content: (
        <div className="space-y-5">
          <AssistantScorecardSummary employeeId={assistant.employeeId} month={assistant.month} />
          <AssistantScoreForm employeeId={assistant.employeeId} month={assistant.month} branches={assistant.branches} />
        </div>
      ),
    });
  }

  tabs.push({
    key: "lichsu",
    label: "Lịch sử",
    content: !history ? (
      <p className="text-sm text-ink-muted48">Đang tải...</p>
    ) : (
      <div className="space-y-5">
        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight mb-3">Buổi dạy/trợ giảng ({history.sessionAssignments.length})</h2>
          <div className="overflow-x-auto">
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
                {history.sessionAssignments.map((a) => (
                  <tr key={a.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(a.session.sessionDate)}</td>
                    <td className="py-2 text-ink-muted80">{a.session.class.className}</td>
                    <td className="py-2 text-ink-muted80">{SESSION_ROLE_LABEL[a.role] ?? a.role}</td>
                    <td className="py-2 text-ink-muted80">{a.hours ?? 0}</td>
                    <td className="py-2 font-medium">{formatVnd(a.amount ?? 0)}</td>
                  </tr>
                ))}
                {history.sessionAssignments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-ink-muted48">Chưa được phân công buổi dạy nào.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight mb-3">Tất cả chấm công ngày ({history.timesheetEntries.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Ngày</th>
                  <th className="py-2 font-medium">Giờ</th>
                  <th className="py-2 font-medium">Công</th>
                </tr>
              </thead>
              <tbody>
                {history.timesheetEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(entry.workDate)}</td>
                    <td className="py-2 text-ink-muted80">{entry.hours ?? 0}</td>
                    <td className="py-2 font-medium">{entry.days ?? 0}</td>
                  </tr>
                ))}
                {history.timesheetEntries.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-ink-muted48">Chưa có chấm công nào.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
            Việc giáo viên cần làm theo buổi ({history.requirementCheckRows.length})
          </h2>
          <DataTableResponsive
            data={history.requirementCheckRows}
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
    ),
  });

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

      <DetailTabs tabs={tabs} defaultTabKey="thongtin" />
    </div>
  );
}
