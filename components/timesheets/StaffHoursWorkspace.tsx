"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { exportSectionsToExcel } from "@/lib/export-utils";

// BẢNG GIỜ DỰ KIẾN & GIỜ THỰC TẾ — xem theo cả tháng hoặc theo từng tuần.
//
// Giờ dự kiến lấy từ THỜI KHÓA BIỂU đã phân công (gồm cả buổi sau đó trung tâm cho nghỉ),
// giờ thực tế là buổi đã dạy + công hành chính. Cột "Vì sao lệch" tự giải thích phần chênh;
// cột "Ghi chú" để người phụ trách ghi thêm. Xem lib/server/staff-hours.ts.

type Bucket = {
  plannedHours: number;
  plannedSessions: number;
  actualHours: number;
  actualSessions: number;
  cancelledHours: number;
  upcomingHours: number;
  substituteHours: number;
  adminHours: number;
  adminDays: number;
};
type Week = Bucket & { key: string; label: string; startDate: string; endDate: string; note: string | null };
type Row = Bucket & {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  position: string | null;
  payMode: string;
  branchName: string | null;
  contractHoursPerMonth: number | null;
  note: string | null;
  weeks: Week[];
};

const h = (value: number) => `${String(Math.round(value * 100) / 100).replace(".", ",")}h`;

function gapText(bucket: Bucket) {
  const parts: string[] = [];
  if (bucket.cancelledHours > 0) parts.push(`trung tâm cho nghỉ ${h(bucket.cancelledHours)}`);
  if (bucket.upcomingHours > 0) parts.push(`chưa tới ngày dạy ${h(bucket.upcomingHours)}`);
  if (bucket.substituteHours > 0) parts.push(`dạy thay ${h(bucket.substituteHours)}`);
  const rest = Math.round((bucket.plannedHours - bucket.actualHours - bucket.cancelledHours - bucket.upcomingHours) * 100) / 100;
  if (rest > 0) parts.push(`buổi đã qua chưa điểm danh ${h(rest)}`);
  return parts.join(" · ");
}

export default function StaffHoursWorkspace({
  month,
  weeks,
  rows,
  canEdit,
}: {
  month: string;
  weeks: { key: string; label: string; startDate: string; endDate: string }[];
  rows: Row[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [scope, setScope] = useState<string>("MONTH");
  const [search, setSearch] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ employeeId: string; value: string } | null>(null);
  const [quotaDraft, setQuotaDraft] = useState<{ employeeId: string; value: string } | null>(null);

  const monthLabel = `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;
  const periodKey = scope === "MONTH" ? month : scope;

  const view = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .map((row) => {
        const bucket = scope === "MONTH" ? row : row.weeks.find((week) => week.key === scope) ?? null;
        const note = scope === "MONTH" ? row.note : bucket && "note" in bucket ? bucket.note : null;
        return { row, bucket, note };
      })
      .filter((item) => item.bucket !== null)
      .filter((item) =>
        !query || [item.row.fullName, item.row.employeeCode, item.row.position ?? ""].some((field) => field.toLowerCase().includes(query)),
      );
  }, [rows, scope, search]);

  const totals = view.reduce(
    (acc, item) => {
      acc.planned += item.bucket!.plannedHours;
      acc.actual += item.bucket!.actualHours + item.bucket!.adminHours;
      acc.cancelled += item.bucket!.cancelledHours;
      return acc;
    },
    { planned: 0, actual: 0, cancelled: 0 },
  );

  async function saveNote(employeeId: string, value: string) {
    setSavingKey(`note-${employeeId}`);
    const res = await fetch("/api/staff-hours/note", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, periodKey, note: value }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingKey(null);
    if (!res.ok) {
      toast.blocked(data.error ?? "Không lưu được ghi chú.", "Không lưu được");
      return;
    }
    setNoteDraft(null);
    router.refresh();
  }

  async function saveQuota(employeeId: string, value: string) {
    setSavingKey(`quota-${employeeId}`);
    const res = await fetch(`/api/employees/${employeeId}/contract-hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractHoursPerMonth: value }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingKey(null);
    if (!res.ok) {
      toast.blocked(data.error ?? "Không lưu được định mức giờ.", "Không lưu được");
      return;
    }
    setQuotaDraft(null);
    router.refresh();
  }

  function exportExcel() {
    exportSectionsToExcel(
      [
        {
          title: `Giờ dự kiến & thực tế — ${scope === "MONTH" ? monthLabel : `tuần ${weeks.find((w) => w.key === scope)?.label ?? scope}`}`,
          columns: [
            { key: "name", label: "Nhân viên" },
            { key: "position", label: "Vị trí" },
            { key: "quota", label: "Định mức giờ/tháng" },
            { key: "planned", label: "Giờ dự kiến" },
            { key: "actualTeach", label: "Giờ dạy thực tế" },
            { key: "admin", label: "Giờ hành chính" },
            { key: "actual", label: "Tổng giờ thực tế" },
            { key: "gap", label: "Chênh lệch" },
            { key: "why", label: "Vì sao lệch" },
            { key: "note", label: "Ghi chú" },
          ],
          rows: view.map((item) => ({
            name: `${item.row.fullName} (${item.row.employeeCode})`,
            position: item.row.position ?? "",
            quota: item.row.contractHoursPerMonth ?? "",
            planned: item.bucket!.plannedHours,
            actualTeach: item.bucket!.actualHours,
            admin: item.bucket!.adminHours,
            actual: Math.round((item.bucket!.actualHours + item.bucket!.adminHours) * 100) / 100,
            gap: Math.round((item.bucket!.actualHours + item.bucket!.adminHours - item.bucket!.plannedHours) * 100) / 100,
            why: gapText(item.bucket!),
            note: item.note ?? "",
          })),
        },
      ],
      `gio-du-kien-thuc-te-${scope === "MONTH" ? month : scope}`,
      "Giờ làm",
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Giờ dự kiến & giờ thực tế</h2>
            <p className="text-xs text-ink-muted48">
              Giờ dự kiến lấy từ thời khóa biểu đã phân công GV/TG. Giờ thực tế = buổi đã dạy + công hành chính.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a className="btn-ghost-sm" href={`/timesheets/hours?month=${prevMonth(month)}`}>‹ Tháng trước</a>
            <span className="text-sm font-bold text-ink">{monthLabel}</span>
            <a className="btn-ghost-sm" href={`/timesheets/hours?month=${nextMonth(month)}`}>Tháng sau ›</a>
            <button type="button" className="btn-ghost-sm" onClick={exportExcel}>Xuất Excel</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="MONTH">Cả tháng</option>
            {weeks.map((week) => (
              <option key={week.key} value={week.key}>Tuần {week.label}</option>
            ))}
          </select>
          <input
            className="input min-w-[200px] flex-1"
            placeholder="Tìm theo tên, mã nhân viên, vị trí..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-[#eff6ff] px-3 py-1 font-semibold text-[#2563eb]">Dự kiến {h(totals.planned)}</span>
          <span className="rounded-full bg-[#ecfdf3] px-3 py-1 font-semibold text-[#15803d]">Thực tế {h(totals.actual)}</span>
          {totals.cancelled > 0 ? (
            <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700">Trung tâm cho nghỉ {h(totals.cancelled)}</span>
          ) : null}
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-[#f8fbff] text-xs uppercase tracking-wide text-[#7b8ea5]">
            <tr>
              <th className="px-4 py-3 font-bold">Nhân viên</th>
              <th className="px-4 py-3 font-bold">Định mức/tháng</th>
              <th className="px-4 py-3 font-bold">Giờ dự kiến</th>
              <th className="px-4 py-3 font-bold">Giờ thực tế</th>
              <th className="px-4 py-3 font-bold">Chênh lệch</th>
              <th className="px-4 py-3 font-bold">Vì sao lệch</th>
              <th className="px-4 py-3 font-bold">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {view.map(({ row, bucket, note }) => {
              const actual = Math.round((bucket!.actualHours + bucket!.adminHours) * 100) / 100;
              const gap = Math.round((actual - bucket!.plannedHours) * 100) / 100;
              const shortOfQuota =
                scope === "MONTH" && row.contractHoursPerMonth != null && bucket!.plannedHours < row.contractHoursPerMonth;
              return (
                <tr key={row.employeeId} className="border-b border-hairline align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#0f1729]">{row.fullName}</p>
                    <p className="mt-0.5 text-xs text-[#94a3b8]">
                      {row.employeeCode}
                      {row.position ? ` · ${row.position}` : ""}
                      {row.payMode === "MONTHLY" ? " · lương tháng" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {quotaDraft?.employeeId === row.employeeId ? (
                      <div className="flex items-center gap-1">
                        <input
                          className="input w-20 py-1 text-sm"
                          type="number"
                          min={0}
                          step={1}
                          autoFocus
                          value={quotaDraft.value}
                          onChange={(event) => setQuotaDraft({ employeeId: row.employeeId, value: event.target.value })}
                        />
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          disabled={savingKey === `quota-${row.employeeId}`}
                          onClick={() => saveQuota(row.employeeId, quotaDraft.value)}
                        >
                          Lưu
                        </button>
                        <button type="button" className="btn-ghost-sm" onClick={() => setQuotaDraft(null)}>Bỏ</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`text-sm ${row.contractHoursPerMonth != null ? "font-semibold text-[#0f1729]" : "text-[#94a3b8]"} ${canEdit ? "hover:underline" : "cursor-default"}`}
                        onClick={() =>
                          canEdit &&
                          setQuotaDraft({ employeeId: row.employeeId, value: row.contractHoursPerMonth != null ? String(row.contractHoursPerMonth) : "" })
                        }
                      >
                        {row.contractHoursPerMonth != null ? h(row.contractHoursPerMonth) : canEdit ? "đặt định mức" : "—"}
                      </button>
                    )}
                    {shortOfQuota ? (
                      <p className="mt-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                        Thiếu {h(row.contractHoursPerMonth! - bucket!.plannedHours)} — xếp thêm lớp
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#0f1729]">{h(bucket!.plannedHours)}</p>
                    <p className="text-xs text-[#94a3b8]">{bucket!.plannedSessions} ca theo lịch</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#0f1729]">{h(actual)}</p>
                    <p className="text-xs text-[#94a3b8]">
                      dạy {h(bucket!.actualHours)} ({bucket!.actualSessions} ca)
                      {bucket!.adminHours > 0 ? ` · hành chính ${h(bucket!.adminHours)}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        gap === 0 ? "bg-[#ecfdf3] text-[#15803d]" : gap > 0 ? "bg-[#eff6ff] text-[#2563eb]" : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {gap > 0 ? `+${h(gap)}` : h(gap)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748b]">{gapText(bucket!) || "Đúng kế hoạch"}</td>
                  <td className="px-4 py-3">
                    {noteDraft?.employeeId === row.employeeId ? (
                      <div className="flex items-start gap-1">
                        <textarea
                          className="input min-h-[60px] w-full py-1 text-sm"
                          autoFocus
                          value={noteDraft.value}
                          onChange={(event) => setNoteDraft({ employeeId: row.employeeId, value: event.target.value })}
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            disabled={savingKey === `note-${row.employeeId}`}
                            onClick={() => saveNote(row.employeeId, noteDraft.value)}
                          >
                            Lưu
                          </button>
                          <button type="button" className="btn-ghost-sm" onClick={() => setNoteDraft(null)}>Bỏ</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`text-left text-sm ${note ? "text-[#0f1729]" : "text-[#94a3b8]"} ${canEdit ? "hover:underline" : "cursor-default"}`}
                        onClick={() => canEdit && setNoteDraft({ employeeId: row.employeeId, value: note ?? "" })}
                      >
                        {note ?? (canEdit ? "thêm ghi chú" : "—")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {view.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#94a3b8]">
                  Không có nhân sự nào khớp.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function prevMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
