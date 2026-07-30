"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Course = { id: string; code: string; name: string };

type ClassProfile = {
  id: string;
  className: string;
  classGroup: string | null;
  courseId: string | null;
  tuitionPerSession: number | null;
  sessionsPerWeek: number | null;
  totalSessions: number | null;
  startDate: string | null;
  expectedEndDate: string | null;
  notes: string | null;
};

function toDateInput(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatVnd(n: number | null) {
  return n != null ? `${n.toLocaleString("vi-VN")}đ` : "—";
}

export default function ClassEditForm({ cls, courses }: { cls: ClassProfile; courses: Course[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    className: cls.className,
    classGroup: cls.classGroup ?? "",
    courseId: cls.courseId ?? "",
    tuitionPerSession: cls.tuitionPerSession?.toString() ?? "",
    sessionsPerWeek: cls.sessionsPerWeek?.toString() ?? "",
    totalSessions: cls.totalSessions?.toString() ?? "",
    startDate: toDateInput(cls.startDate),
    expectedEndDate: toDateInput(cls.expectedEndDate),
    notes: cls.notes ?? "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/classes/${cls.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không lưu được thông tin lớp.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const course = courses.find((c) => c.id === cls.courseId);

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Thông tin lớp</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost text-sm">
            Sửa
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between border-b border-hairline/60 py-1">
            <dt className="text-ink-muted48">Nhóm lớp</dt>
            <dd className="font-medium">{cls.classGroup ?? "—"}</dd>
          </div>
          <div className="flex justify-between border-b border-hairline/60 py-1">
            <dt className="text-ink-muted48">Khóa học</dt>
            <dd className="font-medium">{course ? `[${course.code}] ${course.name}` : "Nhập tay"}</dd>
          </div>
          <div className="flex justify-between border-b border-hairline/60 py-1">
            <dt className="text-ink-muted48">Học phí/buổi</dt>
            <dd className="font-medium">{formatVnd(cls.tuitionPerSession)}</dd>
          </div>
          <div className="flex justify-between border-b border-hairline/60 py-1">
            <dt className="text-ink-muted48">Số buổi/tuần</dt>
            <dd className="font-medium">{cls.sessionsPerWeek ?? "—"}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-ink-muted48">Ghi chú</dt>
            <dd className="font-medium">{cls.notes ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <form onSubmit={save} className="mt-3 space-y-3">
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Tên lớp</span>
            <input required className="input" value={form.className} onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))} />
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Nhóm lớp</span>
            <input className="input" value={form.classGroup} onChange={(e) => setForm((f) => ({ ...f, classGroup: e.target.value }))} />
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Khóa học</span>
            <select className="input" value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}>
              <option value="">Nhập tay / chưa gắn khóa</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-ink-muted48">Học phí/buổi</span>
              <input type="number" className="input" value={form.tuitionPerSession} onChange={(e) => setForm((f) => ({ ...f, tuitionPerSession: e.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-ink-muted48">Số buổi/tuần</span>
              <input type="number" className="input" value={form.sessionsPerWeek} onChange={(e) => setForm((f) => ({ ...f, sessionsPerWeek: e.target.value }))} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-ink-muted48">Tổng số buổi</span>
              <input type="number" className="input" value={form.totalSessions} onChange={(e) => setForm((f) => ({ ...f, totalSessions: e.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-ink-muted48">Ngày khai giảng</span>
              <input type="date" className="input" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Dự kiến kết thúc (để trống để tự tính)</span>
            <input type="date" className="input" value={form.expectedEndDate} onChange={(e) => setForm((f) => ({ ...f, expectedEndDate: e.target.value }))} />
          </label>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-ink-muted48">Ghi chú nội bộ</span>
            <textarea className="input resize-none" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
