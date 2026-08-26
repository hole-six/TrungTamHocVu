"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Candidate = { id: string; fullName: string; studentCode: string; availableCredits: number };
type FutureSession = { id: string; sessionDate: string; startTime: string | null; endTime: string | null };
type Result = { studentId: string; ok: boolean; message: string };

type StudentHit = { id: string; fullName: string; studentCode: string };
type OwnFutureSession = { id: string; sessionDate: string; startTime: string; endTime: string; class: { className: string } };
type NoCreditEntry = {
  student: StudentHit;
  loadingFuture: boolean;
  ownFutureSessions: OwnFutureSession[];
  futureSessionId: string;
};

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
  onSuccess,
}: {
  classId: string;
  candidates: Candidate[];
  futureSessions: FutureSession[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetSessionId, setTargetSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  // Học viên CHƯA có buổi bổ trợ nhưng muốn "học bù trước" — vd bận buổi thứ 7 của lớp
  // đang học, đi bù ngay ở buổi bổ trợ đích (targetSessionId) rồi coi như buổi thứ 7
  // tương lai đã học rồi (không tự sinh thêm buổi bổ trợ nào, khác hẳn nhóm candidates
  // ở trên vốn đã CÓ SẴN buổi bổ trợ). Tái dùng đúng API prebook-makeup đã có sẵn cho
  // luồng cá nhân (RemedialSessionRoster tab "Học sinh toàn khóa") — chỉ khác là buổi
  // bổ trợ đích ở đây LÀ targetSessionId đang chọn chung bên dưới, không phải buổi đang
  // mở hiện tại.
  const [noCreditQuery, setNoCreditQuery] = useState("");
  const [noCreditSearching, setNoCreditSearching] = useState(false);
  const [noCreditResults, setNoCreditResults] = useState<StudentHit[]>([]);
  const [noCreditEntries, setNoCreditEntries] = useState<NoCreditEntry[]>([]);

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function searchNoCreditStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!noCreditQuery.trim()) return;
    setNoCreditSearching(true);
    const response = await fetch(`/api/students?q=${encodeURIComponent(noCreditQuery)}&status=ACTIVE&pageSize=10`);
    const data = await response.json().catch(() => ({}));
    setNoCreditSearching(false);
    const alreadyAdded = new Set(noCreditEntries.map((entry) => entry.student.id));
    setNoCreditResults((data.items ?? []).filter((item: StudentHit) => !alreadyAdded.has(item.id)));
  }

  async function addNoCreditStudent(student: StudentHit) {
    setNoCreditResults([]);
    setNoCreditQuery("");
    setNoCreditEntries((current) => [...current, { student, loadingFuture: true, ownFutureSessions: [], futureSessionId: "" }]);
    const response = await fetch(`/api/students/${student.id}/future-sessions`);
    const data = await response.json().catch(() => ({}));
    setNoCreditEntries((current) =>
      current.map((entry) =>
        entry.student.id === student.id ? { ...entry, loadingFuture: false, ownFutureSessions: data.items ?? [] } : entry,
      ),
    );
  }

  function removeNoCreditEntry(studentId: string) {
    setNoCreditEntries((current) => current.filter((entry) => entry.student.id !== studentId));
  }

  function setNoCreditFutureSession(studentId: string, futureSessionId: string) {
    setNoCreditEntries((current) => current.map((entry) => (entry.student.id === studentId ? { ...entry, futureSessionId } : entry)));
  }

  const readyNoCreditEntries = noCreditEntries.filter((entry) => entry.futureSessionId);

  async function submit() {
    if ((selectedIds.size === 0 && readyNoCreditEntries.length === 0) || !targetSessionId) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const [bulkResponse, ...prebookResponses] = await Promise.all([
      selectedIds.size > 0
        ? fetch(`/api/classes/${classId}/remedial-bulk-assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentIds: [...selectedIds], targetSessionId }),
          })
        : Promise.resolve(null),
      ...readyNoCreditEntries.map((entry) =>
        fetch(`/api/sessions/${targetSessionId}/prebook-makeup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: entry.student.id, futureSessionId: entry.futureSessionId }),
        }).then(async (res) => ({ entry, ok: res.ok, data: await res.json().catch(() => ({})) })),
      ),
    ]);
    setLoading(false);

    let combinedResults: Result[] = [];
    if (bulkResponse) {
      const bulkData = await bulkResponse.json().catch(() => ({}));
      if (!bulkResponse.ok) {
        setError(bulkData.error ?? "Không thể gán học viên có sẵn buổi bổ trợ.");
      } else {
        combinedResults = combinedResults.concat(bulkData.results ?? []);
      }
    }
    for (const { entry, ok, data } of prebookResponses) {
      combinedResults.push({
        studentId: entry.student.id,
        ok,
        message: ok ? `Đã đặt học bù trước cho ${entry.student.fullName}.` : data.error ?? `Không thể đặt học bù trước cho ${entry.student.fullName}.`,
      });
    }

    setResults(combinedResults);
    const okIds = new Set(combinedResults.filter((r) => r.ok).map((r) => r.studentId));
    setSelectedIds((current) => new Set([...current].filter((id) => !okIds.has(id))));
    setNoCreditEntries((current) => current.filter((entry) => !okIds.has(entry.student.id)));
    router.refresh();
    onSuccess?.();
  }

  return (
    <div className="rounded-2xl border border-[#dbe3ef] bg-[#fbfdff]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-[#0f1729]">
          Gán hàng loạt vào lớp bổ trợ ({candidates.length} người đã có buổi bổ trợ)
        </span>
        <span className="text-xs font-semibold text-[#1d4ed8]">{open ? "Thu gọn" : "Mở"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[#e5eaf7] px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">1. Học viên đã có buổi bổ trợ</p>
            {candidates.length === 0 ? (
              <p className="mt-2 text-xs text-[#64748b]">Chưa có học viên nào đang có buổi bổ trợ khả dụng.</p>
            ) : (
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
            )}
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">
              1b. Học viên CHƯA có buổi bổ trợ — học bù trước
            </p>
            <p className="mt-1 text-xs text-[#64748b]">
              Học viên bận 1 buổi tương lai của lớp đang học, muốn đi bù vào đúng buổi bổ trợ chọn ở bước 2 — chọn học viên rồi
              chọn đúng buổi tương lai cần bù. Buổi đó sẽ tự khóa lại (không sửa điểm danh được nữa) và không sinh thêm buổi bổ
              trợ nào khác.
            </p>
            <form onSubmit={searchNoCreditStudent} className="mt-2 flex gap-2">
              <input
                className="input"
                placeholder="Tìm học viên theo tên hoặc mã..."
                value={noCreditQuery}
                onChange={(event) => setNoCreditQuery(event.target.value)}
              />
              <button type="submit" disabled={noCreditSearching} className="btn-secondary shrink-0">
                {noCreditSearching ? "Đang tìm..." : "Tìm"}
              </button>
            </form>
            {noCreditResults.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {noCreditResults.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => addNoCreditStudent(student)}
                    className="flex w-full items-center justify-between rounded-lg border border-[#e5eaf7] bg-white px-3 py-2 text-left text-sm hover:border-primary/40"
                  >
                    <span className="font-semibold text-[#0f1729]">{student.fullName}</span>
                    <span className="text-xs text-[#64748b]">{student.studentCode}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {noCreditEntries.length > 0 ? (
              <div className="mt-3 space-y-2">
                {noCreditEntries.map((entry) => (
                  <div key={entry.student.id} className="rounded-xl border border-[#e5eaf7] bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        <span className="font-semibold text-[#0f1729]">{entry.student.fullName}</span>
                        <span className="ml-2 text-xs text-[#64748b]">{entry.student.studentCode}</span>
                      </span>
                      <button type="button" onClick={() => removeNoCreditEntry(entry.student.id)} className="text-xs font-bold text-red-600 hover:underline">
                        Xóa
                      </button>
                    </div>
                    <div className="mt-2">
                      {entry.loadingFuture ? (
                        <p className="text-xs text-[#64748b]">Đang tải lịch học...</p>
                      ) : entry.ownFutureSessions.length === 0 ? (
                        <p className="text-xs text-red-600">Học viên không có buổi tương lai nào trong lớp đang học.</p>
                      ) : (
                        <select
                          className="input"
                          value={entry.futureSessionId}
                          onChange={(event) => setNoCreditFutureSession(entry.student.id, event.target.value)}
                        >
                          <option value="">— Chọn buổi cần bù —</option>
                          {entry.ownFutureSessions.map((session) => (
                            <option key={session.id} value={session.id}>
                              {formatDate(session.sessionDate)} · {session.startTime}-{session.endTime} · {session.class.className}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">2. Chọn buổi bổ trợ đích của lớp này</p>
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
            disabled={(selectedIds.size === 0 && readyNoCreditEntries.length === 0) || !targetSessionId || loading}
            className="btn-primary"
          >
            {loading
              ? "Đang gán..."
              : `Gán ${selectedIds.size + readyNoCreditEntries.length || ""} học viên vào buổi đã chọn`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
