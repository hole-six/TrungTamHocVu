"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Course = {
  id: string;
  code: string;
  name: string;
  tuitionPerSession: number;
  sessionsPerWeek: number;
};

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

export default function NewClassForm({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    classCode: "",
    className: "",
    classGroup: "",
    courseId: "",
    totalSessions: "",
    startDate: "",
    tuitionPerSession: "",
    sessionsPerWeek: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onCourseChange(courseId: string) {
    const course = courses.find((c) => c.id === courseId);
    setForm((f) => ({
      ...f,
      courseId,
      tuitionPerSession: course ? String(course.tuitionPerSession) : f.tuitionPerSession,
      sessionsPerWeek: course ? String(course.sessionsPerWeek) : f.sessionsPerWeek,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo lớp.");
      return;
    }
    router.push(`/classes/${data.item.id}`);
  }

  const selectedCourse = courses.find((c) => c.id === form.courseId);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-0">
      {/* Back + title */}
      <div>
        <Link
          href="/classes"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted48 hover:text-primary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Quay lại Lớp &amp; Lịch
        </Link>
        <h1 className="page-title mt-2">Thêm lớp học mới</h1>
        <p className="page-subtitle">Tạo lớp và kết nối với khóa học để tự động điền học phí.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Section: Thông tin cơ bản */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">1</span>
            <h3 className="text-sm font-bold text-ink uppercase tracking-wide">Thông tin cơ bản</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="form-group">
              <label className="label">Mã lớp <span className="text-red-500">*</span></label>
              <input
                required
                className="input font-mono"
                placeholder="VD: FF3-2024"
                value={form.classCode}
                onChange={(e) => update("classCode", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="label">Tên lớp <span className="text-red-500">*</span></label>
              <input
                required
                className="input"
                placeholder="VD: First Friends 3 - Sáng T2T4"
                value={form.className}
                onChange={(e) => update("className", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Section: Khóa học */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">2</span>
            <h3 className="text-sm font-bold text-ink uppercase tracking-wide">Khóa học &amp; Học phí</h3>
          </div>

          <div className="form-group mb-4">
            <label className="label">Gắn với khóa học</label>
            <select
              className="input"
              value={form.courseId}
              onChange={(e) => onCourseChange(e.target.value)}
            >
              <option value="">— Nhập thủ công —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.code}] {c.name} · {formatVnd(c.tuitionPerSession)}/buổi
                </option>
              ))}
            </select>
            <p className="form-hint">Chọn khóa học sẽ tự điền học phí và số buổi/tuần.</p>
          </div>

          {/* Course preview chip */}
          {selectedCourse && (
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">{selectedCourse.name}</p>
                <p className="text-xs text-ink-muted80">{formatVnd(selectedCourse.tuitionPerSession)}/buổi · {selectedCourse.sessionsPerWeek} buổi/tuần</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="form-group">
              <label className="label">Học phí / buổi (đ)</label>
              <input
                type="number"
                className="input"
                placeholder="170000"
                value={form.tuitionPerSession}
                onChange={(e) => update("tuitionPerSession", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="label">Số buổi / tuần</label>
              <input
                type="number"
                min="1"
                max="7"
                className="input"
                placeholder="2"
                value={form.sessionsPerWeek}
                onChange={(e) => update("sessionsPerWeek", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Section: Lịch học */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">3</span>
            <h3 className="text-sm font-bold text-ink uppercase tracking-wide">Tiến độ &amp; Lịch</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="form-group">
              <label className="label">Tổng buổi học của khóa</label>
              <input
                type="number"
                className="input"
                placeholder="48"
                value={form.totalSessions}
                onChange={(e) => update("totalSessions", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="label">Ngày khai giảng</label>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Notes */}
        <div className="form-group">
          <label className="label">Ghi chú nội bộ</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Thông tin thêm về lớp, yêu cầu đặc biệt..."
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>

        {error && <div className="alert-danger">{error}</div>}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/classes" className="btn-ghost w-full sm:w-auto justify-center">
            Hủy
          </Link>
          <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto justify-center">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
                </svg>
                Đang tạo lớp...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Tạo lớp học
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
