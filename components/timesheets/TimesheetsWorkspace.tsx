"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column } from "@/components/ui/DataTable/DataTable";
import TimesheetEmployeeDrawer, { type TimesheetEmployee } from "@/components/timesheets/TimesheetEmployeeDrawer";
import ShiftPicker from "@/components/timesheets/ShiftPicker";
import CheckInDialog from "@/components/timesheets/CheckInDialog";
import { formatShift, loadSavedShift, saveShift, shiftHours, SHIFT_PRESETS, type ShiftTimes } from "@/lib/timesheet-shifts";

const PAGE_SIZE = 15;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function vnDate(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export default function TimesheetsWorkspace({
  employees,
  month,
  today,
  canEditTimesheet,
  canDeleteTimesheet,
}: {
  employees: TimesheetEmployee[];
  /** "YYYY-MM" — tháng đang xem. Chấm công đi theo tháng giống lương, để đối chiếu
   *  công/lương cùng một mốc thời gian thay vì mỗi bên một kiểu. */
  month: string;
  /** "YYYY-MM-DD" của hôm nay, tính ở server để tránh lệch máy client. */
  today: string;
  canEditTimesheet: boolean;
  canDeleteTimesheet: boolean;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Ca đang dùng cho các nút chấm nhanh — nhớ lại ca lần trước (cơ sở dạy chiều–tối
  // không phải sửa lại mỗi lần).
  const [shift, setShift] = useState<ShiftTimes>(() => (typeof window === "undefined" ? SHIFT_PRESETS[0].times : loadSavedShift()));
  const [shiftOpen, setShiftOpen] = useState(false);
  // Hộp chấm công đang mở: 1 người trong ngày, cả cơ sở trong ngày, hoặc cả tháng.
  const [dialog, setDialog] = useState<
    | { kind: "one"; employee: TimesheetEmployee; date: string; times: ShiftTimes; notes: string }
    | { kind: "day" }
    | { kind: "month" }
    | null
  >(null);
  const [overwriteMonth, setOverwriteMonth] = useState(false);

  function updateShift(next: ShiftTimes) {
    setShift(next);
    saveShift(next);
  }

  const showToday = today.startsWith(month);
  // Nút chấm cả cơ sở chỉ chấm nhân sự hưởng lương THÁNG (cùng quy tắc với API) — giáo
  // viên/trợ giảng tính công theo buổi dạy, không đi qua chấm công ngày.
  const notCheckedToday = showToday
    ? employees.filter((item) => item.payMode === "MONTHLY" && !item.timesheetEntries.some((entry) => entry.workDate.slice(0, 10) === today))
    : [];

  // Chấm công qua API chấm hàng loạt (đi qua đủ chốt an toàn: kỳ công đã khóa, ngày lễ,
  // không đè ngày đã chấm) — khác nhau chỉ ở phạm vi ngày/tháng và danh sách nhân sự.
  async function runBulk(params: { times: ShiftTimes; notes?: string; date?: string; employeeIds?: string[]; overwrite?: boolean }) {
    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/timesheet-entries/bulk-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month,
        ...params.times,
        ...(params.date ? { date: params.date } : {}),
        ...(params.employeeIds ? { employeeIds: params.employeeIds } : {}),
        ...(params.overwrite ? { overwrite: true } : {}),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không chấm công được.");
      return;
    }
    setDialog(null);
    setMessage(result.message ?? "Đã chấm công.");
    router.refresh();
  }

  // Chấm/sửa 1 người 1 ngày: dùng PUT (ghi đè đúng ngày đó) vì người dùng đã chọn rõ giờ.
  async function saveOne(employeeId: string, date: string, times: ShiftTimes, notes: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/timesheet-entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, workDate: date, ...times, notes }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không lưu được chấm công.");
      return;
    }
    setDialog(null);
    setMessage(`Đã lưu chấm công ngày ${vnDate(date)}: ${formatShift(times)}.`);
    router.refresh();
  }

  // Lọc ngay ở client: toàn bộ nhân sự của tháng đã nằm sẵn trong props (vài chục người).
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((item) =>
      [item.fullName, item.employeeCode, item.position ?? ""].some((field) => field.toLowerCase().includes(query)),
    );
  }, [employees, search]);

  const selected = employees.find((item) => item.id === openId) ?? null;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEmployees = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: Column<TimesheetEmployee>[] = [
    {
      key: "fullName",
      label: "Nhân viên",
      render: (value, row) => (
        <div>
          <p className="font-semibold text-[#0f1729]">{value}</p>
          <p className="mt-0.5 text-xs text-[#94a3b8]">
            {row.employeeCode}
            {row.position ? ` · ${row.position}` : ""}
            {row.payMode !== "MONTHLY" ? " · theo giờ dạy" : ""}
          </p>
        </div>
      ),
    },
    {
      key: "timesheetEntries",
      label: "Công hành chính",
      render: (_value, row) => {
        const days = round2(row.timesheetEntries.reduce((sum, entry) => sum + (entry.days ?? 0), 0));
        const hours = round2(row.timesheetEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0));
        return row.timesheetEntries.length === 0 ? (
          <span className="text-sm text-[#94a3b8]">Chưa chấm ngày nào</span>
        ) : (
          <p className="text-sm text-[#0f1729]">
            <span className="font-semibold">{days} công</span>
            <span className="text-[#64748b]">
              {" "}
              · {hours} giờ · {row.timesheetEntries.length} ngày
            </span>
          </p>
        );
      },
    },
    {
      key: "sessionAssignments",
      label: "Buổi dạy / TG",
      render: (_value, row) => {
        const hours = round2(row.sessionAssignments.reduce((sum, item) => sum + (item.hours ?? 0), 0));
        return row.sessionAssignments.length === 0 ? (
          <span className="text-sm text-[#94a3b8]">—</span>
        ) : (
          <p className="text-sm text-[#0f1729]">
            <span className="font-semibold">{row.sessionAssignments.length} buổi</span>
            <span className="text-[#64748b]"> · {hours} giờ</span>
          </p>
        );
      },
    },
    ...(showToday
      ? [
          {
            key: "id" as const,
            label: `Hôm nay ${vnDate(today)}`,
            render: (_value: unknown, row: TimesheetEmployee) => {
              const entry = row.timesheetEntries.find((item) => item.workDate.slice(0, 10) === today);
              // Đã chấm: hiện RÕ làm từ mấy giờ tới mấy giờ, không chỉ số giờ.
              if (entry) {
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[#e2e8f0] bg-white px-2 py-1 text-xs font-bold tabular-nums text-[#0f1729]">
                      {formatShift(entry)}
                    </span>
                    <span className="text-xs text-[#64748b]">
                      {entry.hours?.toFixed(2) ?? 0}h · {entry.days ?? 0} công
                    </span>
                    {canEditTimesheet ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDialog({
                            kind: "one",
                            employee: row,
                            date: today,
                            times: {
                              checkInAm: entry.checkInAm ?? "",
                              checkOutAm: entry.checkOutAm ?? "",
                              checkInPm: entry.checkInPm ?? "",
                              checkOutPm: entry.checkOutPm ?? "",
                            },
                            notes: entry.notes ?? "",
                          });
                        }}
                        className="text-xs font-bold text-[#0f1729] underline underline-offset-2"
                      >
                        Sửa giờ
                      </button>
                    ) : null}
                  </div>
                );
              }
              return canEditTimesheet ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDialog({ kind: "one", employee: row, date: today, times: shift, notes: "" });
                  }}
                  className="rounded-md border border-[#0f1729] bg-[#0f1729] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1e293b]"
                >
                  Chấm công…
                </button>
              ) : (
                <span className="rounded-md border border-[#e2e8f0] bg-white px-2 py-1 text-xs font-bold text-[#94a3b8]">Chưa chấm</span>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-[#0f1729] sm:text-2xl">Chấm công</h1>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Ca đang dùng: <strong className="tabular-nums text-[#0f1729]">{formatShift(shift)}</strong> ({shiftHours(shift).toFixed(2)}h/ngày)
          </p>
        </div>
        <input
          type="month"
          className="input w-auto text-sm"
          value={month}
          onChange={(event) => {
            if (event.target.value) router.push(`/timesheets?month=${event.target.value}`);
          }}
        />
      </div>

      {canEditTimesheet ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0f1729]">Chấm công nhanh</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">
                Ca đang dùng <strong className="tabular-nums">{formatShift(shift)}</strong>. Bấm một nút bên cạnh để chấm theo ca này —
                mỗi lần bấm vẫn mở hộp cho sửa giờ trước khi lưu. Ngày đã chấm được giữ nguyên, Chủ nhật và ngày lễ tự bỏ qua.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => setShiftOpen((current) => !current)} className="btn-ghost-sm">
                {shiftOpen ? "Ẩn đổi ca" : "Đổi ca mặc định"}
              </button>
              {showToday ? (
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "day" })}
                  disabled={loading || notCheckedToday.length === 0}
                  className="rounded-lg bg-[#0f1729] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1e293b] disabled:opacity-50"
                >
                  {notCheckedToday.length === 0
                    ? `Hôm nay ${vnDate(today)} đã chấm đủ`
                    : `Chấm hôm nay ${vnDate(today)} · ${notCheckedToday.length} người`}
                </button>
              ) : null}
              <button type="button" onClick={() => setDialog({ kind: "month" })} disabled={loading} className="btn-ghost-sm">
                Chấm cả tháng {month}
              </button>
            </div>
          </div>

          {shiftOpen ? (
            <div className="mt-3 border-t border-[#f1f5f9] pt-3">
              <ShiftPicker value={shift} onChange={updateShift} />
              <p className="mt-2 text-xs text-[#94a3b8]">Ca này được nhớ lại cho lần sau trên máy của bạn.</p>
            </div>
          ) : null}

          {message ? <p className="mt-2 text-sm font-semibold text-[#0f1729]">{message}</p> : null}
          {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
        </div>
      ) : null}

      <DataTableResponsive
        data={pagedEmployees}
        columns={columns}
        rowKey="id"
        searchable
        searchPlaceholder="Tìm theo tên, mã NV..."
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        selectable={false}
        showCountBadge={false}
        onRowClick={(row) => setOpenId(row.id)}
        primaryColumn="fullName"
        secondaryColumns={["timesheetEntries", "sessionAssignments"]}
        emptyState={{ title: "Không có nhân viên nào", description: "Chưa có nhân sự đang làm việc." }}
        pagination={{
          total: filtered.length,
          page: currentPage,
          pageSize: PAGE_SIZE,
          onPageChange: (nextPage) => setPage(nextPage),
          onPageSizeChange: () => {},
        }}
      />

      {selected ? (
        <TimesheetEmployeeDrawer
          open={Boolean(openId)}
          onClose={() => setOpenId(null)}
          employee={selected}
          month={month}
          today={today}
          defaultShift={shift}
          canEdit={canEditTimesheet}
          canDeleteTimesheet={canDeleteTimesheet}
        />
      ) : null}

      {/* Chấm 1 người 1 ngày — chọn giờ trước khi lưu */}
      <CheckInDialog
        open={dialog?.kind === "one"}
        title={dialog?.kind === "one" ? `Chấm công ${dialog.employee.fullName}` : ""}
        subtitle={dialog?.kind === "one" ? `Ngày ${vnDate(dialog.date)} · ${dialog.employee.employeeCode}` : undefined}
        initialTimes={dialog?.kind === "one" ? dialog.times : shift}
        initialNotes={dialog?.kind === "one" ? dialog.notes : ""}
        confirmLabel="Lưu chấm công"
        loading={loading}
        error={error}
        onClose={() => {
          if (!loading) {
            setDialog(null);
            setError(null);
          }
        }}
        onConfirm={(times, notes) => {
          if (dialog?.kind !== "one") return;
          void saveOne(dialog.employee.id, dialog.date, times, notes);
        }}
      />

      {/* Chấm cả cơ sở trong ngày hôm nay */}
      <CheckInDialog
        open={dialog?.kind === "day"}
        title={`Chấm công hôm nay ${vnDate(today)}`}
        subtitle={`${notCheckedToday.length} nhân sự hành chính chưa chấm: ${notCheckedToday
          .slice(0, 4)
          .map((item) => item.fullName)
          .join(", ")}${notCheckedToday.length > 4 ? `, +${notCheckedToday.length - 4} người` : ""}`}
        initialTimes={shift}
        confirmLabel={`Chấm cho ${notCheckedToday.length} người`}
        loading={loading}
        error={error}
        onClose={() => {
          if (!loading) {
            setDialog(null);
            setError(null);
          }
        }}
        onConfirm={(times, notes) => {
          updateShift(times);
          void runBulk({ times, notes, date: today });
        }}
      />

      {/* Chấm cả tháng theo ca */}
      <CheckInDialog
        open={dialog?.kind === "month"}
        title={`Chấm công cả tháng ${month}`}
        subtitle="Điền ngày công từ thứ 2 đến thứ 7 cho nhân sự hưởng lương tháng, bỏ Chủ nhật và ngày lễ, không chấm ngày tương lai."
        initialTimes={shift}
        confirmLabel="Chấm cả tháng"
        loading={loading}
        error={error}
        extra={
          <label className="flex items-start gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs text-[#475569]">
            <input type="checkbox" className="mt-0.5" checked={overwriteMonth} onChange={(event) => setOverwriteMonth(event.target.checked)} />
            <span>
              Ghi đè cả những ngày đã chấm trước đó.{" "}
              <strong className="text-[#b45309]">Bỏ trống nếu chỉ muốn điền các ngày còn trống</strong> — an toàn hơn vì giữ nguyên các ngày đã sửa tay.
            </span>
          </label>
        }
        onClose={() => {
          if (!loading) {
            setDialog(null);
            setError(null);
          }
        }}
        onConfirm={(times, notes) => {
          updateShift(times);
          void runBulk({ times, notes, overwrite: overwriteMonth });
        }}
      />
    </div>
  );
}
