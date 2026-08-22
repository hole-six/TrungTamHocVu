"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type EmployeeOption = { id: string; fullName: string };
type ExistingCheck = { status: string; employee: { fullName: string }; checkedAt: string | Date } | null;

export default function SessionRequirementForm({
  sessionId,
  requirementText,
  employeeOptions,
  existing,
}: {
  sessionId: string;
  requirementText: string;
  employeeOptions: EmployeeOption[];
  existing: ExistingCheck;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState(employeeOptions[0]?.id ?? "");
  const [pendingStatus, setPendingStatus] = useState<"SUBMITTED" | "NOT_SUBMITTED" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!pendingStatus || !employeeId) return;
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/sessions/${sessionId}/requirement-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, status: pendingStatus }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Không thể lưu xác nhận.");
      setPendingStatus(null);
      return;
    }
    setPendingStatus(null);
    router.refresh();
  }

  if (existing) {
    return (
      <div className="card space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">Việc giáo viên cần làm</h2>
        <div className="rounded-2xl border border-[#e5eaf7] bg-[#fbfdff] p-4">
          <p className="text-sm text-ink-muted80">{requirementText}</p>
        </div>
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            existing.status === "SUBMITTED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {existing.status === "SUBMITTED" ? "Đã nộp" : "Chưa nộp"} — xác nhận bởi {existing.employee.fullName} lúc{" "}
          {new Date(existing.checkedAt).toLocaleString("vi-VN")}
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">Việc giáo viên cần làm</h2>
        <p className="mt-1 text-sm text-ink-muted48">Buổi này đã điểm danh xong — xác nhận yêu cầu dưới đây đã hoàn thành hay chưa.</p>
      </div>

      <div className="rounded-2xl border border-[#e5eaf7] bg-[#fbfdff] p-4">
        <p className="text-sm text-ink-muted80">{requirementText}</p>
      </div>

      <label className="form-group">
        <span className="label">Người phụ trách xác nhận</span>
        <select className="input" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          {employeeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.fullName}
            </option>
          ))}
        </select>
        <p className="form-hint">Chọn đúng người chịu trách nhiệm cho buổi này — nếu chọn "Chưa nộp", điểm tích cực sẽ bị trừ đúng người này.</p>
      </label>

      {error ? <div className="alert-danger text-sm">{error}</div> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!employeeId}
          onClick={() => setPendingStatus("SUBMITTED")}
          className="rounded-full border-2 border-emerald-400 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Đã nộp
        </button>
        <button
          type="button"
          disabled={!employeeId}
          onClick={() => setPendingStatus("NOT_SUBMITTED")}
          className="rounded-full border-2 border-rose-400 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Chưa nộp
        </button>
      </div>

      <ConfirmDialog
        open={pendingStatus !== null}
        title={pendingStatus === "SUBMITTED" ? "Xác nhận đã nộp?" : "Xác nhận chưa nộp?"}
        description={
          pendingStatus === "SUBMITTED"
            ? "Xác nhận yêu cầu buổi này đã hoàn thành, không trừ điểm tích cực."
            : `Xác nhận yêu cầu buổi này CHƯA hoàn thành — sẽ trừ 1 điểm tích cực của người được chọn. Chỉ xác nhận khi chắc chắn đúng.`
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
