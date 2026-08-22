"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Credit = {
  id: string;
  status: string;
  origin?: string;
  notes?: string | null;
  paidAmount?: number;
  // null khi credit không gắn 1 buổi cụ thể (vd cấp lúc rút lớp mà không còn buổi
  // tương lai để gán) — lúc đó dùng `className` (từ enrollment) để biết thuộc khóa nào.
  sourceSession: { sessionDate: string | Date; class: { className: string } } | null;
  consumedSession: { sessionDate: string | Date; class: { className: string } } | null;
  className: string;
};

type SessionOption = {
  id: string;
  sessionDate: string | Date;
  startTime: string | null;
  endTime: string | null;
  class: { className: string; isRemedial?: boolean };
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

function originLabel(origin?: string, notes?: string | null) {
  if (origin === "PAID_CATCHUP") return "Bổ trợ đầu khóa có phí";
  if (origin === "TRANSFER_REMAINING") return "Chuyển lớp";
  if (origin === "WITHDRAWAL_REMAINING") return "Rút lớp";
  if (origin === "MANUAL") return notes?.startsWith("Học bù trước") ? "Học bù trước" : "Chỉnh tay";
  return "Bổ trợ vắng";
}

function RedeemForm({ credit, sessionOptions, onDone }: { credit: Credit; sessionOptions: SessionOption[]; onDone: () => void }) {
  const router = useRouter();
  const [targetSessionId, setTargetSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    if (!targetSessionId) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/session-credits/${credit.id}/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetSessionId }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Không thể đăng ký học bù.");
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={redeem} className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <label className="form-group">
        <span className="label-sm">Chọn buổi học bù</span>
        <select className="input" value={targetSessionId} onChange={(event) => setTargetSessionId(event.target.value)}>
          <option value="">— Chọn buổi —</option>
          {sessionOptions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.class.isRemedial ? "🎯 Bổ trợ · " : ""}
              {formatDate(session.sessionDate)} · {session.class.className} · {session.startTime ?? "?"}-{session.endTime ?? "?"}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn-ghost-sm">
          Hủy
        </button>
        <button type="submit" disabled={loading || !targetSessionId} className="btn-primary-sm">
          {loading ? "Đang lưu..." : "Xác nhận"}
        </button>
      </div>
    </form>
  );
}

export default function StudentSessionCredits({
  credits,
  sessionOptions,
  canManage,
}: {
  credits: Credit[];
  sessionOptions: SessionOption[];
  canManage: boolean;
}) {
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const available = credits.filter((c) => c.status === "AVAILABLE");
  const history = credits.filter((c) => c.status !== "AVAILABLE").slice(0, 5);

  if (credits.length === 0) return null;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Buổi bổ trợ</p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">Buổi bổ trợ do vắng (đã đóng tiền, chưa học)</h2>
          <p className="mt-1 text-sm text-ink-muted48">Mỗi buổi vắng ở khóa đã thu trọn gói sinh 1 buổi bổ trợ để CSO xếp học bù/bổ trợ khi phụ huynh có nhu cầu.</p>
        </div>
        <span className={`badge ${available.length > 0 ? "bg-amber-100 text-amber-700" : "bg-ink/5 text-ink-muted48"}`}>{available.length} khả dụng</span>
      </div>

      <div className="mt-4 space-y-2">
        {available.map((credit) => (
          <div key={credit.id} className="rounded-2xl border border-hairline bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium text-ink">
                  {credit.sourceSession
                    ? `Vắng buổi ${formatDate(credit.sourceSession.sessionDate)} · ${credit.sourceSession.class.className}`
                    : `Buổi bổ trợ từ khóa ${credit.className}`}
                </p>
                <p className="text-xs text-ink-muted48">
                  {originLabel(credit.origin, credit.notes)}
                  {credit.paidAmount && credit.paidAmount > 0 ? ` · đã thu ${credit.paidAmount.toLocaleString("vi-VN")}đ` : ""} — chưa dùng
                </p>
              </div>
              {canManage ? (
                <button type="button" onClick={() => setRedeemingId(redeemingId === credit.id ? null : credit.id)} className="btn-ghost-sm">
                  {redeemingId === credit.id ? "Đóng" : "Đăng ký học bù"}
                </button>
              ) : null}
            </div>
            {redeemingId === credit.id ? (
              <RedeemForm credit={credit} sessionOptions={sessionOptions} onDone={() => setRedeemingId(null)} />
            ) : null}
          </div>
        ))}
        {available.length === 0 ? <p className="text-sm text-ink-muted48">Không có buổi bổ trợ nào đang khả dụng.</p> : null}
      </div>

      {history.length > 0 ? (
        <div className="mt-4 border-t border-hairline pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Lịch sử buổi bổ trợ</p>
          <div className="mt-2 space-y-1.5 text-xs text-ink-muted80">
            {history.map((credit) => (
              <p key={credit.id}>
                {credit.sourceSession
                  ? `Vắng ${formatDate(credit.sourceSession.sessionDate)} (${credit.sourceSession.class.className})`
                  : `Buổi bổ trợ từ khóa ${credit.className}`}{" "}
                —{" "}
                {credit.status === "CONSUMED" && credit.consumedSession
                  ? `đã dùng ở buổi ${formatDate(credit.consumedSession.sessionDate)} (${credit.consumedSession.class.className})`
                  : credit.status === "VOIDED"
                    ? "đã hủy (điểm danh sửa lại có mặt)"
                    : "trạng thái khác"}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
