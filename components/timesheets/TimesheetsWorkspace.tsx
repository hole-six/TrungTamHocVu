"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

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

const DEFAULT_TIMES = { checkInAm: "08:00", checkOutAm: "12:00", checkInPm: "13:30", checkOutPm: "17:30" };
const PAGE_SIZE = 15;

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

export default function TimesheetsWorkspace({
  employees,
  monthLabel,
  defaultDate,
  canManageEmployees,
}: {
  employees: EmployeeRow[];
  monthLabel: string;
  defaultDate: string;
  canManageEmployees: boolean;
}) {
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  // Chỉ nhân viên đang mở để chấm công mới có form giờ hiện ra — tránh render 4 ô giờ
  // cho hàng trăm người cùng lúc, vốn là nguyên nhân chính khiến trang nặng/khó dùng.
  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ checkInAm: string; checkOutAm: string; checkInPm: string; checkOutPm: string; notes: string }>({
    ...DEFAULT_TIMES,
    notes: "",
  });

  const activeEmployees = useMemo(() => employees.filter((item) => item.workStatus === "ACTIVE"), [employees]);

  const positionOptions = useMemo(() => {
    const set = new Set<string>();
    activeEmployees.forEach((employee) => set.add(employee.position?.trim() || "Chưa khai báo"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [activeEmployees]);

  const entryOnSelectedDate = (employee: EmployeeRow) => employee.timesheetEntries.find((entry) => entry.workDate.slice(0, 10) === selectedDate) ?? null;

  const filteredEmployees = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return activeEmployees.filter((employee) => {
      const positionLabel = employee.position?.trim() || "Chưa khai báo";
      if (positionFilter !== "ALL" && positionLabel !== positionFilter) return false;
      if (!kw) return true;
      return employee.fullName.toLowerCase().includes(kw) || employee.employeeCode.toLowerCase().includes(kw);
    });
  }, [activeEmployees, keyword, positionFilter]);

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

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEmployees = filteredEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [keyword, positionFilter, selectedDate]);

  function loadDate(date: string) {
    setSelectedDate(date);
    setOpenEmployeeId(null);
    setNotice(null);
    setError(null);
  }

  function openRow(employee: EmployeeRow) {
    const existing = entryOnSelectedDate(employee);
    setDraft({
      checkInAm: existing?.checkInAm ?? DEFAULT_TIMES.checkInAm,
      checkOutAm: existing?.checkOutAm ?? DEFAULT_TIMES.checkOutAm,
      checkInPm: existing?.checkInPm ?? DEFAULT_TIMES.checkInPm,
      checkOutPm: existing?.checkOutPm ?? DEFAULT_TIMES.checkOutPm,
      notes: existing?.notes ?? "",
    });
    setOpenEmployeeId(employee.id);
    setNotice(null);
    setError(null);
  }

  function closeRow() {
    setOpenEmployeeId(null);
  }

  async function saveEmployee(employeeId: string) {
    setSavingId(employeeId);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/timesheet-entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, workDate: selectedDate, ...draft }),
    });
    const result = await response.json().catch(() => ({}));

    setSavingId(null);

    if (!response.ok) {
      setError(result.error ?? "Không lưu được chấm công.");
      return;
    }

    setNotice("Đã lưu chấm công.");
    setOpenEmployeeId(null);
    // Next.js server component ở page.tsx cần refresh để entries mới nhất được nạp lại.
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Chấm công ngày</h1>
              <p className="mt-1 text-sm text-ink-muted48">Tìm đúng nhân viên, bấm Chấm công, điền giờ rồi lưu — không cần cuộn qua cả danh sách.</p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-medium text-sky-700">Tháng {monthLabel}</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">Đang làm {stats.activeCount}</span>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-medium text-violet-700">Đã chấm hôm nay {stats.checkedTodayCount}</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-700">Công tháng {stats.monthDays}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="space-y-2">
              <span className="label">Ngày chấm công</span>
              <input type="date" className="input min-w-[220px]" value={selectedDate} onChange={(event) => loadDate(event.target.value)} />
            </label>
            {canManageEmployees ? (
              <Link href="/payroll" className="btn-ghost">
                Nhân sự
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div className="card space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">Danh sách chấm công</h2>
              <p className="mt-1 text-sm text-ink-muted48">Ngày {formatVnDate(selectedDate)} · {filteredEmployees.length} nhân viên đang hiển thị</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="input flex-1"
              placeholder="Tìm theo tên hoặc mã nhân viên..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <select className="input sm:w-56" value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
              <option value="ALL">Tất cả vị trí</option>
              {positionOptions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>

          {error ? <div className="alert-danger">{error}</div> : null}
          {notice ? <div className="alert-success">{notice}</div> : null}

          <div className="overflow-hidden rounded-2xl border border-hairline">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-hairline bg-canvas-parchment/50 text-xs uppercase tracking-wide text-ink-muted48">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nhân viên</th>
                    <th className="px-4 py-3 font-medium">Vị trí</th>
                    <th className="px-4 py-3 font-medium">Ngày {formatVnDate(selectedDate)}</th>
                    <th className="px-4 py-3 font-medium">Công tháng</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedEmployees.map((employee) => {
                    const existing = entryOnSelectedDate(employee);
                    const isOpen = openEmployeeId === employee.id;
                    const monthDays = employee.timesheetEntries.reduce((sum, entry) => sum + (entry.days ?? 0), 0);
                    const previewHours = isOpen ? computeHours(draft) : existing?.hours ?? 0;

                    return (
                      <Fragment key={employee.id}>
                        <tr className="border-b border-hairline last:border-0 hover:bg-canvas-parchment/30">
                          <td className="px-4 py-3">
                            <p className="font-medium text-ink">{employee.fullName}</p>
                            <p className="mt-0.5 text-xs text-ink-muted48">{employee.employeeCode}</p>
                          </td>
                          <td className="px-4 py-3 text-ink-muted80">{employee.position ?? "—"}</td>
                          <td className="px-4 py-3">
                            {existing ? (
                              <span className="badge bg-emerald-100 text-emerald-700">Đã chấm · {existing.hours?.toFixed(2) ?? 0}h</span>
                            ) : (
                              <span className="badge bg-ink/5 text-ink-muted64">Chưa chấm</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-ink-muted80">{Math.round(monthDays * 100) / 100} công</td>
                          <td className="px-4 py-3 text-right">
                            {isOpen ? (
                              <button type="button" onClick={closeRow} className="btn-ghost-sm">
                                Đóng
                              </button>
                            ) : (
                              <button type="button" onClick={() => openRow(employee)} className="btn-primary-sm">
                                {existing ? "Sửa" : "Chấm công"}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr className="border-b border-hairline bg-[#f8fbff] last:border-0">
                            <td colSpan={5} className="px-4 py-4">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                                <label className="space-y-1">
                                  <span className="label text-xs">Đến sáng</span>
                                  <input type="time" className="input" value={draft.checkInAm} onChange={(event) => setDraft((d) => ({ ...d, checkInAm: event.target.value }))} />
                                </label>
                                <label className="space-y-1">
                                  <span className="label text-xs">Về sáng</span>
                                  <input type="time" className="input" value={draft.checkOutAm} onChange={(event) => setDraft((d) => ({ ...d, checkOutAm: event.target.value }))} />
                                </label>
                                <label className="space-y-1">
                                  <span className="label text-xs">Đến chiều</span>
                                  <input type="time" className="input" value={draft.checkInPm} onChange={(event) => setDraft((d) => ({ ...d, checkInPm: event.target.value }))} />
                                </label>
                                <label className="space-y-1">
                                  <span className="label text-xs">Về chiều</span>
                                  <input type="time" className="input" value={draft.checkOutPm} onChange={(event) => setDraft((d) => ({ ...d, checkOutPm: event.target.value }))} />
                                </label>
                                <div className="space-y-1">
                                  <span className="label text-xs">Giờ / công tính được</span>
                                  <p className="input flex items-center bg-white font-semibold text-ink">
                                    {previewHours.toFixed(2)} giờ · {(Math.round((previewHours / 8) * 100) / 100).toFixed(2)} công
                                  </p>
                                </div>
                              </div>
                              <label className="mt-3 block space-y-1">
                                <span className="label text-xs">Ghi chú ngày công</span>
                                <input
                                  className="input"
                                  value={draft.notes}
                                  onChange={(event) => setDraft((d) => ({ ...d, notes: event.target.value }))}
                                  placeholder="Ví dụ: đi muộn 15 phút, nghỉ phép buổi sáng, hỗ trợ sự kiện cuối giờ..."
                                />
                              </label>
                              <div className="mt-3 flex items-center gap-2">
                                <button type="button" onClick={() => saveEmployee(employee.id)} disabled={savingId === employee.id} className="btn-primary">
                                  {savingId === employee.id ? "Đang lưu..." : "Lưu chấm công"}
                                </button>
                                <button type="button" onClick={closeRow} className="btn-ghost">
                                  Huỷ
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}

                  {pagedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-ink-muted48">
                        Không có nhân viên nào khớp bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="text-ink-muted48">
                Trang {currentPage}/{totalPages} · {filteredEmployees.length} nhân viên
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Nguyên tắc</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-2xl border border-hairline p-4">
                <p className="font-semibold text-ink">Dùng cho ai?</p>
                <p className="mt-1 text-ink-muted48">Chủ yếu cho hành chính, văn phòng, điều phối. Giáo viên/trợ giảng lấy công dạy tự động từ buổi học đã phân công — chỉ chấm công thêm nếu họ có làm việc hành chính ngoài giờ dạy.</p>
              </div>
              <div className="rounded-2xl border border-hairline p-4">
                <p className="font-semibold text-ink">Tính công thế nào?</p>
                <p className="mt-1 text-ink-muted48">Tổng giờ = giờ sáng + giờ chiều. Số công = tổng giờ / 8, làm tròn 2 chữ số thập phân.</p>
              </div>
              <div className="rounded-2xl border border-hairline p-4">
                <p className="font-semibold text-ink">Nhập sai thì sao?</p>
                <p className="mt-1 text-ink-muted48">Bấm "Sửa" trên đúng ngày đó, lưu lại sẽ cập nhật đè lên bản ghi cũ.</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Tổng hợp tháng</h2>
            <p className="mt-1 text-xs text-ink-muted48">{stats.monthHours} giờ chấm công trong tháng, toàn bộ nhân viên</p>
            <div className="mt-3 space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredEmployees.map((employee) => {
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
                        <p className="text-sm font-semibold text-ink">{Math.round(monthDays * 100) / 100} công</p>
                        <p className="mt-1 text-xs text-ink-muted48">{monthHours.toFixed(2)} giờ</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted48">
                      {latest ? `Gần nhất: ${formatVnDate(latest.workDate)} · ${latest.hours ?? 0} giờ` : "Chưa có chấm công tháng này"}
                    </p>
                  </div>
                );
              })}
              {filteredEmployees.length === 0 ? <p className="text-sm text-ink-muted48">Không có nhân viên nào khớp bộ lọc.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
