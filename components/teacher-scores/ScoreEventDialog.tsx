"use client";

import { useEffect, useState } from "react";
import { computeLateness } from "@/lib/score-event-detail";

export type ScoreEventDraft = {
  type: "DEDUCT" | "ADD";
  points: string;
  eventDate: string;
  branchId: string;
  reason: string;
  /** Quy chế: 1 nội dung bị nhắc ở CẢ 3 báo cáo (ngày, tuần, tháng) → tháng đó mặc định −10% lương. */
  tripleReported: boolean;
  // CHI TIẾT ĐỐI SOÁT — không bắt buộc, nhưng có thì trả lời được ngay khi nhân sự thắc mắc.
  /** Ngày giờ lỗi thật sự xảy ra (<input type="datetime-local">). */
  occurredAt: string;
  /** Lớp liên quan. */
  classId: string;
  /** Hạn theo quy chế (vd nhật ký phải gửi trước 9h sáng hôm sau). */
  dueAt: string;
  /** Thực tế làm xong lúc nào → hệ thống tự tính chậm bao lâu. */
  completedAt: string;
  /** Đã khắc phục lúc nào + khắc phục thế nào. */
  resolvedAt: string;
  resolvedNote: string;
};

// Lý do hay dùng — bấm 1 phát thay vì gõ lại mỗi lần. Trước đây chấm điểm phải mở màn
// lương, vào từng nhân sự, gõ tay đủ 5 ô.
// Đúng 9 mục TRỪ ĐIỂM và các mục CỘNG ĐIỂM của bảng "XÉT THƯỞNG TRỢ GIẢNG" trong quy chế —
// bấm chọn là điền sẵn đúng số điểm quy chế, khỏi phải nhớ.
const DEDUCT_REASONS: { label: string; points: string }[] = [
  { label: "Nghỉ đột xuất, không báo trước / không tìm được người cover", points: "1" },
  { label: "Chấm sai Minitest, BTVN (trên 2 lỗi)", points: "1" },
  { label: "Bị nhắc truy thu muộn (minitest dưới 7, video đọc từ...)", points: "1" },
  { label: "Gửi nhật ký lớp muộn (sau 9h sáng hôm sau)", points: "1" },
  { label: "Không gửi nhật ký cho giáo vụ mà tự gửi nhóm lớp", points: "1" },
  { label: "Không mặc đúng đồng phục", points: "1" },
  { label: "Vứt đồ lung tung (flashcard, mic, chân quay, giấy minitest)", points: "1" },
  { label: "Nghỉ họp không lý do, báo gấp", points: "2" },
  { label: "Trông minitest không nghiêm, để HS gian lận", points: "3" },
];
const ADD_REASONS: { label: string; points: string }[] = [
  { label: "Cover lớp học cho trợ giảng khác", points: "1" },
  { label: "Phụ huynh khen", points: "1" },
  { label: "Hỗ trợ sự kiện trung tâm", points: "1" },
  { label: "Chủ động bổ trợ học viên yếu", points: "1" },
];
const POINT_CHIPS = ["0.5", "1", "2", "3"];

export default function ScoreEventDialog({
  open,
  title,
  subtitle,
  branches,
  classes = [],
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
  /** Danh sách lớp để chỉ đúng lỗi xảy ra ở lớp nào. */
  classes?: { id: string; label: string }[];
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
  }, [open, initial.type, initial.points, initial.eventDate, initial.branchId, initial.reason, initial.tripleReported, initial.occurredAt, initial.classId, initial.dueAt, initial.completedAt, initial.resolvedAt, initial.resolvedNote]);

  if (!open) return null;
  const reasons = draft.type === "DEDUCT" ? DEDUCT_REASONS : ADD_REASONS;
  const points = Number(draft.points) || 0;
  const lateness = computeLateness({ dueAt: draft.dueAt, completedAt: draft.completedAt });

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
                  key={reason.label}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, reason: reason.label, points: reason.points }))}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    draft.reason === reason.label ? "border-[#0f1729] bg-[#0f1729] text-white" : "border-[#e2e8f0] bg-white text-[#0f1729] hover:border-[#0f1729]"
                  }`}
                >
                  {reason.label} ({reason.points === "1" ? "−1" : `−${reason.points}`}đ)
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

          {/* CHI TIẾT ĐỐI SOÁT — để khi nhân sự thắc mắc thì có đủ mốc thời gian trả lời,
              không phải nhớ mồm. Tất cả đều không bắt buộc. */}
          <div className="space-y-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748b]">Chi tiết để đối soát (không bắt buộc)</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label-sm">Xảy ra lúc (ngày giờ)</span>
                <input type="datetime-local" className="input" value={draft.occurredAt} onChange={(event) => set("occurredAt", event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="label-sm">Lớp liên quan</span>
                <select className="input" value={draft.classId} onChange={(event) => set("classId", event.target.value)}>
                  <option value="">— không gắn lớp —</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label-sm">Hạn phải làm</span>
                <input type="datetime-local" className="input" value={draft.dueAt} onChange={(event) => set("dueAt", event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="label-sm">Thực tế làm lúc</span>
                <input type="datetime-local" className="input" value={draft.completedAt} onChange={(event) => set("completedAt", event.target.value)} />
              </label>
            </div>
            {lateness.label ? (
              <p className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${lateness.minutes ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                So với hạn: {lateness.label}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label-sm">Đã khắc phục lúc</span>
                <input type="datetime-local" className="input" value={draft.resolvedAt} onChange={(event) => set("resolvedAt", event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="label-sm">Khắc phục thế nào</span>
                <input className="input" value={draft.resolvedNote} onChange={(event) => set("resolvedNote", event.target.value)} placeholder="VD: đã gửi lại nhật ký đủ" />
              </label>
            </div>
          </div>

          {/* Quy chế: cùng 1 nội dung mà bị nhắc ở cả 3 báo cáo thì tháng đó mặc định −10% lương,
              không phụ thuộc tỉ lệ A — đánh dấu ở đây để hệ thống đề xuất đúng mức. */}
          {draft.type === "DEDUCT" ? (
            <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.tripleReported}
                onChange={(event) => set("tripleReported", event.target.checked)}
              />
              <span>
                Nội dung này bị nhắc ở <strong>cả 3 báo cáo</strong> (ngày, tuần, tháng) — theo quy chế tháng đó mặc định −10% lương.
              </span>
            </label>
          ) : null}
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
