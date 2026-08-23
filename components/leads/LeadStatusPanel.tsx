"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_STATUS_LABEL, nextStatuses } from "@/lib/server/lead-rules";
import FormGuide from "@/components/ui/FormGuide";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { useStudentDrawer } from "@/contexts/StudentDrawerContext";

const STATUS_COLORS: Record<string, string> = {
  NEW:        "bg-slate-100 text-slate-700",
  CONTACTING: "bg-blue-100 text-blue-700",
  APPOINTED:  "bg-violet-100 text-violet-700",
  TESTED:     "bg-amber-100 text-amber-700",
  QUALIFIED:  "bg-emerald-100 text-emerald-700",
  UNQUALIFIED:"bg-red-100 text-red-700",
  ENROLLED:   "bg-primary/10 text-primary",
  LOST:       "bg-gray-100 text-gray-500",
};

const STATUS_DOT: Record<string, string> = {
  NEW: "bg-slate-400", CONTACTING: "bg-blue-500", APPOINTED: "bg-violet-500",
  TESTED: "bg-amber-500", QUALIFIED: "bg-emerald-500", UNQUALIFIED: "bg-red-500",
  ENROLLED: "bg-primary", LOST: "bg-gray-400",
};

const LEAD_STATUS_GUIDE_SECTIONS = [
  {
    title: "Ý nghĩa khối trạng thái",
    items: [
      "Đây là nơi quyết định lead đang nằm ở bước nào trong hành trình tuyển sinh.",
      "Badge hiện tại cho biết tình trạng mới nhất, còn các nút phía dưới là bước chuyển tiếp hợp lệ tiếp theo.",
      "Khi lead đủ điều kiện và chưa có học viên, nút chuyển thành học viên sẽ xuất hiện tại đây.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách đổi đúng",
    items: [
      "Chỉ đổi trạng thái sau khi hành động thực tế đã xảy ra, ví dụ đã hẹn, đã test hoặc đã chốt được.",
      "Nếu còn thiếu dữ liệu chăm sóc, nên ghi tương tác hoặc lịch hẹn trước rồi mới đổi trạng thái.",
      "Khi đã chuyển thành học viên, việc theo dõi tiếp nên chuyển sang hồ sơ học viên là chính.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý quan trọng",
    items: [
      "Đổi trạng thái sai sẽ làm dashboard CRM và luồng xử lý của đội tuyển sinh bị nhiễu.",
      "Lead đã có học viên thật thì không nên tiếp tục vận hành như lead mới.",
      "Nếu không chắc nên chuyển bước nào, hãy nhìn lại lịch hẹn gần nhất, test gần nhất và ghi chú CRM.",
    ],
    tone: "warning" as const,
  },
];

export default function LeadStatusPanel({
  leadId,
  status,
  hasStudent,
}: {
  leadId: string;
  status: string;
  hasStudent: boolean;
}) {
  const router = useRouter();
  const { openDrawer } = useStudentDrawer();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: string) {
    setLoading(next);
    setError(null);
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể đổi trạng thái.");
      return;
    }
    router.refresh();
  }

  async function convert() {
    setLoading("CONVERT");
    setError(null);
    const res = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Không thể chuyển đổi thành học viên.");
      return;
    }
    openDrawer(data.item.id);
    router.refresh();
  }

  const isConverted = hasStudent || status === "ENROLLED";
  const options = isConverted ? [] : nextStatuses(status);
  const colorClass = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
  const dotClass = STATUS_DOT[status] ?? "bg-slate-400";

  return (
    <div className="card space-y-5">
      <FormGuide
        title="Guide trạng thái lead"
        summary="Giải thích khi nào nên đổi trạng thái và khi nào nên chuyển lead thành học viên."
        sections={LEAD_STATUS_GUIDE_SECTIONS}
        position="inline"
        buttonLabel="Guide trạng thái"
      />
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <h2 className="font-display text-base font-bold tracking-tight text-ink">Trạng thái Lead</h2>
      </div>

      {/* Current status badge */}
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ${colorClass}`}>
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          {LEAD_STATUS_LABEL[status as keyof typeof LEAD_STATUS_LABEL] ?? status}
        </span>
        {hasStudent && (
          <span className="badge-green">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Đã tạo học viên
          </span>
        )}
      </div>

      {/* Convert CTA */}
      {status === "QUALIFIED" && !isConverted && (
        <ConfirmActionButton
          title="Xác nhận chuyển lead thành học viên?"
          description="Hệ thống sẽ tạo hồ sơ học viên thật từ lead này và chuyển luồng theo dõi sang khu học viên."
          confirmLabel="Chuyển thành học viên"
          disabled={loading === "CONVERT"}
          className="btn-primary w-full"
          onConfirm={convert}
        >
          {loading === "CONVERT" ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
              </svg>
              Đang chuyển đổi...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              </svg>
              Chuyển thành học viên
            </span>
          )}
        </ConfirmActionButton>
      )}

      {/* Transition buttons */}
      {options.length > 0 && (
        <div>
          <p className="label mb-2">Chuyển sang trạng thái</p>
          <div className="flex flex-wrap gap-2">
            {options.map((s) => (
              <ConfirmActionButton
                key={s}
                title="Xác nhận đổi trạng thái lead?"
                description={`Lead sẽ được chuyển sang trạng thái "${LEAD_STATUS_LABEL[s as keyof typeof LEAD_STATUS_LABEL] ?? s}". Hãy chắc rằng bước hiện tại đã được xử lý thực tế.`}
                confirmLabel={`Đổi sang ${LEAD_STATUS_LABEL[s as keyof typeof LEAD_STATUS_LABEL] ?? s}`}
                disabled={!!loading}
                className="status-action"
                onConfirm={() => setStatus(s)}
              >
                {loading === s ? (
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                )}
                {LEAD_STATUS_LABEL[s as keyof typeof LEAD_STATUS_LABEL] ?? s}
              </ConfirmActionButton>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="alert-danger text-xs">{error}</div>
      )}
    </div>
  );
}
