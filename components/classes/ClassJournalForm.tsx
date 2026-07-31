"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { printPage } from "@/lib/export-utils";

type Student = { id: string; fullName: string; studentCode: string };
type ScoreVal = { label: string; score: number | null; maxScore: number };
type Entry = { studentId: string; homeworkStatus: string; comment: string; notes: string; scores: ScoreVal[] };

type PlannedRoadmap = {
  sessionNumber: number;
  title: string | null;
  objective: string | null;
  materials: string | null;
  teacherGuide: string | null;
  homeworkGuide: string | null;
} | null;

type PrintMeta = {
  centerName?: string;
  branchName: string;
  className: string;
  sessionDateLabel: string;
  weekdayLabel: string;
  scheduleLabel: string;
  totalStudents: number;
};

const DEFAULT_LABELS = ["Vấn đáp", "Minitest từ", "Minitest NP"];
const HOMEWORK_OPTIONS = ["", "Đủ", "Chưa nộp", "Không có BTVN"];

function buildInitialRows(roster: Student[], labels: string[], existingEntries: any[]): Record<string, Entry> {
  const byStudent = Object.fromEntries(existingEntries.map((entry) => [entry.studentId, entry]));
  const rows: Record<string, Entry> = {};

  for (const student of roster) {
    const existing = byStudent[student.id];
    const scoreByLabel = Object.fromEntries((existing?.scores ?? []).map((score: any) => [score.label, score]));

    rows[student.id] = {
      studentId: student.id,
      homeworkStatus: existing?.homeworkStatus ?? "",
      comment: existing?.comment ?? "",
      notes: existing?.notes ?? "",
      scores: labels.map((label) => ({
        label,
        score: scoreByLabel[label]?.score ?? null,
        maxScore: scoreByLabel[label]?.maxScore ?? 10,
      })),
    };
  }

  return rows;
}

function normalizePrintOrder(labels: string[]) {
  const preferred = ["Vấn đáp", "Minitest từ", "Minitest NP", "Viết tập", "BTVN"];
  const remaining = labels.filter((label) => !preferred.includes(label));
  return [...preferred.filter((label) => labels.includes(label)), ...remaining];
}

function buildHomeworkLines(note: string) {
  return note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderCommentLines(comment: string) {
  const lines = comment
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return <p className="italic text-slate-400">Chưa có nhận xét.</p>;
  }

  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const lower = line.toLowerCase();
        const isAbsent = lower.includes("vắng");
        const isHeading =
          lower.startsWith("vấn đáp") ||
          lower.startsWith("minitest") ||
          lower.startsWith("viết tập") ||
          lower.startsWith("btvn");

        return (
          <p
            key={`${line}-${index}`}
            className={
              isAbsent
                ? "font-bold text-red-600"
                : isHeading
                  ? "font-semibold text-sky-800"
                  : "text-slate-700"
            }
          >
            {line.startsWith("-") ? line.slice(1).trim() : line}
          </p>
        );
      })}
    </div>
  );
}

export default function ClassJournalForm({
  sessionId,
  roster,
  journal,
  publishedUrl,
  plannedRoadmap,
  printMeta,
}: {
  sessionId: string;
  roster: Student[];
  journal: { unitLesson: string | null; homeworkNote: string | null; publishedAt: string | Date | null; entries: any[] } | null;
  publishedUrl: string;
  plannedRoadmap: PlannedRoadmap;
  printMeta: PrintMeta;
}) {
  const router = useRouter();
  const initialLabels =
    journal && journal.entries.length > 0 && journal.entries[0].scores.length > 0
      ? journal.entries[0].scores.map((score: any) => score.label)
      : DEFAULT_LABELS;

  const [unitLesson, setUnitLesson] = useState(journal?.unitLesson ?? plannedRoadmap?.title ?? "");
  const [homeworkNote, setHomeworkNote] = useState(journal?.homeworkNote ?? plannedRoadmap?.homeworkGuide ?? "");
  const [labels, setLabels] = useState<string[]>(initialLabels);
  const [rows, setRows] = useState<Record<string, Entry>>(() => buildInitialRows(roster, initialLabels, journal?.entries ?? []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const isPublished = Boolean(journal?.publishedAt);
  const draftKey = `journal-draft-${sessionId}`;
  const mountedRef = useRef(false);

  useEffect(() => {
    if (isPublished) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.unitLesson !== undefined) setUnitLesson(draft.unitLesson);
      if (draft.homeworkNote !== undefined) setHomeworkNote(draft.homeworkNote);
      if (Array.isArray(draft.labels)) setLabels(draft.labels);
      if (draft.rows) setRows(draft.rows);
      setDraftRestored(true);
    } catch {
      // ignore broken draft
    }
  }, [draftKey, isPublished]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (isPublished) return;

    const timeout = setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ unitLesson, homeworkNote, labels, rows }));
      } catch {
        // ignore local storage issues
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [draftKey, homeworkNote, isPublished, labels, rows, unitLesson]);

  const printLabels = useMemo(() => normalizePrintOrder(labels), [labels]);
  const homeworkLines = useMemo(() => buildHomeworkLines(homeworkNote), [homeworkNote]);

  function updateRow(studentId: string, patch: Partial<Entry>) {
    setRows((current) => ({ ...current, [studentId]: { ...current[studentId], ...patch } }));
    setSaved(false);
  }

  function updateScore(studentId: string, label: string, value: string) {
    setRows((current) => {
      const row = current[studentId];
      const scores = row.scores.map((score) => (score.label === label ? { ...score, score: value === "" ? null : Number(value) } : score));
      return { ...current, [studentId]: { ...row, scores } };
    });
    setSaved(false);
  }

  function addLabel() {
    const name = window.prompt("Tên cột điểm mới");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (labels.includes(trimmed)) return;

    setLabels((current) => [...current, trimmed]);
    setRows((current) => {
      const next = { ...current };
      for (const studentId of Object.keys(next)) {
        next[studentId] = {
          ...next[studentId],
          scores: [...next[studentId].scores, { label: trimmed, score: null, maxScore: 10 }],
        };
      }
      return next;
    });
    setSaved(false);
  }

  function removeLabel(label: string) {
    setLabels((current) => current.filter((item) => item !== label));
    setRows((current) => {
      const next = { ...current };
      for (const studentId of Object.keys(next)) {
        next[studentId] = {
          ...next[studentId],
          scores: next[studentId].scores.filter((score) => score.label !== label),
        };
      }
      return next;
    });
    setSaved(false);
  }

  async function save(publish: boolean) {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/sessions/${sessionId}/journal`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitLesson,
        homeworkNote,
        publish,
        entries: Object.values(rows).map((row) => ({
          studentId: row.studentId,
          homeworkStatus: row.homeworkStatus,
          comment: row.comment,
          notes: row.notes,
          scores: row.scores,
        })),
      }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Không thể lưu nhật ký lớp học.");
      return;
    }

    setSaved(true);
    setDraftRestored(false);
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
    router.refresh();
  }

  return (
    <div className="print-area">
      <div className="card space-y-5 print:hidden">
        {draftRestored ? (
          <div className="no-print flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <span>Đã khôi phục bản nháp chưa lưu trong máy này. Kiểm tra lại rồi bấm lưu để chốt dữ liệu.</span>
            <button type="button" onClick={() => setDraftRestored(false)} className="font-semibold hover:underline">
              Đã hiểu
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Bước 3</p>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">Nhật ký lớp học & nội dung gửi phụ huynh</h2>
            <p className="mt-1 text-sm text-ink-muted48">
              Khối này dùng để ghi tiến độ, nhận xét từng học viên và dặn dò cuối buổi cho phụ huynh.
            </p>
          </div>
          <div className="no-print flex items-center gap-3">
            <button type="button" onClick={printPage} className="text-xs font-semibold text-primary hover:underline">
              Xuất PDF mẫu phụ huynh
            </button>
            {isPublished ? (
              <Link href={publishedUrl} target="_blank" className="text-xs font-semibold text-primary">
                Xem bản gửi phụ huynh
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <label className="form-group">
            <span className="label">Unit / Lesson của buổi học</span>
            <input
              className="input"
              placeholder="VD: UNIT 1 - LESSON 1"
              value={unitLesson}
              onChange={(event) => {
                setUnitLesson(event.target.value);
                setSaved(false);
              }}
            />
          </label>

          <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
            <p className="font-semibold text-ink">Bản in PDF sẽ theo mẫu biểu</p>
            <p className="mt-1">
              Khi in, hệ thống sẽ tự đổi sang layout tài liệu chuẩn, chỉ giữ lại bảng nhật ký và phần dặn dò cuối buổi.
            </p>
          </div>
        </div>

        {plannedRoadmap ? (
          <div className="rounded-[24px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_100%)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Lộ trình cố định của buổi {plannedRoadmap.sessionNumber}</p>
                <p className="mt-1 text-lg font-semibold text-ink">{plannedRoadmap.title || `Buổi ${plannedRoadmap.sessionNumber}`}</p>
              </div>
              <span className="badge bg-sky-100 text-sky-700">Khung chuẩn trước giờ dạy</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-hairline bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted48">Mục tiêu</p>
                <p className="mt-2 text-sm leading-6 text-ink">{plannedRoadmap.objective?.trim() || "Chưa có mục tiêu buổi học."}</p>
              </div>
              <div className="rounded-2xl border border-hairline bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted48">Tài liệu</p>
                <p className="mt-2 text-sm leading-6 text-ink">{plannedRoadmap.materials?.trim() || "Chưa có tài liệu / học cụ."}</p>
              </div>
              <div className="rounded-2xl border border-hairline bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted48">Gợi ý cho giáo viên</p>
                <p className="mt-2 text-sm leading-6 text-ink">
                  {plannedRoadmap.teacherGuide?.trim() || plannedRoadmap.homeworkGuide?.trim() || "Chưa có hướng dẫn thêm cho buổi học này."}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="table-container">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="border-b border-hairline bg-[#fafbff] text-xs uppercase tracking-wide text-ink-muted48">
              <tr>
                <th className="min-w-[220px] px-3 py-3 font-medium">Học viên</th>
                {labels.map((label) => (
                  <th key={label} className="px-3 py-3 font-medium">
                    <div className="flex items-center gap-1">
                      <span>{label}</span>
                      <button type="button" onClick={() => removeLabel(label)} className="no-print text-ink-muted48 hover:text-red-600" title="Xóa cột điểm">
                        ×
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 font-medium">
                  <button type="button" onClick={addLabel} className="no-print text-primary">
                    + Cột điểm
                  </button>
                </th>
                <th className="min-w-[180px] px-3 py-3 font-medium">Bài tập về nhà</th>
                <th className="min-w-[320px] px-3 py-3 font-medium">Nhận xét gửi phụ huynh</th>
                <th className="min-w-[220px] px-3 py-3 font-medium">Ghi chú nội bộ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-hairline">
              {roster.map((student) => {
                const row = rows[student.id];
                if (!row) return null;

                return (
                  <tr key={student.id}>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-ink">{student.fullName}</p>
                      <p className="mt-1 text-xs text-ink-muted48">{student.studentCode}</p>
                    </td>

                    {labels.map((label) => {
                      const score = row.scores.find((item) => item.label === label);
                      return (
                        <td key={label} className="px-3 py-3 align-top">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max={score?.maxScore ?? 10}
                            className="input w-24"
                            value={score?.score ?? ""}
                            onChange={(event) => updateScore(student.id, label, event.target.value)}
                          />
                        </td>
                      );
                    })}

                    <td className="px-3 py-3 align-top" />

                    <td className="px-3 py-3 align-top">
                      <select
                        className="input"
                        value={row.homeworkStatus}
                        onChange={(event) => updateRow(student.id, { homeworkStatus: event.target.value })}
                      >
                        {HOMEWORK_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option || "—"}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <textarea
                        className="input min-h-[96px] resize-y"
                        value={row.comment}
                        onChange={(event) => updateRow(student.id, { comment: event.target.value })}
                        placeholder="VD: Hôm nay tập trung tốt, cần ôn thêm từ vựng..."
                      />
                    </td>

                    <td className="px-3 py-3 align-top">
                      <textarea
                        className="input min-h-[96px] resize-y"
                        value={row.notes}
                        onChange={(event) => updateRow(student.id, { notes: event.target.value })}
                        placeholder="Ghi chú cho giáo vụ / giáo viên, không gửi phụ huynh"
                      />
                    </td>
                  </tr>
                );
              })}

              {roster.length === 0 ? (
                <tr>
                  <td colSpan={labels.length + 5} className="px-3 py-6 text-center text-ink-muted48">
                    Lớp chưa có học viên đang ghi danh.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <label className="form-group">
          <span className="label">Dặn dò chung cuối buổi (hiển thị cho phụ huynh)</span>
          <textarea
            className="input min-h-[160px] resize-y"
            value={homeworkNote}
            onChange={(event) => {
              setHomeworkNote(event.target.value);
              setSaved(false);
            }}
            placeholder="VD: 1. Ôn từ mới Unit 1. 2. Hoàn thành viết tập trang 12-13. 3. Chuẩn bị bài đọc cho buổi sau."
          />
        </label>

        {error ? <p className="no-print text-sm text-red-600">{error}</p> : null}
        {saved ? <p className="no-print text-sm text-emerald-600">Đã lưu nhật ký lớp học.</p> : null}

        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          <p className="text-sm text-ink-muted48">Có thể lưu nháp trước, sau đó chốt để gửi cho phụ huynh.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={loading} onClick={() => save(false)} className="btn-ghost">
              {loading ? "..." : "Lưu nháp"}
            </button>
            <button type="button" disabled={loading} onClick={() => save(true)} className="btn-primary">
              {loading ? "..." : isPublished ? "Cập nhật & giữ trạng thái đã gửi" : "Chốt & gửi phụ huynh"}
            </button>
          </div>
        </div>
      </div>

      <div className="hidden bg-white print:block">
        <div className="mx-auto min-h-[1122px] w-[794px] bg-white px-1 py-2 text-[12px] leading-5 text-black">
          <div className="border border-slate-700">
            <div className="border-b border-slate-700 px-3 py-1 text-center">
              <p className="text-[15px] font-bold uppercase tracking-[0.08em]">
                {printMeta.centerName || "Trung tâm Anh ngữ"}
              </p>
              <p className="text-[26px] font-bold uppercase leading-8">Nhật ký lớp học</p>
            </div>

            <div className="grid grid-cols-[1fr_1.4fr_0.7fr_1fr] border-b border-slate-700 text-[12px]">
              <div className="border-r border-slate-700 px-2 py-1">
                <span className="font-bold">Cơ sở:</span> {printMeta.branchName}
              </div>
              <div className="border-r border-slate-700 px-2 py-1">
                <span className="font-bold">Lớp:</span> {printMeta.className}
              </div>
              <div className="border-r border-slate-700 px-2 py-1 text-center">
                <span className="font-bold">Số HV:</span> {printMeta.totalStudents}
              </div>
              <div className="px-2 py-1">
                <span className="font-bold">Ngày:</span> {printMeta.sessionDateLabel}
              </div>
            </div>

            <div className="border-b border-slate-700 px-2 py-1 text-[12px]">
              <span className="font-bold">Lịch học:</span> {printMeta.scheduleLabel}
            </div>

            <div className="border-b border-slate-700 px-2 py-2 text-center">
              <p className="text-[18px] font-bold uppercase tracking-[0.04em] text-[#2f5ea6]">
                {unitLesson || "Chưa ghi unit / lesson"}
              </p>
            </div>

            <div className="border-b border-slate-700 px-2 py-1">
              <p className="text-[14px] font-bold uppercase">II. Nhận xét của giáo viên</p>
            </div>

            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#cfe6b8]">
                  <th rowSpan={2} className="border-r border-b border-slate-700 px-1 py-1 text-left font-bold">
                    Mã HV
                  </th>
                  <th rowSpan={2} className="border-r border-b border-slate-700 px-2 py-1 text-left font-bold">
                    Họ tên
                  </th>
                  <th
                    colSpan={Math.max(printLabels.filter((label) => label !== "BTVN").length, 1)}
                    className="border-r border-b border-slate-700 px-1 py-1 text-center font-bold"
                  >
                    ĐIỂM
                  </th>
                  <th rowSpan={2} className="border-r border-b border-slate-700 px-1 py-1 text-center font-bold">
                    BTVN
                  </th>
                  <th rowSpan={2} className="border-r border-b border-slate-700 px-2 py-1 text-center font-bold">
                    NHẬN XÉT
                  </th>
                  <th rowSpan={2} className="border-b border-slate-700 px-2 py-1 text-center font-bold">
                    Ghi chú
                  </th>
                </tr>
                <tr className="bg-[#cfe6b8]">
                  {printLabels
                    .filter((label) => label !== "BTVN")
                    .map((label) => (
                      <th key={label} className="border-r border-b border-slate-700 px-1 py-1 text-center font-bold">
                        {label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {roster.length ? (
                  roster.map((student) => {
                    const row = rows[student.id];
                    if (!row) return null;
                    const scoreMap = Object.fromEntries(row.scores.map((score) => [score.label, score.score]));
                    const scoreHeaders = printLabels.filter((label) => label !== "BTVN");

                    return (
                      <tr key={student.id} className="align-top">
                        <td className="border-r border-b border-slate-700 px-1 py-2 text-[10px]">
                          {student.studentCode || ""}
                        </td>
                        <td className="border-r border-b border-slate-700 bg-[#fff2cc] px-2 py-2 font-semibold">
                          {student.fullName}
                        </td>
                        {scoreHeaders.map((label) => (
                          <td
                            key={`${student.id}-${label}`}
                            className="border-r border-b border-slate-700 px-1 py-2 text-center text-[14px] font-bold text-[#2f5ea6]"
                          >
                            {scoreMap[label] ?? ""}
                          </td>
                        ))}
                        <td
                          className={`border-r border-b border-slate-700 px-1 py-2 text-center font-bold ${
                            row.homeworkStatus === "Chưa nộp" ? "text-red-600" : "text-[#2f5ea6]"
                          }`}
                        >
                          {row.homeworkStatus || ""}
                        </td>
                        <td className="border-r border-b border-slate-700 px-2 py-2 align-top text-[11px] leading-5">
                          {renderCommentLines(row.comment)}
                        </td>
                        <td className="border-b border-slate-700 px-2 py-2 align-top text-[11px] text-slate-700">
                          {row.notes || ""}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={Math.max(printLabels.filter((label) => label !== "BTVN").length, 1) + 5}
                      className="border-b border-slate-700 px-3 py-8 text-center text-slate-400"
                    >
                      Chưa có học viên trong lớp này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="px-2 py-2">
              <p className="text-[16px] font-bold text-[#2f5ea6]">
                Trung tâm xin nhờ bố mẹ nhắc các con làm bài tập về nhà như sau:
              </p>
              <div className="mt-2 min-h-[210px] space-y-1 text-[13px] leading-6 text-[#2f5ea6]">
                {homeworkLines.length ? (
                  homeworkLines.map((line, index) => {
                    const isImportant =
                      /^\d+\./.test(line) ||
                      line.toLowerCase().includes("hoàn thành") ||
                      line.toLowerCase().includes("ôn") ||
                      line.toLowerCase().includes("kiểm tra");

                    return (
                      <p key={`${line}-${index}`} className={isImportant ? "font-bold text-red-600" : "font-semibold"}>
                        {line}
                      </p>
                    );
                  })
                ) : (
                  <p className="italic text-slate-400">Chưa có dặn dò cuối buổi.</p>
                )}
              </div>
              <p className="mt-2 text-[15px] font-bold text-[#2f5ea6]">Trung tâm xin cảm ơn ạ!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
