"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import ScoreEventDialog, { type ScoreEventDraft } from "@/components/teacher-scores/ScoreEventDialog";

export type ScoreboardRowData = {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  position: string | null;
  shifts: number;
  substituteShifts: number;
  countedShifts: number;
  deducted: number;
  added: number;
  net: number;
  ratio: number | null;
  bonusPercent: number | null;
  events: {
    id: string;
    eventDate: string;
    type: string;
    points: number;
    reason: string | null;
    branchId: string;
    branchName: string;
    fromRequirement: boolean;
  }[];
};

export type PendingCheck = {
  sessionId: string;
  classId: string;
  className: string;
  sessionDate: string;
  employeeId: string;
  employeeName: string;
  requirementText: string;
  reason: string | null;
  status: string;
  scoreDecision: string;
};

function vnDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ratioLabel(ratio: number | null) {
  if (ratio === null) return "—";
  return `${ratio > 0 ? "" : ""}${ratio.toFixed(1)}%`;
}

// CHẤM ĐIỂM TÍCH CỰC cho giáo viên / trợ giảng — gom về 1 chỗ:
//   1. Hộp "chờ xử lý": buổi chưa nộp bài tập, bấm 1 nút là trừ điểm hoặc bỏ qua.
//   2. Bảng điểm tháng: ca làm, điểm trừ/cộng, chỉ số A, %thưởng — chấm điểm ngay tại dòng.
// Trước đây muốn chấm điểm phải vào màn Lương → mở từng nhân sự → gõ 5 ô, và trang
// "Theo dõi bài tập giáo viên" là một bảng lọc 11 cột không ai dùng nổi.
export default function TeacherScoreboard({
  month,
  today,
  rows,
  totals,
  allEmployees,
  branches,
  defaultBranchId,
  pendingChecks,
  canDecide,
}: {
  month: string;
  today: string;
  rows: ScoreboardRowData[];
  totals: { shifts: number; countedShifts: number; deducted: number; added: number; peopleDeducted: number };
  allEmployees: { id: string; fullName: string; employeeCode: string; position: string | null }[];
  branches: { id: string; name: string }[];
  defaultBranchId: string;
  pendingChecks: PendingCheck[];
  canDecide: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState<string | null>(null);
  const [bonusDraft, setBonusDraft] = useState<{ employeeId: string; value: string } | null>(null);
  const [dialog, setDialog] = useState<
    | { mode: "create"; employeeId: string; employeeName: string; draft: ScoreEventDraft }
    | { mode: "edit"; employeeId: string; employeeName: string; eventId: string; draft: ScoreEventDraft }
    | null
  >(null);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [row.fullName, row.employeeCode, row.position ?? ""].some((field) => field.toLowerCase().includes(keyword)),
    );
  }, [rows, search]);

  const scoredIds = new Set(rows.map((row) => row.employeeId));
  const otherEmployees = allEmployees.filter((item) => !scoredIds.has(item.id));

  // Điểm phải rơi vào tháng đang xem, nếu không chấm xong sẽ không thấy điểm ở đâu.
  // Xem tháng hiện tại → mặc định hôm nay; xem tháng cũ → ngày cuối tháng đó.
  const defaultEventDate = useMemo(() => {
    if (today.slice(0, 7) === month) return today;
    const [year, mon] = month.split("-").map(Number);
    return new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);
  }, [today, month]);

  function newDraft(): ScoreEventDraft {
    return {
      type: "DEDUCT",
      points: "1",
      eventDate: defaultEventDate,
      branchId: defaultBranchId || branches[0]?.id || "",
      reason: "",
    };
  }

  async function saveEvent(draft: ScoreEventDraft) {
    if (!dialog) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    const url =
      dialog.mode === "edit"
        ? `/api/employees/${dialog.employeeId}/score-events/${dialog.eventId}`
        : `/api/employees/${dialog.employeeId}/score-events`;
    const response = await fetch(url, {
      method: dialog.mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, points: Number(draft.points) }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không lưu được điểm.");
      return;
    }
    setMessage(
      `${draft.type === "DEDUCT" ? "Đã trừ" : "Đã cộng"} ${Number(draft.points)} điểm cho ${dialog.employeeName}${draft.reason ? ` — ${draft.reason}` : ""}.`,
    );
    setDialog(null);
    router.refresh();
  }

  async function deleteEvent(employeeId: string, eventId: string) {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/employees/${employeeId}/score-events/${eventId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không xóa được điểm.");
      return;
    }
    setMessage("Đã xóa điểm.");
    router.refresh();
  }

  async function decide(sessionId: string, scoreDecision: "DEDUCTED" | "WAIVED") {
    setSavingSession(sessionId);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/sessions/${sessionId}/requirement-check`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreDecision }),
    });
    const result = await response.json().catch(() => ({}));
    setSavingSession(null);
    if (!response.ok) {
      setError(result.error ?? "Không lưu được quyết định.");
      return;
    }
    setMessage(scoreDecision === "DEDUCTED" ? "Đã trừ 1 điểm cho buổi đó." : "Đã bỏ qua, không trừ điểm.");
    router.refresh();
  }

  async function saveBonus(employeeId: string, value: string) {
    const percent = Number(value);
    if (!Number.isFinite(percent)) {
      setError("Mức thưởng phải là số (vd 20 nghĩa là 20%).");
      return;
    }
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/employees/${employeeId}/monthly-bonus`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, branchId: defaultBranchId || branches[0]?.id, bonusPercent: percent / 100 }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không lưu được mức thưởng.");
      return;
    }
    setBonusDraft(null);
    setMessage(`Đã lưu mức thưởng ${percent}% cho tháng ${month}.`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Chọn tháng — bảng điểm và hộp chờ xử lý đều theo tháng này */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#64748b]">
          Đang xem tháng <strong className="text-[#0f1729]">{month.split("-").reverse().join("/")}</strong>
        </p>
        <input
          type="month"
          className="input h-9 w-auto text-sm"
          value={month}
          onChange={(event) => {
            if (event.target.value) router.push(`/teacher-tasks?month=${event.target.value}`);
          }}
        />
      </div>

      {/* Tổng quan tháng */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#e2e8f0] md:grid-cols-4">
        {[
          { label: "Ca làm tính điểm", value: String(totals.countedShifts), sub: `${totals.shifts} ca, trừ ca dạy thay` },
          { label: "Điểm trừ", value: totals.deducted.toFixed(1), sub: `${totals.peopleDeducted} người bị trừ` },
          { label: "Điểm cộng", value: totals.added.toFixed(1), sub: "thưởng cho việc làm tốt" },
          { label: "Chờ xử lý", value: String(pendingChecks.length), sub: "buổi chưa nộp bài tập chờ quyết định" },
        ].map((item) => (
          <div key={item.label} className="bg-white px-3.5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">{item.label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#0f1729]">{item.value}</p>
            <p className="mt-0.5 text-[11px] text-[#64748b]">{item.sub}</p>
          </div>
        ))}
      </div>

      {message ? <p className="text-sm font-semibold text-[#0f1729]">{message}</p> : null}
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      {/* Hộp chờ xử lý — việc chấm điểm hằng ngày nằm ở đây */}
      <section className="rounded-xl border border-[#e2e8f0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f5f9] px-4 py-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-[#0f1729]">Chờ quyết định trừ điểm</h2>
            <p className="mt-0.5 text-xs text-[#64748b]">Buổi giáo viên/trợ giảng khai chưa nộp bài tập — trừ 1 điểm hoặc bỏ qua.</p>
          </div>
          <span className="rounded-md bg-[#0f1729] px-2 py-1 text-xs font-bold tabular-nums text-white">{pendingChecks.length}</span>
        </div>
        {pendingChecks.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#64748b]">Không còn buổi nào chờ quyết định.</p>
        ) : (
          <ul className="divide-y divide-[#f1f5f9]">
            {pendingChecks.map((check) => (
              <li key={check.sessionId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0f1729]">
                    {check.employeeName}
                    <span className="ml-2 text-xs font-semibold text-[#64748b]">
                      {vnDate(check.sessionDate)} · {check.className}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#475569]">
                    Yêu cầu: {check.requirementText || "—"}
                    {check.reason ? ` · Lý do chưa nộp: ${check.reason}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Link href={`/classes/${check.classId}/sessions/${check.sessionId}`} className="status-action">
                    Mở buổi
                  </Link>
                  {canDecide ? (
                    <>
                      <ConfirmActionButton
                        title="Trừ 1 điểm tích cực?"
                        description={`${check.employeeName} — buổi ${vnDate(check.sessionDate)} lớp ${check.className}. Điểm trừ này vào bảng điểm tháng ${month} và ảnh hưởng mức thưởng.`}
                        confirmLabel="Trừ 1 điểm"
                        tone="danger"
                        disabled={savingSession === check.sessionId}
                        className="status-action"
                        onConfirm={() => decide(check.sessionId, "DEDUCTED")}
                      >
                        Trừ 1 điểm
                      </ConfirmActionButton>
                      <button
                        type="button"
                        onClick={() => void decide(check.sessionId, "WAIVED")}
                        disabled={savingSession === check.sessionId}
                        className="status-action"
                      >
                        Bỏ qua
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bảng điểm tháng */}
      <section className="rounded-xl border border-[#e2e8f0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f5f9] px-4 py-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-[#0f1729]">Bảng điểm tháng {month.split("-").reverse().join("/")}</h2>
            <p className="mt-0.5 text-xs text-[#64748b]">
              Chỉ số A = (điểm trừ − điểm cộng) / số ca tính điểm. Càng thấp càng tốt; mức thưởng nhập tay theo từng cơ sở.
            </p>
          </div>
          <input
            className="input h-9 w-auto min-w-[200px] text-sm"
            placeholder="Tìm giáo viên, trợ giảng..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Nhân sự", "Ca tính điểm", "Điểm trừ", "Điểm cộng", "Chỉ số A", "% thưởng", ""].map((label, index) => (
                  <th
                    key={label + index}
                    className={`border-b border-[#cbd5e1] bg-[#f1f5f9] px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-[#334155] ${
                      index === 0 || index === 6 ? "text-left" : "text-right"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Fragment key={row.employeeId}>
                  <tr className={expanded === row.employeeId ? "bg-[#f8fafc]" : undefined}>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2">
                      <button type="button" onClick={() => setExpanded(expanded === row.employeeId ? null : row.employeeId)} className="text-left">
                        <span className="block font-semibold text-[#0f1729]">{row.fullName}</span>
                        <span className="block text-xs text-[#94a3b8]">
                          {row.employeeCode}
                          {row.position ? ` · ${row.position}` : ""} · {row.events.length} lần chấm
                        </span>
                      </button>
                    </td>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2 text-right tabular-nums">
                      {row.countedShifts}
                      {row.substituteShifts > 0 ? <span className="text-xs text-[#94a3b8]"> (+{row.substituteShifts} dạy thay)</span> : null}
                    </td>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2 text-right tabular-nums font-bold text-[#b91c1c]">
                      {row.deducted > 0 ? `−${row.deducted}` : "0"}
                    </td>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2 text-right tabular-nums font-bold text-[#0f1729]">
                      {row.added > 0 ? `+${row.added}` : "0"}
                    </td>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2 text-right tabular-nums">{ratioLabel(row.ratio)}</td>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2 text-right">
                      {bonusDraft?.employeeId === row.employeeId ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            className="input h-8 w-20 text-right"
                            value={bonusDraft.value}
                            onChange={(event) => setBonusDraft({ employeeId: row.employeeId, value: event.target.value })}
                            aria-label="Mức thưởng %"
                          />
                          <button type="button" onClick={() => void saveBonus(row.employeeId, bonusDraft.value)} disabled={loading} className="btn-primary-sm">
                            Lưu
                          </button>
                          <button type="button" onClick={() => setBonusDraft(null)} className="btn-ghost-sm">
                            Hủy
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => canDecide && setBonusDraft({ employeeId: row.employeeId, value: row.bonusPercent != null ? String(Math.round(row.bonusPercent * 100)) : "" })}
                          className="tabular-nums font-semibold text-[#0f1729] underline-offset-2 hover:underline"
                        >
                          {row.bonusPercent != null ? `${Math.round(row.bonusPercent * 100)}%` : canDecide ? "đặt %" : "—"}
                        </button>
                      )}
                    </td>
                    <td className="border-b border-[#f1f5f9] px-2.5 py-2 text-right">
                      {canDecide ? (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setDialog({ mode: "create", employeeId: row.employeeId, employeeName: row.fullName, draft: newDraft() });
                          }}
                          className="status-action"
                        >
                          Chấm điểm
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {expanded === row.employeeId ? (
                    <tr>
                      <td colSpan={7} className="border-b border-[#f1f5f9] bg-[#f8fafc] px-4 py-3">
                        {row.events.length === 0 ? (
                          <p className="text-sm text-[#64748b]">Tháng này chưa có điểm trừ/cộng nào.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {row.events.map((event) => (
                              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                                <span className="min-w-0">
                                  <span className="tabular-nums text-[#64748b]">{vnDate(event.eventDate)}</span>{" "}
                                  <span className={`font-bold ${event.type === "DEDUCT" ? "text-[#b91c1c]" : "text-[#0f1729]"}`}>
                                    {event.type === "DEDUCT" ? "−" : "+"}
                                    {event.points}
                                  </span>{" "}
                                  <span className="text-[#0f1729]">{event.reason ?? "—"}</span>
                                  <span className="ml-1 text-xs text-[#94a3b8]">
                                    {event.branchName}
                                    {event.fromRequirement ? " · từ bài tập buổi học" : ""}
                                  </span>
                                </span>
                                {canDecide && !event.fromRequirement ? (
                                  <span className="flex shrink-0 items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDialog({
                                          mode: "edit",
                                          employeeId: row.employeeId,
                                          employeeName: row.fullName,
                                          eventId: event.id,
                                          draft: {
                                            type: event.type === "ADD" ? "ADD" : "DEDUCT",
                                            points: String(event.points),
                                            eventDate: event.eventDate.slice(0, 10),
                                            branchId: event.branchId,
                                            reason: event.reason ?? "",
                                          },
                                        })
                                      }
                                      className="status-action"
                                    >
                                      Sửa
                                    </button>
                                    <ConfirmActionButton
                                      title="Xóa điểm này?"
                                      description={`${event.type === "DEDUCT" ? "Trừ" : "Cộng"} ${event.points} điểm ngày ${vnDate(event.eventDate)}${event.reason ? ` — ${event.reason}` : ""}. Bảng điểm tháng sẽ tính lại.`}
                                      confirmLabel="Xóa điểm"
                                      tone="danger"
                                      disabled={loading}
                                      className="status-action"
                                      onConfirm={() => deleteEvent(row.employeeId, event.id)}
                                    >
                                      Xóa
                                    </ConfirmActionButton>
                                  </span>
                                ) : event.fromRequirement ? (
                                  <span className="shrink-0 text-xs text-[#94a3b8]">Sửa ở mục chờ quyết định</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-[#64748b]">
                    Tháng này chưa có ai có ca dạy hoặc điểm chấm.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {canDecide && otherEmployees.length > 0 ? (
          <div className="border-t border-[#f1f5f9] px-4 py-3">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Chấm điểm cho nhân sự khác</span>
              <select
                className="input h-9 w-auto min-w-[220px]"
                value=""
                onChange={(event) => {
                  const employee = otherEmployees.find((item) => item.id === event.target.value);
                  if (!employee) return;
                  setError(null);
                  setDialog({ mode: "create", employeeId: employee.id, employeeName: employee.fullName, draft: newDraft() });
                }}
              >
                <option value="">— Chọn nhân sự —</option>
                {otherEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName} ({employee.employeeCode})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </section>

      <ScoreEventDialog
        open={dialog !== null}
        title={dialog ? `${dialog.mode === "edit" ? "Sửa điểm" : "Chấm điểm"} — ${dialog.employeeName}` : ""}
        subtitle={`Tháng ${month.split("-").reverse().join("/")}`}
        branches={branches}
        initial={dialog?.draft ?? newDraft()}
        loading={loading}
        error={error}
        confirmLabel={dialog?.mode === "edit" ? "Lưu thay đổi" : "Lưu điểm"}
        onClose={() => {
          if (!loading) {
            setDialog(null);
            setError(null);
          }
        }}
        onConfirm={(draft) => void saveEvent(draft)}
      />
    </div>
  );
}
