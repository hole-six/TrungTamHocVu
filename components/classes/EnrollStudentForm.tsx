"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

type StudentHit = { id: string; fullName: string; studentCode: string };

export default function EnrollStudentForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!q.trim()) return;

    setSearching(true);
    setError(null);
    setSelected(null);

    const response = await fetch(`/api/students?q=${encodeURIComponent(q)}&status=ACTIVE&pageSize=10`);
    const result = await response.json().catch(() => ({}));
    setSearching(false);
    setResults(result.items ?? []);
  }

  async function enroll() {
    if (!selected) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/classes/${classId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selected.id }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể ghi danh học viên.");
      return;
    }

    setSuccess(`Đã ghi danh ${selected.fullName} vào lớp.`);
    setSelected(null);
    setResults([]);
    setQ("");
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Ghi danh học viên
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Ghi danh học viên vào lớp"
        description="Tìm học viên đang hoạt động theo tên hoặc mã, chọn đúng người rồi xác nhận ghi danh vào lớp này."
      >
        <div className="space-y-5">
          <form onSubmit={search} className="flex gap-3">
            <input
              className="input"
              placeholder="Tìm theo tên hoặc mã học viên..."
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                if (!event.target.value) setResults([]);
              }}
            />
            <button type="submit" className="btn-ghost whitespace-nowrap" disabled={searching}>
              {searching ? "Đang tìm..." : "Tìm học viên"}
            </button>
          </form>

          {results.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink-muted48">Chọn học viên phù hợp</p>
              {results.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setSelected(selected?.id === student.id ? null : student)}
                  className={selected?.id === student.id ? "search-result-item-active" : "search-result-item"}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{student.fullName}</p>
                      <p className="mt-1 text-xs font-mono text-ink-muted48">{student.studentCode}</p>
                    </div>
                    {selected?.id === student.id ? <span className="badge-green">Đã chọn</span> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {!results.length && q && !searching ? (
            <div className="empty-state rounded-2xl border border-dashed border-[#dbe7ff]">
              <p className="empty-state-title">Không tìm thấy học viên phù hợp</p>
              <p className="empty-state-desc">Thử tìm bằng mã học viên hoặc tên ngắn hơn.</p>
            </div>
          ) : null}

          {selected ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Sẵn sàng ghi danh</p>
              <p className="mt-2 text-base font-semibold text-emerald-950">{selected.fullName}</p>
              <p className="mt-1 text-sm text-emerald-800">{selected.studentCode}</p>
            </div>
          ) : null}

          {error ? <div className="alert-danger">{error}</div> : null}
          {success ? <div className="alert-success">{success}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="button" onClick={enroll} disabled={!selected || loading} className="btn-primary">
              {loading ? "Đang ghi danh..." : "Xác nhận ghi danh"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </SlideOver>
    </>
  );
}
