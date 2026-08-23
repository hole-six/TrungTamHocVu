"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Candidate = { id: string; fullName: string; studentCode: string; availableCredits: number };
type FutureSession = { id: string; sessionDate: string; startTime: string | null; endTime: string | null };
type Result = { studentId: string; ok: boolean; message: string };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

// Gán nhiều học viên đang có buổi bổ trợ khả dụng vào CÙNG 1 buổi tương lai của lớp
// bổ trợ này trong 1 lần bấm — trước đây phải mở "Gán nhập học" rồi "Đăng ký học bù"
// riêng cho từng người, rất mất công khi cả nhóm cùng dồn vào 1 buổi.
export default function RemedialBulkAssignPanel({
  classId,
  candidates,
  futureSessions,
}: {
  classId: string;
  candidates: Candidate[];
  futureSessions: FutureSession[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetSessionId, setTargetSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selectedIds.size === 0 || !targetSessionId) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const response = await fetch(`/api/classes/${classId}/remedial-bulk-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: [...selectedIds], targetSessionId }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không thể gán học viên.");
      return;
    }

    setResults(data.results ?? []);
    const okIds = new Set((data.results ?? []).filter((r: Result) => r.ok).map((r: Result) => r.studentId));
    setSelectedIds((current) => new Set([...current].filter((id) => !okIds.has(id))));
    router.refresh();
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#dbe3ef] bg-[#fbfdff] px-4 py-3 text-xs text-[#64748b]">
        Chưa có học viên nào đang có buổi bổ trợ khả dụng để gán vào lớp này.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#dbe3ef] bg-[#fbfdff]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-[#0f1729]">
          Gán hàng loạt học viên có buổi bổ trợ ({candidates.length} người khả dụng)
        </span>
        <span className="text-xs font-semibold text-[#1d4ed8]">{open ? "Thu gọn" : "Mở"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[#e5eaf7] px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">1. Chọn học viên</p>
            <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-[#e5eaf7] bg-white p-2">
              {candidates.map((candidate) => (
                <label
                  key={candidate.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-[#f8fbff]"
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(candidate.id)}
                      onChange={() => toggle(candidate.id)}
                      className="h-4 w-4 rounded border-[#c9d8ee] text-primary"
                    />
                    <span>
                      <span className="font-semibold text-[#0f1729]">{candidate.fullName}</span>
                      <span className="ml-2 text-xs text-[#64748b]">{candidate.studentCode}</span>
                    </span>
                  </span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    {candidate.availableCredits} buổi
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">2. Chọn buổi tương lai để gán vào</p>
            {futureSessions.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700">Lớp này chưa có buổi tương lai nào — tạo lịch buổi học trước khi gán.</p>
            ) : (
              <select className="input mt-2" value={targetSessionId} onChange={(event) => setTargetSessionId(event.target.value)}>
                <option value="">— Chọn buổi —</option>
                {futureSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {formatDate(session.sessionDate)} · {session.startTime ?? "?"}-{session.endTime ?? "?"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          {results ? (
            <div className="space-y-1 rounded-xl border border-[#e5eaf7] bg-white p-3">
              {results.map((result) => (
                <p key={result.studentId} className={`text-xs ${result.ok ? "text-emerald-700" : "text-red-600"}`}>
                  {result.ok ? "✓" : "✗"} {result.message}
                </p>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={selectedIds.size === 0 || !targetSessionId || loading}
            className="btn-primary"
          >
            {loading ? "Đang gán..." : `Gán ${selectedIds.size || ""} học viên vào buổi đã chọn`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
