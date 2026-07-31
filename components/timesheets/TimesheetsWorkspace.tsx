"use client";

import { useMemo, useState } from "react";

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

type EmployeeRow = {
  id: string;
  fullName: string;
  employeeCode: string;
  position: string | null;
  workStatus: string;
  timesheetEntries: Entry[];
};

function formatVnDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function hoursFromRange(start: string, end: string) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((item) => Number.isNaN(item))) return 0;
  return Math.max(0, eh + em / 60 - (sh + sm / 60));
}

function computeHours(row: { checkInAm: string; checkOutAm: string; checkInPm: string; checkOutPm: string }) {
  return hoursFromRange(row.checkInAm, row.checkOutAm) + hoursFromRange(row.checkInPm, row.checkOutPm);
}

function toYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function TimesheetsWorkspace({
  employees,
  monthLabel,
  defaultDate,
}: {
  employees: EmployeeRow[];
  monthLabel: string;
  defaultDate: string;
}) {
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, { checkInAm: string; checkOutAm: string; checkInPm: string; checkOutPm: string; notes: string }>>(() =>
    Object.fromEntries(
      employees.map((employee) => {
        const matched = employee.timesheetEntries.find((entry) => entry.workDate.slice(0, 10) === defaultDate);
        return [
          employee.id,
          {
            checkInAm: matched?.checkInAm ?? "08:00",
            checkOutAm: matched?.checkOutAm ?? "12:00",
            checkInPm: matched?.checkInPm ?? "13:30",
            checkOutPm: matched?.checkOutPm ?? "17:30",
            notes: matched?.notes ?? "",
          },
        ];
      }),
    ),
  );

  const activeEmployees = useMemo(() => employees.filter((item) => item.workStatus === "ACTIVE"), [employees]);
  const stats = useMemo(() => {
    const entriesToday = employees.filter((employee) => employee.timesheetEntries.some((entry) => entry.workDate.slice(0, 10) === selectedDate));
    const monthDays = employees.reduce((sum, employee) => sum + employee.timesheetEntries.reduce((entrySum, entry) => entrySum + (entry.days ?? 0), 0), 0);
    const monthHours = employees.reduce((sum, employee) => sum + employee.timesheetEntries.reduce((entrySum, entry) => entrySum + (entry.hours ?? 0), 0), 0);
    return {
      activeCount: activeEmployees.length,
      checkedTodayCount: entriesToday.length,
      monthDays: Math.round(monthDays * 100) / 100,
      monthHours: Math.round(monthHours * 100) / 100,
    };
  }, [activeEmployees.length, employees, selectedDate]);

  function loadDate(date: string) {
    setSelectedDate(date);
    setRows(
      Object.fromEntries(
        employees.map((employee) => {
          const matched = employee.timesheetEntries.find((entry) => entry.workDate.slice(0, 10) === date);
          return [
            employee.id,
            {
              checkInAm: matched?.checkInAm ?? "08:00",
              checkOutAm: matched?.checkOutAm ?? "12:00",
              checkInPm: matched?.checkInPm ?? "13:30",
              checkOutPm: matched?.checkOutPm ?? "17:30",
              notes: matched?.notes ?? "",
            },
          ];
        }),
      ),
    );
    setNotice(null);
    setError(null);
  }

  function patchRow(employeeId: string, field: "checkInAm" | "checkOutAm" | "checkInPm" | "checkOutPm" | "notes", value: string) {
    setRows((current) => ({
      ...current,
      [employeeId]: {
        ...current[employeeId],
        [field]: value,
      },
    }));
    setNotice(null);
  }

  async function saveEmployee(employeeId: string) {
    setSavingId(employeeId);
    setError(null);
    setNotice(null);

    const payload = {
      employeeId,
      workDate: selectedDate,
      ...rows[employeeId],
    };

    const response = await fetch("/api/timesheet-entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    setSavingId(null);

    if (!response.ok) {
      setError(result.error ?? "Không lưu được chấm công.");
      return;
    }

    setNotice("Đã lưu chấm công.");
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f8fcff_0%,#eef7ff_48%,#ffffff_100%)] p-6 shadow-[0_24px_70px_-42px_rgba(14,116,144,0.35)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Chấm công hành chính
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Bảng chấm công ngày</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted80 sm:text-base">
                Ghi công cho hành chính/văn phòng theo đúng 4 mốc thực tế: đến sáng, về sáng, đến chiều, về chiều.
                Công dạy của giáo viên và trợ giảng không nhập ở đây.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Tháng đang xem</p>
              <p className="mt-2 text-lg font-semibold text-ink">{monthLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">NV đang làm</p>
              <p className="mt-2 text-lg font-semibold text-ink">{stats.activeCount}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Đã chấm ngày này</p>
              <p className="mt-2 text-lg font-semibold text-emerald-600">{stats.checkedTodayCount}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Tổng công tháng</p>
              <p className="mt-2 text-lg font-semibold text-ink">{stats.monthDays}</p>
              <p className="mt-1 text-xs text-ink-muted48">{stats.monthHours} giờ chấm công</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
        <div className="card space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Bước 1</p>
              <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">Chấm công theo ngày</h2>
              <p className="mt-1 text-sm text-ink-muted48">Chọn đúng ngày rồi nhập 4 mốc thời gian. Hệ thống tự tính giờ và số công từ dữ liệu thực.</p>
            </div>
            <label className="space-y-2">
              <span className="label">Ngày chấm công</span>
              <input type="date" className="input min-w-[220px]" value={selectedDate} onChange={(event) => loadDate(event.target.value)} />
            </label>
          </div>

          {error ? <div className="alert-danger">{error}</div> : null}
          {notice ? <div className="alert-success">{notice}</div> : null}

          <div className="space-y-4">
            {activeEmployees.map((employee) => {
              const row = rows[employee.id];
              const workedHours = computeHours(row);
              const workedDays = Math.round((workedHours / 8) * 100) / 100;
              const existingEntry = employee.timesheetEntries.find((entry) => entry.workDate.slice(0, 10) === selectedDate);

              return (
                <div key={employee.id} className="rounded-[24px] border border-[#d7ecff] bg-white/90 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-lg font-bold text-sky-700">
                        {employee.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-ink">{employee.fullName}</p>
                        <p className="mt-1 text-xs text-ink-muted48">{employee.employeeCode} · {employee.position ?? "Chưa khai báo vị trí"}</p>
                        <p className="mt-1 text-xs text-ink-muted48">
                          {existingEntry ? `Đã có bản ghi ngày ${formatVnDate(selectedDate)} · lần này lưu sẽ cập nhật lại` : `Chưa có bản ghi cho ngày ${formatVnDate(selectedDate)}`}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-ink-muted48">Giờ thực</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{workedHours.toFixed(2)} giờ</p>
                      </div>
                      <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-ink-muted48">Số công</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{workedDays}</p>
                      </div>
                      <button type="button" onClick={() => saveEmployee(employee.id)} disabled={savingId === employee.id} className="btn-primary">
                        {savingId === employee.id ? "Đang lưu..." : "Lưu dòng này"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-2">
                      <span className="label text-xs">Đến sáng</span>
                      <input type="time" className="input" value={row.checkInAm} onChange={(event) => patchRow(employee.id, "checkInAm", event.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <span className="label text-xs">Về sáng</span>
                      <input type="time" className="input" value={row.checkOutAm} onChange={(event) => patchRow(employee.id, "checkOutAm", event.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <span className="label text-xs">Đến chiều</span>
                      <input type="time" className="input" value={row.checkInPm} onChange={(event) => patchRow(employee.id, "checkInPm", event.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <span className="label text-xs">Về chiều</span>
                      <input type="time" className="input" value={row.checkOutPm} onChange={(event) => patchRow(employee.id, "checkOutPm", event.target.value)} />
                    </label>
                  </div>

                  <label className="mt-3 block space-y-2">
                    <span className="label text-xs">Ghi chú ngày công</span>
                    <input
                      className="input"
                      value={row.notes}
                      onChange={(event) => patchRow(employee.id, "notes", event.target.value)}
                      placeholder="Ví dụ: đi muộn 15 phút, nghỉ phép buổi sáng, hỗ trợ sự kiện cuối giờ..."
                    />
                  </label>
                </div>
              );
            })}

            {activeEmployees.length === 0 ? <p className="text-sm text-ink-muted48">Không có nhân viên đang làm để chấm công.</p> : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Nguyên tắc hệ thống</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-2xl border border-hairline p-4">
                <p className="font-semibold text-ink">Luồng chấm công này dành cho ai?</p>
                <p className="mt-1 text-ink-muted48">Chỉ dùng cho hành chính, văn phòng, điều phối. Giáo viên và trợ giảng lấy công dạy từ buổi học đã phân công.</p>
              </div>
              <div className="rounded-2xl border border-hairline p-4">
                <p className="font-semibold text-ink">Hệ thống tính công thế nào?</p>
                <p className="mt-1 text-ink-muted48">Tổng giờ = giờ sáng + giờ chiều. Số công = tổng giờ / 8 và làm tròn 2 chữ số thập phân.</p>
              </div>
              <div className="rounded-2xl border border-hairline p-4">
                <p className="font-semibold text-ink">Nếu nhập sai thì sao?</p>
                <p className="mt-1 text-ink-muted48">Lưu lại cùng ngày sẽ cập nhật bản ghi cũ, không bị kẹt vì lỗi trùng ngày như trước nữa.</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Tổng hợp tháng</h2>
            <div className="mt-3 space-y-3">
              {employees.map((employee) => {
                const monthDays = employee.timesheetEntries.reduce((sum, entry) => sum + (entry.days ?? 0), 0);
                const monthHours = employee.timesheetEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
                const latest = employee.timesheetEntries[0] ?? null;
                return (
                  <div key={employee.id} className="rounded-2xl border border-hairline bg-canvas-parchment/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{employee.fullName}</p>
                        <p className="mt-1 text-xs text-ink-muted48">{employee.employeeCode} · {employee.position ?? "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink">{monthDays} công</p>
                        <p className="mt-1 text-xs text-ink-muted48">{monthHours.toFixed(2)} giờ</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted48">
                      {latest ? `Gần nhất: ${formatVnDate(latest.workDate)} · ${latest.hours ?? 0} giờ` : "Chưa có chấm công tháng này"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
