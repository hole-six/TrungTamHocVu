"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

type Course = {
  id: string;
  code: string;
  name: string;
  tuitionPerSession: number;
  sessionsPerWeek: number;
  isActive: boolean;
};

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function CourseEditor({
  course,
  onClose,
}: {
  course: Course;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: course.name,
    tuitionPerSession: String(course.tuitionPerSession),
    sessionsPerWeek: String(course.sessionsPerWeek),
    isActive: course.isActive,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể cập nhật khóa học.");
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <label className="form-group">
        <span className="label">Tên khóa học</span>
        <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-group">
          <span className="label">Học phí / buổi</span>
          <input
            type="number"
            min={0}
            className="input"
            value={form.tuitionPerSession}
            onChange={(event) => setForm((current) => ({ ...current, tuitionPerSession: event.target.value }))}
          />
        </label>

        <label className="form-group">
          <span className="label">Số buổi / tuần</span>
          <input
            type="number"
            min={1}
            max={7}
            className="input"
            value={form.sessionsPerWeek}
            onChange={(event) => setForm((current) => ({ ...current, sessionsPerWeek: event.target.value }))}
          />
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-ink">
        <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
        Khóa học này đang được áp dụng để tạo lớp mới
      </label>

      {error ? <div className="alert-danger">{error}</div> : null}

      <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost">
          Hủy
        </button>
      </div>
    </form>
  );
}

export default function CourseManager({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [openCreate, setOpenCreate] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState({ code: "", name: "", tuitionPerSession: "", sessionsPerWeek: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể tạo khóa học.");
      return;
    }

    setForm({ code: "", name: "", tuitionPerSession: "", sessionsPerWeek: "" });
    setOpenCreate(false);
    router.refresh();
  }

  return (
    <>
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Danh mục khóa học chuẩn</h2>
            <p className="mt-1 text-sm text-ink-muted48">
              Đây là nơi khai báo khóa học gốc để lớp học tự lấy học phí mỗi buổi và số buổi mỗi tuần khi tạo mới.
            </p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="btn-primary">
            + Thêm khóa học
          </button>
        </div>

        <div className="mt-5 table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Mã khóa</th>
                <th>Tên khóa học</th>
                <th>Học phí / buổi</th>
                <th>Số buổi / tuần</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td className="font-mono font-semibold text-primary">{course.code}</td>
                  <td>{course.name}</td>
                  <td>{formatVnd(course.tuitionPerSession)}</td>
                  <td>{course.sessionsPerWeek}</td>
                  <td>
                    <span className={course.isActive ? "badge-green" : "badge-gray"}>
                      {course.isActive ? "Đang áp dụng" : "Ngừng áp dụng"}
                    </span>
                  </td>
                  <td className="text-right">
                    <button onClick={() => setEditingCourse(course)} className="btn-ghost-sm">
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
              {courses.length === 0 ? (
                <tr className="table-empty">
                  <td colSpan={6}>Chưa có khóa học chuẩn nào.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOver
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm khóa học chuẩn"
        description="Khai báo khóa học gốc để khi tạo lớp, hệ thống tự điền học phí mỗi buổi và số buổi học trong tuần."
      >
        <form onSubmit={create} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group">
              <span className="label">Mã khóa học</span>
              <input
                required
                className="input"
                placeholder="Ví dụ: FF3"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              />
            </label>

            <label className="form-group">
              <span className="label">Tên khóa học</span>
              <input
                required
                className="input"
                placeholder="Ví dụ: First Friends 3"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label className="form-group">
              <span className="label">Học phí / buổi</span>
              <input
                type="number"
                required
                min={0}
                className="input"
                placeholder="200000"
                value={form.tuitionPerSession}
                onChange={(event) => setForm((current) => ({ ...current, tuitionPerSession: event.target.value }))}
              />
            </label>

            <label className="form-group">
              <span className="label">Số buổi / tuần</span>
              <input
                type="number"
                required
                min={1}
                max={7}
                className="input"
                placeholder="2"
                value={form.sessionsPerWeek}
                onChange={(event) => setForm((current) => ({ ...current, sessionsPerWeek: event.target.value }))}
              />
            </label>
          </div>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu khóa học"}
            </button>
            <button type="button" onClick={() => setOpenCreate(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={Boolean(editingCourse)}
        onClose={() => setEditingCourse(null)}
        title="Sửa khóa học"
        description="Cập nhật học phí, số buổi mỗi tuần hoặc trạng thái áp dụng của khóa học này."
      >
        {editingCourse ? <CourseEditor course={editingCourse} onClose={() => setEditingCourse(null)} /> : null}
      </SlideOver>
    </>
  );
}
