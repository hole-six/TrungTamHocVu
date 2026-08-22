"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";

type LessonDetail = {
  className: string;
  date: string;
  sessionNumber: number | null;
  lesson: string | null;
  objective: string | null;
};

type CreditItem = {
  id: string;
  studentId: string;
  student: { id: string; fullName: string; studentCode: string };
  origin: string;
  paidAmount: number;
  lesson: LessonDetail | null;
};

type StudentHit = { id: string; fullName: string; studentCode: string };
type FutureSession = { id: string; sessionDate: string; startTime: string; endTime: string; class: { className: string } };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function RemedialSessionRoster({ sessionId, buttonLabel = "Chọn học sinh" }: { sessionId: string; buttonLabel?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"credits" | "wholeCourse">("credits");

  // Tab 1: Có buổi bổ trợ
  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [selectedCreditIds, setSelectedCreditIds] = useState<Set<string>>(new Set());
  const [addingCredits, setAddingCredits] = useState(false);

  // Tab 2: Học sinh toàn khóa
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentHit | null>(null);
  const [futureSessions, setFutureSessions] = useState<FutureSession[]>([]);
  const [loadingFuture, setLoadingFuture] = useState(false);
  const [futureSessionId, setFutureSessionId] = useState("");
  const [prebooking, setPrebooking] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open || tab !== "credits") return;
    setLoadingCredits(true);
    fetch("/api/session-credits?status=AVAILABLE")
      .then((res) => res.json())
      .then((data) => setCredits(data.items ?? []))
      .finally(() => setLoadingCredits(false));
  }, [open, tab]);

  function toggleCredit(id: string) {
    setSelectedCreditIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmCredits() {
    if (selectedCreditIds.size === 0) return;
    setAddingCredits(true);
    setError(null);
    setSuccess(null);
    let failed = 0;
    for (const creditId of selectedCreditIds) {
      const response = await fetch(`/api/session-credits/${creditId}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSessionId: sessionId }),
      });
      if (!response.ok) failed += 1;
    }
    setAddingCredits(false);
    if (failed > 0) {
      setError(`Có ${failed} học viên không thêm được vào buổi này — có thể buổi bổ trợ đã bị dùng ở nơi khác, thử lại.`);
    } else {
      setSuccess(`Đã thêm ${selectedCreditIds.size} học viên vào buổi bổ trợ này.`);
    }
    setSelectedCreditIds(new Set());
    router.refresh();
  }

  async function searchStudents(event: React.FormEvent) {
    event.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setSelectedStudent(null);
    const response = await fetch(`/api/students?q=${encodeURIComponent(q)}&status=ACTIVE&pageSize=10`);
    const data = await response.json().catch(() => ({}));
    setSearching(false);
    setResults(data.items ?? []);
  }

  async function pickStudentForWholeCourse(student: StudentHit) {
    setSelectedStudent(student);
    setResults([]);
    setFutureSessionId("");
    setLoadingFuture(true);
    const response = await fetch(`/api/students/${student.id}/future-sessions`);
    const data = await response.json().catch(() => ({}));
    setLoadingFuture(false);
    setFutureSessions(data.items ?? []);
  }

  async function confirmPrebook() {
    if (!selectedStudent || !futureSessionId) return;
    setPrebooking(true);
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/sessions/${sessionId}/prebook-makeup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selectedStudent.id, futureSessionId }),
    });
    const data = await response.json().catch(() => ({}));
    setPrebooking(false);
    if (!response.ok) {
      setError(data.error ?? "Không thể đặt học bù trước.");
      return;
    }
    setSuccess(`Đã đặt học bù trước cho ${selectedStudent.fullName}.`);
    setSelectedStudent(null);
    setFutureSessions([]);
    setFutureSessionId("");
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        {buttonLabel}
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Chọn học sinh cho buổi bổ trợ"
        description="Chọn học viên đã có buổi bổ trợ sẵn, hoặc cho học viên toàn khóa học bù trước 1 buổi tương lai."
      >
        <div className="space-y-5">
          <div className="tab-bar">
            <button type="button" onClick={() => setTab("credits")} className={tab === "credits" ? "tab-item-active" : "tab-item"}>
              Có buổi bổ trợ
            </button>
            <button type="button" onClick={() => setTab("wholeCourse")} className={tab === "wholeCourse" ? "tab-item-active" : "tab-item"}>
              Học sinh toàn khóa
            </button>
          </div>

          {error ? <div className="alert-danger">{error}</div> : null}
          {success ? <div className="alert-success">{success}</div> : null}

          {tab === "credits" ? (
            <div className="space-y-3">
              {loadingCredits ? (
                <p className="text-sm text-ink-muted48">Đang tải danh sách...</p>
              ) : credits.length === 0 ? (
                <p className="text-sm text-ink-muted48">Không có học viên nào đang có buổi bổ trợ khả dụng.</p>
              ) : (
                <>
                  {credits.map((item) => {
                    const checked = selectedCreditIds.has(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                          checked ? "border-primary bg-primary/5" : "border-[#e5eaf7] bg-white hover:border-primary/40"
                        }`}
                      >
                        <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={() => toggleCredit(item.id)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-ink">{item.student.fullName}</span>
                            <span className="text-xs text-ink-muted48">{item.student.studentCode}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              {item.origin === "ABSENCE" ? "Bổ trợ vắng" : item.origin === "PAID_CATCHUP" ? "Bổ trợ đầu khóa" : item.origin}
                            </span>
                          </div>
                          {item.lesson ? (
                            <div className="mt-2 rounded-lg bg-[#fff7ed] px-3 py-2 text-xs">
                              <p className="font-bold text-[#9a3412]">
                                Vắng buổi {formatDate(item.lesson.date)} · {item.lesson.className}
                                {item.lesson.sessionNumber ? ` · Buổi ${item.lesson.sessionNumber}` : ""}
                              </p>
                              <p className="mt-1 text-[#0f1729]">{item.lesson.lesson ?? "Chưa có bài trong nhật ký/roadmap"}</p>
                              {item.lesson.objective ? <p className="mt-0.5 text-[#64748b]">{item.lesson.objective}</p> : null}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-ink-muted48">
                              {item.origin === "PAID_CATCHUP" ? "Bổ trợ đầu khóa — không có bài cần bù riêng." : "Chưa rõ buổi vắng nguồn gốc."}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                  <button type="button" onClick={confirmCredits} disabled={addingCredits || selectedCreditIds.size === 0} className="btn-primary w-full">
                    {addingCredits ? "Đang thêm..." : `Thêm ${selectedCreditIds.size || ""} học viên vào buổi này`}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {!selectedStudent ? (
                <>
                  <form onSubmit={searchStudents} className="flex gap-2">
                    <input className="input" placeholder="Tìm theo tên hoặc mã học viên..." value={q} onChange={(event) => setQ(event.target.value)} />
                    <button type="submit" disabled={searching} className="btn-primary shrink-0">
                      {searching ? "Đang tìm..." : "Tìm"}
                    </button>
                  </form>
                  {results.length > 0 ? (
                    <div className="space-y-2">
                      {results.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => pickStudentForWholeCourse(student)}
                          className="flex w-full items-center justify-between rounded-xl border border-[#e5eaf7] bg-white px-4 py-3 text-left hover:border-primary/40"
                        >
                          <span className="font-bold text-ink">{student.fullName}</span>
                          <span className="text-xs text-ink-muted48">{student.studentCode}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3">
                    <div>
                      <p className="font-bold text-ink">{selectedStudent.fullName}</p>
                      <p className="text-xs text-ink-muted48">{selectedStudent.studentCode}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudent(null);
                        setFutureSessions([]);
                        setFutureSessionId("");
                      }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Đổi học viên
                    </button>
                  </div>

                  <label className="space-y-2 block">
                    <span className="label-sm">Buổi tương lai cần học bù trước</span>
                    {loadingFuture ? (
                      <p className="text-sm text-ink-muted48">Đang tải lịch học...</p>
                    ) : futureSessions.length === 0 ? (
                      <p className="text-sm text-red-600">Học viên không có buổi tương lai nào trong lớp đang học.</p>
                    ) : (
                      <select className="input" value={futureSessionId} onChange={(event) => setFutureSessionId(event.target.value)}>
                        <option value="">Chọn buổi</option>
                        {futureSessions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {formatDate(item.sessionDate)} · {item.startTime}-{item.endTime} · {item.class.className}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>

                  <button type="button" onClick={confirmPrebook} disabled={prebooking || !futureSessionId} className="btn-primary w-full">
                    {prebooking ? "Đang lưu..." : "Xác nhận học bù trước"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </ResponsiveDrawer>
    </>
  );
}
