"use client";

import { useEffect, useState } from "react";

export type ScoreEventDraft = {
  type: "DEDUCT" | "ADD";
  points: string;
  eventDate: string;
  branchId: string;
  reason: string;
};

// Lý do hay dùng — bấm 1 phát thay vì gõ lại mỗi lần. Trước đây chấm điểm phải mở màn
// lương, vào từng nhân sự, gõ tay đủ 5 ô.
const DEDUCT_REASONS = [
  "Không nộp bài tập buổi học",
  "Đi muộn",
  "Không điểm danh / nhật ký lớp",
  "Không báo phụ huynh theo yêu cầu",
  "Nghỉ không báo trước",
];
const ADD_REASONS = ["Phụ huynh khen", "Nhận dạy thay", "Hỗ trợ sự kiện trung tâm", "Chủ động bổ trợ học viên yếu"];
const POINT_CHIPS = ["0.5", "1", "2", "3"];

export default function ScoreEventDialog({
  open,
  title,
  subtitle,
  branches,
  initial,
  loading,
  error,
  confirmLabel = "Lưu điểm",
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  branches: { id: string; name: string }[];
  initial: ScoreEventDraft;
  loading?: boolean;
  error?: string | null;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (draft: ScoreEventDraft) => void;
}) {
  const [draft, setDraft] = useState<ScoreEventDraft>(initial);

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial.type, initial.points, initial.eventDate, initial.branchId, initial.reason]);

  if (!open) return null;
  const reasons = draft.type === "DEDUCT" ? DEDUCT_REASONS : ADD_REASONS;
  const points = Number(draft.points) || 0;

  function set<K extends keyof ScoreEventDraft>(key: K, value: ScoreEventDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" onClick={() => !loading && onClose()} />
      <div className="relative z-[96] w-full max-w-lg rounded-t-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.16)] sm:rounded-2xl">
        <h3 className="text-lg font-black tracking-tight text-[#0f1729]">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-[#64748b]">{subtitle}</p> : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(
            [
              { value: "DEDUCT" as const, label: "Trừ điểm", hint: "Lỗi trong ca làm" },
              { value: "ADD" as const, label: "Cộng điểm", hint: "Làm tốt, hỗ trợ thêm" },
            ]
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => set("type", option.value)}
              className={`rounded-xl border p-3 text-left transition ${
                draft.type === option.value ? "border-[#0f1729] ring-1 ring-[#0f1729]" : "border-[#e2e8f0] hover:border-[#0f1729]"
              }`}
            >
              <p className="text-sm font-bold text-[#0f1729]">{option.label}</p>
              <p className="mt-0.5 text-xs text-[#64748b]">{option.hint}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <span className="label-sm">Số điểm</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {POINT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => set("points", chip)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${
                    draft.points === chip ? "border-[#0f1729] bg-[#0f1729] text-white" : "border-[#e2e8f0] bg-white text-[#0f1729] hover:border-[#0f1729]"
                  }`}
                >
                  {chip}
                </button>
              ))}
              <input
                type="number"
                min="0.5"
                step="0.5"
                className="input h-9 w-24"
                value={draft.points}
                onChange={(event) => set("points", event.target.value)}
                aria-label="Số điểm"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label-sm">Ngày</span>
              <input type="date" className="input" value={draft.eventDate} onChange={(event) => set("eventDate", event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label-sm">Cơ sở tính điểm</span>
              <select className="input" value={draft.branchId} onChange={(event) => set("branchId", event.target.value)}>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="label-sm">Lý do</span>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => set("reason", reason)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    draft.reason === reason ? "border-[#0f1729] bg-[#0f1729] text-white" : "border-[#e2e8f0] bg-white text-[#0f1729] hover:border-[#0f1729]"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <input
              className="input"
              value={draft.reason}
              onChange={(event) => set("reason", event.target.value)}
              placeholder="Hoặc ghi lý do cụ thể..."
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onConfirm(draft)}
            disabled={loading || points <= 0 || !draft.branchId}
            className="btn-primary flex-1"
          >
            {loading ? "Đang lưu..." : `${confirmLabel}: ${draft.type === "DEDUCT" ? "−" : "+"}${points} điểm`}
          </button>
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
