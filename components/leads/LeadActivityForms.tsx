"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "interaction" | "appointment" | "test";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "interaction",
    label: "Tương tác",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    key: "appointment",
    label: "Lịch hẹn",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    key: "test",
    label: "Kết quả test",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
];

const INTERACTION_TYPES = [
  { value: "CALL", label: "📞 Gọi điện" },
  { value: "MEET", label: "🤝 Gặp trực tiếp" },
  { value: "MESSAGE", label: "💬 Nhắn tin" },
  { value: "EMAIL", label: "✉️ Email" },
];

export default function LeadActivityForms({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("interaction");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [interactionForm, setInteractionForm] = useState({ type: "CALL", content: "" });
  const [appointmentForm, setAppointmentForm] = useState({ scheduledAt: "", notes: "" });
  const [testForm, setTestForm] = useState({ testDate: "", result: "", notes: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const endpoint =
      tab === "interaction"
        ? `/api/leads/${leadId}/interactions`
        : tab === "appointment"
          ? `/api/leads/${leadId}/appointments`
          : `/api/leads/${leadId}/placement-test`;

    const body =
      tab === "interaction" ? interactionForm
      : tab === "appointment" ? appointmentForm
      : testForm;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể lưu.");
      return;
    }

    setSuccess("Đã lưu thành công!");
    setInteractionForm({ type: "CALL", content: "" });
    setAppointmentForm({ scheduledAt: "", notes: "" });
    setTestForm({ testDate: "", result: "", notes: "" });
    setTimeout(() => setSuccess(null), 3000);
    router.refresh();
  }

  return (
    <div className="card space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
        <h2 className="font-display text-base font-bold tracking-tight text-ink">Ghi nhận hoạt động</h2>
      </div>

      {/* Tab switcher */}
      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setError(null); setSuccess(null); }}
            className={tab === t.key ? "tab-item-active" : "tab-item"}
          >
            <span className="flex items-center justify-center gap-1.5">
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(" ")[0]}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Form body */}
      <form onSubmit={submit} className="space-y-4">
        {/* ── Tab: Tương tác ── */}
        {tab === "interaction" && (
          <>
            <div className="form-group">
              <label className="label">Hình thức tương tác</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {INTERACTION_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setInteractionForm((f) => ({ ...f, type: opt.value }))}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold text-center transition-all duration-150 ${
                      interactionForm.type === opt.value
                        ? "border-primary bg-primary/8 text-primary shadow-sm"
                        : "border-[#e2e8f0] bg-white text-ink-muted80 hover:border-primary/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="label">Nội dung trao đổi</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Ghi tóm tắt nội dung cuộc trò chuyện, phản hồi của phụ huynh/học viên..."
                value={interactionForm.content}
                onChange={(e) => setInteractionForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
          </>
        )}

        {/* ── Tab: Lịch hẹn ── */}
        {tab === "appointment" && (
          <>
            <div className="form-group">
              <label className="label">Ngày & giờ hẹn <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                required
                className="input"
                value={appointmentForm.scheduledAt}
                onChange={(e) => setAppointmentForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
              <p className="form-hint">Chọn thời điểm phụ huynh/học viên sẽ đến test đầu vào hoặc tham quan.</p>
            </div>
            <div className="form-group">
              <label className="label">Ghi chú lịch hẹn</label>
              <input
                className="input"
                placeholder="VD: Phụ huynh đến đón con, cần phòng tư vấn..."
                value={appointmentForm.notes}
                onChange={(e) => setAppointmentForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </>
        )}

        {/* ── Tab: Kết quả test ── */}
        {tab === "test" && (
          <>
            <div className="form-group">
              <label className="label">Ngày test đầu vào</label>
              <input
                type="date"
                className="input"
                value={testForm.testDate}
                onChange={(e) => setTestForm((f) => ({ ...f, testDate: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="label">Kết quả / Xếp lớp đề xuất</label>
              <input
                className="input"
                placeholder="VD: Xếp lớp FF3, điểm 7.5/10, phù hợp nhóm tuổi 8-10..."
                value={testForm.result}
                onChange={(e) => setTestForm((f) => ({ ...f, result: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="label">Ghi chú thêm</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Nhận xét của giáo viên, yêu cầu đặc biệt..."
                value={testForm.notes}
                onChange={(e) => setTestForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </>
        )}

        {/* Feedback */}
        {error && (
          <div className="alert-danger flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="alert-success flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
              </svg>
              Đang lưu...
            </span>
          ) : "Lưu hoạt động"}
        </button>
      </form>
    </div>
  );
}
