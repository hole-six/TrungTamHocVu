"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StudentHit = { id: string; fullName: string; studentCode: string };

export default function EnrollStudentForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    setSelected(null);
    const res = await fetch(`/api/students?q=${encodeURIComponent(q)}&status=ACTIVE&pageSize=10`);
    const data = await res.json();
    setSearching(false);
    setResults(data.items ?? []);
  }

  async function enroll() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/classes/${classId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selected.id }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể ghi danh.");
      return;
    }
    setSuccess(`Đã ghi danh ${selected.fullName} thành công!`);
    setSelected(null);
    setResults([]);
    setQ("");
    setTimeout(() => setSuccess(null), 4000);
    router.refresh();
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
        </div>
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-ink">Ghi danh học viên</h2>
          <p className="text-xs text-ink-muted48">Tìm và chọn học viên đang học để thêm vào lớp.</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={search} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted48">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input pl-9"
            placeholder="Tên hoặc mã học viên..."
            value={q}
            onChange={(e) => { setQ(e.target.value); if (!e.target.value) setResults([]); }}
          />
        </div>
        <button type="submit" className="btn-ghost whitespace-nowrap" disabled={searching}>
          {searching ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
            </svg>
          ) : "Tìm"}
        </button>
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-1.5 mb-4">
          <p className="text-xs font-semibold text-ink-muted48 mb-2">{results.length} kết quả — click để chọn</p>
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(selected?.id === s.id ? null : s)}
              className={selected?.id === s.id ? "search-result-item-active" : "search-result-item"}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink">{s.fullName}</p>
                  <p className="text-xs text-ink-muted48 font-mono mt-0.5">{s.studentCode}</p>
                </div>
                {selected?.id === s.id && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {results.length === 0 && q && !searching && (
        <div className="mb-4 rounded-xl border border-dashed border-[#e2e8f0] py-5 text-center">
          <p className="text-sm text-ink-muted48">Không tìm thấy học viên nào với &ldquo;{q}&rdquo;</p>
        </div>
      )}

      {/* Enroll button */}
      {selected && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-emerald-700 font-semibold">Đã chọn:</p>
            <p className="text-sm font-bold text-emerald-900">{selected.fullName}</p>
          </div>
          <button
            onClick={enroll}
            disabled={loading}
            className="btn-primary-sm whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 ring-emerald-200"
          >
            {loading ? "Đang ghi danh..." : "Xác nhận ghi danh"}
          </button>
        </div>
      )}

      {/* Feedback */}
      {error && <div className="alert-danger mt-3 text-xs">{error}</div>}
      {success && (
        <div className="alert-success mt-3 flex items-center gap-1.5 text-xs">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {success}
        </div>
      )}
    </div>
  );
}
