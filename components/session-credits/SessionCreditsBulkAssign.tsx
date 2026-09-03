"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Candidate = { id: string; fullName: string; studentCode: string; availableCredits: number };
type RemedialClassOption = {
  id: string;
  classCode: string;
  className: string;
  futureSessions: { id: string; sessionDate: string; startTime: string | null; endTime: string | null }[];
};
type Result = { studentId: string; ok: boolean; message: string };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

// Gán hàng loạt nhiều học viên đang có buổi bổ trợ khả dụng (từ bảng "Bảng xử lý bổ
// trợ") vào cùng 1 buổi tương lai của 1 lớp bổ trợ — trước đây phải mở từng hồ sơ học
// viên một để "Đăng ký học bù" riêng lẻ, rất mất công khi cả nhóm cùng dồn vào 1 lớp.
export default function SessionCreditsBulkAssign({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [classOptions, setClassOptions] = useState<RemedialClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => {
    if (!open || classOptions.length > 0) return;
    setLoadingClasses(true);
    fetch("/api/classes/remedial-options")
      .then((res) => res.json())
      .then((data) => setClassOptions(Array.isArray(data.items) ? data.items : []))
      .catch(() => setError("Không tải được danh sách lớp bổ trợ."))
      .finally(() => setLoadingClasses(false));
  }, [open, classOptions.length]);

  const selectedClass = classOptions.find((item) => item.id === classId) ?? null;

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!classId || !sessionId || selectedIds.size === 0) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const response = await fetch(`/api/classes/${classId}/remedial-bulk-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: [...selectedIds], targetSessionId: sessionId }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không thể xếp lớp bổ trợ.");
      return;
    }

    setResults(data.results ?? []);
    const okIds = new Set((data.results ?? []).filter((r: Result) => r.ok).map((r: Result) => r.studentId));
    setSelectedIds((current) => new Set([...current].filter((id) => !okIds.has(id))));
    router.refresh();
  }

  if (candidates.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#dbe3ef] bg-[#fbfdff]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-[#0f1729]">
          Xếp hàng loạt vào lớp bổ trợ ({candidates.length} học viên có buổi khả dụng)
        </span>
        <span className="text-xs font-semibold text-[#1d4ed8]">{open ? "Thu gọn" : "Mở"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[#e5eaf7] px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">1. Chọn lớp bổ trợ</p>
            <select
              className="input mt-2"
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setSessionId("");
              }}
              disabled={loadingClasses}
            >
              <option value="">{loadingClasses ? "Đang tải..." : "— Chọn lớp bổ trợ —"}</option>
              {classOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.classCode} - {item.className}
                </option>
              ))}
            </select>
          </div>

          {classId ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">2. Chọn buổi tương lai</p>
              {!selectedClass || selectedClass.futureSessions.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">Lớp này chưa có buổi tương lai nào.</p>
              ) : (
                <select className="input mt-2" value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
                  <option value="">— Chọn buổi —</option>
                  {selectedClass.futureSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {formatDate(session.sessionDate)} · {session.startTime ?? "?"}-{session.endTime ?? "?"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">3. Chọn học viên</p>
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

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          {results ? (
            <div className="space-y-1 rounded-xl border border-[#e5eaf7] bg-white p-3">
              <p className={`text-xs font-bold ${results.every((r) => r.ok) ? "text-emerald-700" : "text-amber-700"}`}>
                {results.filter((r) => r.ok).length}/{results.length} xếp thành công
                {results.some((r) => !r.ok) ? " — xem chi tiết bên dưới" : ""}
              </p>
              {results.map((result) => (
                <p key={result.studentId} className={`text-xs ${result.ok ? "text-emerald-700" : "text-red-600"}`}>
                  {result.ok ? "✓" : "✗"} {result.message}
                </p>
              ))}
              {results.some((r) => r.ok) && classId ? (
                <Link href={`/classes/${classId}`} className="mt-1 inline-block text-xs font-bold text-[#1d4ed8] hover:underline">
                  Xem danh sách lớp bổ trợ →
                </Link>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={!classId || !sessionId || selectedIds.size === 0 || loading}
            className="btn-primary"
          >
            {loading ? "Đang xếp..." : `Xếp ${selectedIds.size || ""} học viên vào buổi đã chọn`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
