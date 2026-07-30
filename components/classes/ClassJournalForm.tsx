"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Student = { id: string; fullName: string; studentCode: string };
type ScoreVal = { label: string; score: number | null; maxScore: number };
type Entry = { studentId: string; homeworkStatus: string; comment: string; notes: string; scores: ScoreVal[] };

const DEFAULT_LABELS = ["Vấn đáp", "Minitest từ", "Minitest NP"];
const HOMEWORK_OPTIONS = ["", "Đủ", "Chưa nộp", "Không có BTVN"];

function buildInitialRows(roster: Student[], labels: string[], existingEntries: any[]): Record<string, Entry> {
  const byStudent = Object.fromEntries(existingEntries.map((e) => [e.studentId, e]));
  const rows: Record<string, Entry> = {};
  for (const s of roster) {
    const existing = byStudent[s.id];
    const scoreByLabel = Object.fromEntries((existing?.scores ?? []).map((sc: any) => [sc.label, sc]));
    rows[s.id] = {
      studentId: s.id,
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

export default function ClassJournalForm({
  sessionId,
  roster,
  journal,
  publishedUrl,
}: {
  sessionId: string;
  roster: Student[];
  journal: { unitLesson: string | null; homeworkNote: string | null; publishedAt: string | Date | null; entries: any[] } | null;
  publishedUrl: string;
}) {
  const router = useRouter();
  const initialLabels =
    journal && journal.entries.length > 0 && journal.entries[0].scores.length > 0
      ? journal.entries[0].scores.map((s: any) => s.label)
      : DEFAULT_LABELS;

  const [unitLesson, setUnitLesson] = useState(journal?.unitLesson ?? "");
  const [homeworkNote, setHomeworkNote] = useState(journal?.homeworkNote ?? "");
  const [labels, setLabels] = useState<string[]>(initialLabels);
  const [rows, setRows] = useState<Record<string, Entry>>(() => buildInitialRows(roster, initialLabels, journal?.entries ?? []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isPublished = !!journal?.publishedAt;

  function updateRow(studentId: string, patch: Partial<Entry>) {
    setRows((r) => ({ ...r, [studentId]: { ...r[studentId], ...patch } }));
    setSaved(false);
  }

  function updateScore(studentId: string, label: string, value: string) {
    setRows((r) => {
      const row = r[studentId];
      const scores = row.scores.map((s) => (s.label === label ? { ...s, score: value === "" ? null : Number(value) } : s));
      return { ...r, [studentId]: { ...row, scores } };
    });
    setSaved(false);
  }

  function addLabel() {
    const name = window.prompt("Tên cột điểm mới (vd: Nghe, Đọc...)");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (labels.includes(trimmed)) return;
    setLabels((l) => [...l, trimmed]);
    setRows((r) => {
      const next = { ...r };
      for (const sid of Object.keys(next)) {
        next[sid] = { ...next[sid], scores: [...next[sid].scores, { label: trimmed, score: null, maxScore: 10 }] };
      }
      return next;
    });
  }

  function removeLabel(label: string) {
    setLabels((l) => l.filter((x) => x !== label));
    setRows((r) => {
      const next = { ...r };
      for (const sid of Object.keys(next)) {
        next[sid] = { ...next[sid], scores: next[sid].scores.filter((s) => s.label !== label) };
      }
      return next;
    });
  }

  async function save(publish: boolean) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/journal`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitLesson,
        homeworkNote,
        publish,
        entries: Object.values(rows).map((r) => ({
          studentId: r.studentId,
          homeworkStatus: r.homeworkStatus,
          comment: r.comment,
          notes: r.notes,
          scores: r.scores,
        })),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể lưu nhật ký lớp học.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Nhật ký lớp học</h2>
        {isPublished && (
          <Link href={publishedUrl} target="_blank" className="text-xs text-primary">
            Xem bản gửi phụ huynh ↗
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Unit / Lesson</label>
          <input className="input" placeholder="UNIT 1 - LESSON 1" value={unitLesson} onChange={(e) => { setUnitLesson(e.target.value); setSaved(false); }} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-hairline">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-[#fafbff] text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-3 py-2 font-medium">Học viên</th>
              {labels.map((label) => (
                <th key={label} className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-1">
                    <span>{label}</span>
                    <button type="button" onClick={() => removeLabel(label)} className="text-ink-muted48 hover:text-red-600" title="Xóa cột điểm">
                      ×
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 font-medium">
                <button type="button" onClick={addLabel} className="text-primary">
                  + Cột điểm
                </button>
              </th>
              <th className="px-3 py-2 font-medium">BTVN</th>
              <th className="px-3 py-2 font-medium min-w-[260px]">Nhận xét</th>
              <th className="px-3 py-2 font-medium">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {roster.map((s) => {
              const row = rows[s.id];
              if (!row) return null;
              return (
                <tr key={s.id}>
                  <td className="px-3 py-2 align-top">
                    <p className="font-medium text-ink">{s.fullName}</p>
                    <p className="text-xs text-ink-muted48">{s.studentCode}</p>
                  </td>
                  {labels.map((label) => {
                    const sc = row.scores.find((x) => x.label === label);
                    return (
                      <td key={label} className="px-3 py-2 align-top">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max={sc?.maxScore ?? 10}
                          className="input w-20"
                          value={sc?.score ?? ""}
                          onChange={(e) => updateScore(s.id, label, e.target.value)}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 align-top" />
                  <td className="px-3 py-2 align-top">
                    <select
                      className="input"
                      value={row.homeworkStatus}
                      onChange={(e) => updateRow(s.id, { homeworkStatus: e.target.value })}
                    >
                      {HOMEWORK_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt || "—"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <textarea
                      className="input min-h-[70px] resize-y"
                      value={row.comment}
                      onChange={(e) => updateRow(s.id, { comment: e.target.value })}
                      placeholder="Vấn đáp: ... Minitest: ... Viết tập: ..."
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input className="input" value={row.notes} onChange={(e) => updateRow(s.id, { notes: e.target.value })} />
                  </td>
                </tr>
              );
            })}
            {roster.length === 0 && (
              <tr>
                <td colSpan={labels.length + 4} className="px-3 py-6 text-center text-ink-muted48">
                  Lớp chưa có học viên đang ghi danh.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <label className="label">Dặn dò chung cuối buổi (hiển thị cho phụ huynh)</label>
        <textarea
          className="input min-h-[120px] resize-y"
          value={homeworkNote}
          onChange={(e) => { setHomeworkNote(e.target.value); setSaved(false); }}
          placeholder={'VD: "1. Các con ôn tập từ mới... 2. Hoàn thành viết tập từ vựng..."'}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Đã lưu nhật ký lớp học.</p>}

      <div className="flex flex-wrap gap-2 border-t border-hairline pt-3">
        <button type="button" disabled={loading} onClick={() => save(false)} className="btn-ghost">
          {loading ? "..." : "Lưu nháp"}
        </button>
        <button type="button" disabled={loading} onClick={() => save(true)} className="btn-primary">
          {loading ? "..." : isPublished ? "Cập nhật & giữ trạng thái đã gửi" : "Chốt & gửi phụ huynh"}
        </button>
      </div>
    </div>
  );
}
