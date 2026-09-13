"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import CheckInDialog from "@/components/timesheets/CheckInDialog";
import { Section, Stat } from "@/components/ui/DetailDrawerParts";
import { formatShift, shiftHours, SHIFT_PRESETS, type ShiftTimes } from "@/lib/timesheet-shifts";

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
const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function vnDate(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

// LỊCH SỬ CHẤM CÔNG THEO NGÀY của 1 nhân sự trong tháng: liệt kê ĐỦ mọi ngày của tháng
// (không chỉ ngày đã chấm) kèm giờ vào/ra thật, để thấy ngay ngày nào trống, ngày nào
// chấm thiếu giờ; mỗi ngày sửa được giờ ngay tại dòng.
export default function TimesheetEmployeeDrawer({
  open,
  onClose,
  employee,
  month,
  today,
  defaultShift,
  canDeleteTimesheet,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  employee: TimesheetEmployee;
  /** "YYYY-MM" — tháng đang xem. */
  month: string;
  /** "YYYY-MM-DD" hôm nay theo giờ VN, tính ở server. */
  today: string;
  /** Ca mặc định đang dùng ở bảng chấm công — điền sẵn khi chấm ngày trống. */
  defaultShift?: ShiftTimes;
  canDeleteTimesheet: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [onlyChecked, setOnlyChecked] = useState(false);

  const entryByDate = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const entry of employee.timesheetEntries) map.set(entry.workDate.slice(0, 10), entry);
    return map;
  }, [employee.timesheetEntries]);

  // Mọi ngày trong tháng, kèm thứ và bản ghi chấm công (nếu có).
  const days = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const rows: { ymd: string; weekday: number; entry: Entry | null; isFuture: boolean; isToday: boolean }[] = [];
    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(Date.UTC(year, monthNumber - 1, day));
      const ymd = date.toISOString().slice(0, 10);
      rows.push({
        ymd,
        weekday: date.getUTCDay(),
        entry: entryByDate.get(ymd) ?? null,
        isFuture: ymd > today,
        isToday: ymd === today,
      });
    }
    return rows;
  }, [month, entryByDate, today]);

  const visibleDays = onlyChecked ? days.filter((row) => row.entry) : days;
  const monthDays = round2(employee.timesheetEntries.reduce((sum, entry) => sum + (entry.days ?? 0), 0));
  const monthHours = round2(employee.timesheetEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0));
  const teachingHours = round2(employee.sessionAssignments.reduce((sum, item) => sum + (item.hours ?? 0), 0));
  const dialogEntry = dialogDate ? entryByDate.get(dialogDate) ?? null : null;

  async function saveDay(date: string, times: ShiftTimes, notes: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/timesheet-entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: employee.id, workDate: date, ...times, notes }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không lưu được chấm công.");
      return;
    }
    setDialogDate(null);
    setMessage(`Đã lưu ngày ${vnDate(date)}: ${formatShift(times)} (${shiftHours(times).toFixed(2)}h).`);
    router.refresh();
  }

  async function deleteDay(entryId: string, date: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/timesheet-entries/${entryId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không xóa được chấm công.");
      return;
    }
    setMessage(`Đã xóa chấm công ngày ${vnDate(date)}.`);
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
          {employee.payMode !== "MONTHLY" ? (
            <span className="rounded-md border border-[#e2e8f0] bg-white px-2 py-1 font-semibold text-[#475569]">Tính công theo giờ dạy</span>
          ) : null}
          {employee.workStatus !== "ACTIVE" ? <span className="rounded-md bg-[#64748b] px-2 py-1 font-bold text-white">Đã nghỉ</span> : null}
          <span className="text-[#64748b]">Tháng {month.split("-").reverse().join("/")}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Công hành chính</p>
            <p className="mt-1 text-3xl font-black text-[#0f1729]">{monthDays}</p>
            <p className="mt-0.5 text-sm text-[#64748b]">
              {monthHours} giờ · {employee.timesheetEntries.length}/{days.length} ngày đã chấm
            </p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Buổi dạy / trợ giảng</p>
            <p className="mt-1 text-3xl font-black text-[#0f1729]">{employee.sessionAssignments.length}</p>
            <p className="mt-0.5 text-sm text-[#64748b]">{teachingHours} giờ — lấy từ buổi học đã phân công</p>
          </div>
        </div>

        {message ? <p className="text-sm font-semibold text-[#0f1729]">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        <Section
          title="Lịch sử chấm công theo ngày"
          hint={`${employee.timesheetEntries.length} ngày đã chấm`}
          defaultOpen
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#64748b]">Mỗi dòng là 1 ngày của tháng — giờ vào/ra thật, sửa được ngay.</p>
            <button type="button" onClick={() => setOnlyChecked((current) => !current)} className="btn-ghost-sm">
              {onlyChecked ? "Hiện cả ngày chưa chấm" : "Chỉ hiện ngày đã chấm"}
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-[#cbd5e1] bg-[#f1f5f9] px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-[#334155]">Ngày</th>
                  <th className="border-b border-[#cbd5e1] bg-[#f1f5f9] px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-[#334155]">Giờ vào – giờ ra</th>
                  <th className="border-b border-[#cbd5e1] bg-[#f1f5f9] px-2.5 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-[#334155]">Giờ / công</th>
                  <th className="border-b border-[#cbd5e1] bg-[#f1f5f9] px-2.5 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-[#334155]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleDays.map((row) => (
                  <tr key={row.ymd} className={row.isToday ? "bg-[#f8fafc]" : undefined}>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2 align-middle">
                      <span className={`font-semibold ${row.weekday === 0 ? "text-[#b45309]" : "text-[#0f1729]"}`}>
                        {WEEKDAY_SHORT[row.weekday]} {row.ymd.slice(8)}/{row.ymd.slice(5, 7)}
                      </span>
                      {row.isToday ? <span className="ml-1 text-[11px] font-bold text-[#dc2626]">hôm nay</span> : null}
                      {row.entry?.notes ? <span className="block text-[11px] text-[#64748b]">{row.entry.notes}</span> : null}
                    </td>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2 align-middle tabular-nums">
                      {row.entry ? (
                        <span className="text-[#0f1729]">{formatShift(row.entry)}</span>
                      ) : (
                        <span className="text-[#94a3b8]">{row.isFuture ? "chưa tới" : row.weekday === 0 ? "Chủ nhật" : "chưa chấm"}</span>
                      )}
                    </td>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2 text-right align-middle tabular-nums">
                      {row.entry ? (
                        <span className="text-[#0f1729]">
                          {row.entry.hours?.toFixed(2) ?? 0}h · {row.entry.days ?? 0}
                        </span>
                      ) : (
                        <span className="text-[#cbd5e1]">—</span>
                      )}
                    </td>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2 text-right align-middle">
                      {canEdit && !row.isFuture ? (
                        <span className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setDialogDate(row.ymd);
                            }}
                            className="status-action"
                          >
                            {row.entry ? "Sửa giờ" : "Chấm công"}
                          </button>
                          {row.entry && canDeleteTimesheet ? (
                            <ConfirmActionButton
                              title={`Xóa chấm công ngày ${vnDate(row.ymd)}?`}
                              description={`Xóa ngày công của ${employee.fullName} (${formatShift(row.entry)} · ${row.entry.hours?.toFixed(2) ?? 0} giờ). Ngày này sẽ không được tính lương.`}
                              confirmLabel="Xóa ngày công"
                              tone="danger"
                              disabled={loading}
                              className="status-action"
                              onConfirm={() => deleteDay(row.entry!.id, row.ymd)}
                            >
                              Xóa
                            </ConfirmActionButton>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-xs text-[#cbd5e1]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleDays.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-[#64748b]">
                      Chưa chấm công ngày nào trong tháng này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
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
                  <span className="w-[92px] shrink-0 text-xs text-[#94a3b8]">{vnDate(item.workDate.slice(0, 10))}</span>
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
          <p className="mt-2 text-xs text-[#94a3b8]">1 công = 8 giờ. Giờ dạy/trợ giảng tính riêng theo đơn giá giờ dạy.</p>
        </Section>
      </div>

      <CheckInDialog
        open={dialogDate !== null}
        title={dialogEntry ? `Sửa giờ chấm công` : "Chấm công một ngày"}
        subtitle={dialogDate ? `${employee.fullName} · ngày ${vnDate(dialogDate)}` : undefined}
        initialTimes={
          dialogEntry
            ? {
                checkInAm: dialogEntry.checkInAm ?? "",
                checkOutAm: dialogEntry.checkOutAm ?? "",
                checkInPm: dialogEntry.checkInPm ?? "",
                checkOutPm: dialogEntry.checkOutPm ?? "",
              }
            : defaultShift ?? SHIFT_PRESETS[0].times
        }
        initialNotes={dialogEntry?.notes ?? ""}
        confirmLabel="Lưu chấm công"
        loading={loading}
        error={error}
        onClose={() => {
          if (!loading) {
            setDialogDate(null);
            setError(null);
          }
        }}
        onConfirm={(times, notes) => {
          if (!dialogDate) return;
          void saveDay(dialogDate, times, notes);
        }}
      />
    </ResponsiveDrawer>
  );
}
