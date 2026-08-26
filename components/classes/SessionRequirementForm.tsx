"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Linkify from "@/components/ui/Linkify";

type EmployeeOption = { id: string; fullName: string };
type ExistingCheck = {
  status: string;
  initialStatus: string;
  reason: string | null;
  scoreDecision: string;
  employee: { fullName: string };
  checkedAt: string | Date;
} | null;

const SCORE_DECISION_LABEL: Record<string, string> = {
  PENDING: "Chờ admin quyết định điểm",
  DEDUCTED: "Đã trừ điểm",
  WAIVED: "Không trừ điểm (đã châm chước)",
};

export default function SessionRequirementForm({
  sessionId,
  requirementText,
  employeeOptions,
  existing,
  editableToday,
}: {
  sessionId: string;
  requirementText: string;
  employeeOptions: EmployeeOption[];
  existing: ExistingCheck;
  editableToday: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [pendingStatus, setPendingStatus] = useState<"SUBMITTED" | "NOT_SUBMITTED" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!pendingStatus || !employeeId) return;
    if (pendingStatus === "NOT_SUBMITTED" && !reasonDraft.trim()) {
      setError("Vui lòng nhập lý do chưa nộp.");
      return;
    }
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/sessions/${sessionId}/requirement-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        status: pendingStatus,
        reason: pendingStatus === "NOT_SUBMITTED" ? reasonDraft.trim() : "",
      }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Không thể lưu xác nhận.");
      setPendingStatus(null);
      return;
    }
    setPendingStatus(null);
    setEditing(false);
    router.refresh();
  }

  if (existing && !editing) {
    const late = existing.initialStatus === "NOT_SUBMITTED" && existing.status === "SUBMITTED";
    return (
      <div className="card space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">Việc giáo viên cần làm</h2>
        <div className="rounded-2xl border border-[#e5eaf7] bg-[#fbfdff] p-4">
          <p className="text-sm text-ink-muted80"><Linkify text={requirementText} /></p>
        </div>
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            existing.status === "SUBMITTED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {existing.status === "SUBMITTED" ? "Đã nộp" : "Chưa nộp"}
          {late ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Nộp muộn</span> : null}
          {" "}— xác nhận bởi {existing.employee.fullName} lúc{" "}
          {new Date(existing.checkedAt).toLocaleString("vi-VN")}
        </div>
        {existing.reason ? (
          <div className="rounded-2xl border border-[#e5eaf7] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted48">Lý do chưa nộp</p>
            <p className="mt-1 text-sm text-ink-muted80">{existing.reason}</p>
          </div>
        ) : null}
        <p className="text-xs text-ink-muted48">{SCORE_DECISION_LABEL[existing.scoreDecision] ?? existing.scoreDecision}</p>
        {editableToday ? (
          <button
            type="button"
            onClick={() => {
              setEmployeeId("");
              setReasonDraft(existing.reason ?? "");
              setEditing(true);
            }}
            className="btn-ghost-sm"
          >
            Sửa lại (còn trong hôm nay)
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">Việc giáo viên cần làm</h2>
        <p className="mt-1 text-sm text-ink-muted48">Buổi đã bắt đầu — xác nhận yêu cầu dưới đây đã hoàn thành hay chưa.</p>
      </div>

      <div className="rounded-2xl border border-[#e5eaf7] bg-[#fbfdff] p-4">
        <p className="text-sm text-ink-muted80">{requirementText}</p>
      </div>

      <label className="form-group">
        <span className="label">Người phụ trách xác nhận</span>
        <select className="input" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          <option value="">— Chọn bạn là ai —</option>
          {employeeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.fullName}
            </option>
          ))}
        </select>
        <p className="form-hint">Bắt buộc chọn đúng người chịu trách nhiệm cho buổi này trước khi xác nhận.</p>
      </label>

      {error ? <div className="alert-danger text-sm">{error}</div> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!employeeId}
          onClick={() => {
            setError(null);
            setPendingStatus("SUBMITTED");
          }}
          className="rounded-full border-2 border-emerald-400 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Đã nộp
        </button>
        <button
          type="button"
          disabled={!employeeId}
          onClick={() => {
            setError(null);
            setPendingStatus("NOT_SUBMITTED");
          }}
          className="rounded-full border-2 border-rose-400 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Chưa nộp
        </button>
        {existing ? (
          <button type="button" onClick={() => setEditing(false)} className="btn-ghost-sm">
            Hủy sửa
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingStatus !== null}
        title={pendingStatus === "SUBMITTED" ? "Xác nhận đã nộp?" : "Xác nhận chưa nộp?"}
        description={
          pendingStatus === "SUBMITTED" ? (
            "Xác nhận yêu cầu buổi này đã hoàn thành."
          ) : (
            <div className="space-y-3">
              <p>Xác nhận yêu cầu buổi này CHƯA hoàn thành. Việc có trừ điểm hay không do admin quyết định sau, không phải lúc xác nhận này.</p>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">Lý do chưa nộp</span>
                <textarea
                  className="input min-h-[80px] w-full"
                  value={reasonDraft}
                  onChange={(event) => setReasonDraft(event.target.value)}
                  placeholder="VD: Chưa kịp soạn tài liệu, sẽ bổ sung trong tuần này..."
                />
              </label>
            </div>
          )
        }
        confirmLabel="Xác nhận"
        cancelLabel="Hủy"
        onConfirm={confirm}
        onClose={() => {
          if (!loading) setPendingStatus(null);
        }}
        loading={loading}
      />
    </div>
  );
}
