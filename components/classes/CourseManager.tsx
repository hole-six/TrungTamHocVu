"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Course = { id: string; code: string; name: string; tuitionPerSession: number; sessionsPerWeek: number; isActive: boolean };

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function CourseEditRow({ course, onDone }: { course: Course; onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: course.name,
    tuitionPerSession: String(course.tuitionPerSession),
    sessionsPerWeek: String(course.sessionsPerWeek),
    isActive: course.isActive,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể cập nhật khóa học.");
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-[#e8edf5] bg-[#fafbff] p-3 space-y-2">
      <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" className="input font-mono" value={form.tuitionPerSession} onChange={(e) => setForm((f) => ({ ...f, tuitionPerSession: e.target.value }))} />
        <input type="number" className="input font-mono" value={form.sessionsPerWeek} onChange={(e) => setForm((f) => ({ ...f, sessionsPerWeek: e.target.value }))} />
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-muted80">
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
        Đang áp dụng
      </label>
      {error && <div className="alert-danger text-xs">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-ghost-sm">{loading ? "Đang lưu..." : "Lưu"}</button>
        <button type="button" onClick={onDone} className="btn-ghost-sm">Hủy</button>
      </div>
    </form>
  );
}

export default function CourseManager({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", tuitionPerSession: "", sessionsPerWeek: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể tạo khóa học.");
      return;
    }
    setForm({ code: "", name: "", tuitionPerSession: "", sessionsPerWeek: "" });
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Khóa học</h2>
            <p className="text-xs text-ink-muted48">{courses.length} khóa</p>
          </div>
        </div>
        <button onClick={() => setOpen(!open)} className="btn-ghost-sm">
          {open ? "Đóng" : "+ Thêm khóa học"}
        </button>
      </div>

      {/* List */}
      <div className="space-y-2 mb-4">
        {courses.map((c) =>
          editingId === c.id ? (
            <CourseEditRow key={c.id} course={c} onDone={() => setEditingId(null)} />
          ) : (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-[#e8edf5] bg-white px-3.5 py-3">
              <div>
                <p className="text-sm font-bold text-ink">
                  <span className="font-mono text-xs text-ink-muted48 mr-2">[{c.code}]</span>
                  {c.name}
                  {!c.isActive && <span className="badge-gray ml-2 align-middle text-[10px]">Ngừng áp dụng</span>}
                </p>
                <p className="text-xs text-ink-muted48 mt-0.5">
                  {formatVnd(c.tuitionPerSession)}/buổi · {c.sessionsPerWeek} buổi/tuần
                </p>
              </div>
              <button onClick={() => setEditingId(c.id)} className="btn-ghost-sm">Sửa</button>
            </div>
          )
        )}
        {courses.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#e2e8f0] py-5 text-center">
            <p className="text-sm text-ink-muted48">Chưa có khóa học nào.</p>
          </div>
        )}
      </div>

      {/* Create form */}
      {open && (
        <div className="rounded-xl border border-[#e8edf5] bg-[#fafbff] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted48 mb-3">+ Thêm khóa học mới</p>
          <form onSubmit={create} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Mã khóa</label>
                <input
                  required
                  className="input font-mono"
                  placeholder="VD: FF3"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="label">Tên khóa học</label>
                <input
                  required
                  className="input"
                  placeholder="VD: First Friends 3"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Học phí / buổi (đ)</label>
                <input
                  type="number"
                  required
                  className="input font-mono"
                  placeholder="200000"
                  value={form.tuitionPerSession}
                  onChange={(e) => setForm((f) => ({ ...f, tuitionPerSession: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="label">Buổi/tuần</label>
                <input
                  type="number"
                  required
                  className="input font-mono"
                  placeholder="2"
                  value={form.sessionsPerWeek}
                  onChange={(e) => setForm((f) => ({ ...f, sessionsPerWeek: e.target.value }))}
                />
              </div>
            </div>
            {error && <div className="alert-danger text-xs">{error}</div>}
            <button type="submit" disabled={loading} className="btn-ghost-sm w-full border-dashed hover:border-primary hover:text-primary">
              {loading ? "Đang lưu..." : "+ Thêm khóa học"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
