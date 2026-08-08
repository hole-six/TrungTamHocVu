"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Score = {
  id: string;
  schoolYear: string;
  midTerm1: number | null;
  finalTerm1: number | null;
  midTerm2: number | null;
  finalTerm2: number | null;
};

function currentSchoolYear() {
  const now = new Date();
  const y = now.getFullYear();
  // Năm học VN bắt đầu khoảng tháng 9 — trước tháng 9 tính là năm học của năm trước.
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export default function SchoolExamScoreForm({ studentId, scores }: { studentId: string; scores: Score[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const existing = scores[0];
  const [schoolYear, setSchoolYear] = useState(existing?.schoolYear ?? currentSchoolYear());
  const [midTerm1, setMidTerm1] = useState(existing?.midTerm1?.toString() ?? "");
  const [finalTerm1, setFinalTerm1] = useState(existing?.finalTerm1?.toString() ?? "");
  const [midTerm2, setMidTerm2] = useState(existing?.midTerm2?.toString() ?? "");
  const [finalTerm2, setFinalTerm2] = useState(existing?.finalTerm2?.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function removeScore(scoreId: string) {
    setDeletingId(scoreId);
    setDeleteError(null);
    const res = await fetch(`/api/students/${studentId}/exam-scores/${scoreId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDeletingId(null);
    if (!res.ok) {
      setDeleteError(data.error ?? "Không thể xóa điểm.");
      return;
    }
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/students/${studentId}/exam-scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolYear, midTerm1, finalTerm1, midTerm2, finalTerm2 }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể lưu điểm.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted48">Hồ sơ</p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">Điểm học lực tại trường</h2>
        </div>
        <button onClick={() => setOpen(!open)} className="btn-ghost-sm">
          {open ? "Đóng" : existing ? "Sửa" : "+ Thêm"}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {scores.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2 text-sm">
            <div>
              <p className="font-medium">Năm học {s.schoolYear}</p>
              <div className="mt-1 grid grid-cols-4 gap-2 text-ink-muted48">
                <span>Giữa HKI: <strong className="text-ink">{s.midTerm1 ?? "—"}</strong></span>
                <span>Cuối HKI: <strong className="text-ink">{s.finalTerm1 ?? "—"}</strong></span>
                <span>Giữa HKII: <strong className="text-ink">{s.midTerm2 ?? "—"}</strong></span>
                <span>Cuối HKII: <strong className="text-ink">{s.finalTerm2 ?? "—"}</strong></span>
              </div>
            </div>
            <ConfirmActionButton
              title="Xác nhận xóa điểm học lực?"
              description={`Xóa toàn bộ điểm học lực năm học ${s.schoolYear}. Thao tác này không thể hoàn tác.`}
              confirmLabel="Xóa"
              tone="danger"
              disabled={deletingId === s.id}
              className="shrink-0 text-xs text-red-600"
              onConfirm={() => removeScore(s.id)}
            >
              {deletingId === s.id ? "..." : "Xóa"}
            </ConfirmActionButton>
          </div>
        ))}
        {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
        {scores.length === 0 && <p className="text-sm text-ink-muted48">Chưa có điểm học lực nào.</p>}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-3 space-y-2 border-t border-hairline pt-3">
          <input
            className="input"
            placeholder="Năm học (vd 2025-2026)"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Giữa HKI" value={midTerm1} onChange={(e) => setMidTerm1(e.target.value)} />
            <input className="input" placeholder="Cuối HKI" value={finalTerm1} onChange={(e) => setFinalTerm1(e.target.value)} />
            <input className="input" placeholder="Giữa HKII" value={midTerm2} onChange={(e) => setMidTerm2(e.target.value)} />
            <input className="input" placeholder="Cuối HKII" value={finalTerm2} onChange={(e) => setFinalTerm2(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Đang lưu..." : "Lưu điểm"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
