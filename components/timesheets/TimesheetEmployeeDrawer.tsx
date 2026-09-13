"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import TimesheetEntryForm from "@/components/timesheets/TimesheetEntryForm";
import { Section, Stat, ACTION_CLASS } from "@/components/ui/DetailDrawerParts";

type Entry = {
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

type SessionAssignmentRow = {
  id: string;
  workDate: string;
  role: string;
  classCode: string;
  className: string;
  hours: number | null;
  deductedHours: number;
  addedHours: number;
};

export type TimesheetEmployee = {
  id: string;
  fullName: string;
  employeeCode: string;
  position: string | null;
  workStatus: string;
  /** HOURLY | SESSION | MONTHLY — chỉ MONTHLY (hành chính/văn phòng) chấm công ngày. */
  payMode: string;
  timesheetEntries: Entry[];
  sessionAssignments: SessionAssignmentRow[];
};

const ROLE_LABEL: Record<string, string> = { TEACHER: "GV", ASSISTANT: "TG", ASSISTANT2: "TG2" };

function formatVnDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// Chấm công của 1 nhân sự trong 1 tháng — trước đây phải chọn 1 ngày ở đầu trang rồi
// bung dòng nhân viên ra để thấy đúng ngày đó (mỗi lần đổi ngày phải cuộn lại từ đầu).
// Giờ mở hẳn drawer theo NGƯỜI: cả tháng nằm trong 1 chỗ, chấm ngày nào cũng được mà
// không đổi bộ lọc của cả trang.
export default function TimesheetEmployeeDrawer({
  open,
  onClose,
  employee,
  month,
  today,
  canDeleteTimesheet,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  employee: TimesheetEmployee;
  /** "YYYY-MM" — tháng đang xem, quyết định ngày mặc định của form chấm công mới. */
  month: string;
  /** "YYYY-MM-DD" hôm nay theo giờ VN, tính ở server — new Date().toISOString() ở trình
   *  duyệt ra ngày UTC, từ 0h–7h sáng sẽ điền nhầm ngày hôm qua. */
  today: string;
  canDeleteTimesheet: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingDate, setAddingDate] = useState<string | null>(null);

  const monthDays = round2(employee.timesheetEntries.reduce((sum, entry) => sum + (entry.days ?? 0), 0));
  const monthHours = round2(employee.timesheetEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0));
  const teachingHours = round2(employee.sessionAssignments.reduce((sum, item) => sum + (item.hours ?? 0), 0));

  // Ngày mặc định khi bấm "Chấm công một ngày": hôm nay nếu hôm nay thuộc tháng đang
  // xem, ngược lại là ngày 1 của tháng đó — tránh vô tình chấm nhầm sang tháng khác.
  function defaultDate() {
    return today.startsWith(month) ? today : `${month}-01`;
  }

  function afterChange() {
    setEditingId(null);
    setAddingDate(null);
    router.refresh();
  }

  return (
    <ResponsiveDrawer open={open} onClose={onClose} title={employee.fullName} widthClassName="max-w-3xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-[#e2e8f0] bg-[#f8faff] px-2 py-1 font-mono font-bold text-[#475569]">
            {employee.employeeCode}
          </span>
          {employee.position ? (
            <span className="rounded-md border border-[#e2e8f0] bg-white px-2 py-1 font-semibold text-[#475569]">{employee.position}</span>
          ) : null}
          {employee.workStatus !== "ACTIVE" ? <span className="rounded-md bg-[#64748b] px-2 py-1 font-bold text-white">Đã nghỉ</span> : null}
          <span className="text-[#64748b]">Tháng {month}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Công hành chính</p>
            <p className="mt-1 text-3xl font-black text-[#0f1729]">{monthDays}</p>
            <p className="mt-0.5 text-sm text-[#64748b]">{monthHours} giờ · {employee.timesheetEntries.length} ngày đã chấm</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Buổi dạy / trợ giảng</p>
            <p className="mt-1 text-3xl font-black text-[#0f1729]">{employee.sessionAssignments.length}</p>
            <p className="mt-0.5 text-sm text-[#64748b]">{teachingHours} giờ — lấy từ buổi học đã phân công</p>
          </div>
        </div>

        {canEdit ? (
          addingDate === null ? (
            <button type="button" onClick={() => setAddingDate(defaultDate())} className={ACTION_CLASS}>
              + Chấm công một ngày
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-[#e5eaf7] bg-white p-4">
              <label className="block space-y-1">
                <span className="label-sm">Ngày công</span>
                <input type="date" className="input" value={addingDate} onChange={(event) => setAddingDate(event.target.value)} />
              </label>
              {addingDate ? (
                <TimesheetEntryForm
                  key={addingDate}
                  employeeId={employee.id}
                  employeeName={employee.fullName}
                  selectedDate={addingDate}
                  selectedDateLabel={formatVnDate(addingDate)}
                  existing={employee.timesheetEntries.find((entry) => entry.workDate.slice(0, 10) === addingDate) ?? null}
                  canDeleteTimesheet={canDeleteTimesheet}
                  onSaved={afterChange}
                />
              ) : null}
              <button type="button" onClick={() => setAddingDate(null)} className="btn-ghost-sm">
                Hủy
              </button>
            </div>
          )
        ) : null}

        <Section title="Ngày đã chấm công" hint={`${employee.timesheetEntries.length} ngày`} defaultOpen>
          {employee.timesheetEntries.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">Chưa chấm công ngày nào trong tháng {month}.</p>
          ) : (
            <div>
              {employee.timesheetEntries.map((entry) =>
                editingId === entry.id ? (
                  <div key={entry.id} className="space-y-2 border-b border-[#f1f5f9] py-3 last:border-0">
                    <p className="text-sm font-bold text-[#0f1729]">{formatVnDate(entry.workDate)}</p>
                    <TimesheetEntryForm
                      employeeId={employee.id}
                      employeeName={employee.fullName}
                      selectedDate={entry.workDate.slice(0, 10)}
                      selectedDateLabel={formatVnDate(entry.workDate)}
                      existing={entry}
                      canDeleteTimesheet={canDeleteTimesheet}
                      onSaved={afterChange}
                    />
                    <button type="button" onClick={() => setEditingId(null)} className="btn-ghost-sm">
                      Đóng
                    </button>
                  </div>
                ) : (
                  <div key={entry.id} className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] py-2.5 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-[#0f1729]">{formatVnDate(entry.workDate)}</p>
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
        </Section>

        {/* Buổi dạy trong tháng — chỉ để đối chiếu, không sửa ở đây (nguồn là buổi học
            đã phân công ở lớp, sửa ở /classes). Cố tình tách khỏi công hành chính vì
            hai loại công này tính lương theo 2 đơn giá khác nhau. */}
        <Section title="Buổi dạy trong tháng" hint={`${employee.sessionAssignments.length} buổi`}>
          {employee.sessionAssignments.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">Không có buổi dạy nào trong tháng {month}.</p>
          ) : (
            <div>
              {employee.sessionAssignments.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-2 border-b border-[#f1f5f9] py-2.5 text-sm last:border-0">
                  <span className="w-[92px] shrink-0 text-xs text-[#94a3b8]">{formatVnDate(item.workDate)}</span>
                  <span className="rounded-md border border-[#e2e8f0] bg-white px-1.5 py-0.5 text-xs font-bold text-[#475569]">
                    {ROLE_LABEL[item.role] ?? item.role}
                  </span>
                  <span className="font-semibold text-[#0f1729]">
                    {item.classCode} · {item.className}
                  </span>
                  <span className="text-[#64748b]">{item.hours?.toFixed(2) ?? 0}h</span>
                  {item.deductedHours > 0 ? <span className="text-red-600">Trừ {item.deductedHours}h</span> : null}
                  {item.addedHours > 0 ? <span className="text-emerald-700">Cộng {item.addedHours}h</span> : null}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Đơn vị tính">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Stat label="Công hành chính">{monthDays} công</Stat>
            <Stat label="Giờ hành chính">{monthHours} giờ</Stat>
            <Stat label="Giờ dạy/trợ giảng">{teachingHours} giờ</Stat>
          </div>
        </Section>
      </div>
    </ResponsiveDrawer>
  );
}
