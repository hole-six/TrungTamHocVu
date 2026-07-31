"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

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

function formatVnd(amount: number | null) {
  return amount != null ? `${amount.toLocaleString("vi-VN")}đ` : "—";
}

export default function ClassEditForm({ cls, courses }: { cls: ClassProfile; courses: Course[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/classes/${cls.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không lưu được thông tin lớp.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  const course = courses.find((item) => item.id === cls.courseId);

  return (
    <>
      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Thông tin lớp học</h2>
            <p className="mt-1 text-sm text-ink-muted48">Tóm tắt khóa học, học phí, tiến độ và ghi chú vận hành của lớp.</p>
          </div>
          <button onClick={() => setOpen(true)} className="btn-ghost">
            Sửa thông tin lớp
          </button>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="detail-row">
            <dt className="detail-label">Nhóm lớp</dt>
            <dd className="detail-value">{cls.classGroup ?? "Chưa khai báo"}</dd>
          </div>
          <div className="detail-row">
            <dt className="detail-label">Khóa học</dt>
            <dd className="detail-value">{course ? `[${course.code}] ${course.name}` : "Chưa gắn khóa học chuẩn"}</dd>
          </div>
          <div className="detail-row">
            <dt className="detail-label">Học phí / buổi</dt>
            <dd className="detail-value">{formatVnd(cls.tuitionPerSession)}</dd>
          </div>
          <div className="detail-row">
            <dt className="detail-label">Số buổi / tuần</dt>
            <dd className="detail-value">{cls.sessionsPerWeek ?? "—"}</dd>
          </div>
          <div className="detail-row">
            <dt className="detail-label">Tổng số buổi</dt>
            <dd className="detail-value">{cls.totalSessions ?? "—"}</dd>
          </div>
          <div className="detail-row">
            <dt className="detail-label">Ghi chú</dt>
            <dd className="detail-value">{cls.notes ?? "Chưa có ghi chú nội bộ"}</dd>
          </div>
        </dl>
      </div>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Sửa thông tin lớp học"
        description="Cập nhật khóa học, học phí, số buổi học, mốc thời gian và ghi chú để dữ liệu lớp luôn rõ ràng, dễ vận hành."
      >
        <form onSubmit={save} className="space-y-5">
          <label className="form-group">
            <span className="label">Tên lớp</span>
            <input required className="input" value={form.className} onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))} />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group">
              <span className="label">Nhóm lớp</span>
              <input className="input" value={form.classGroup} onChange={(event) => setForm((current) => ({ ...current, classGroup: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Khóa học chuẩn</span>
              <select className="input" value={form.courseId} onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value }))}>
                <option value="">Nhập tay / chưa gắn khóa</option>
                {courses.map((courseOption) => (
                  <option key={courseOption.id} value={courseOption.id}>
                    [{courseOption.code}] {courseOption.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-group">
              <span className="label">Học phí / buổi</span>
              <input type="number" min={0} className="input" value={form.tuitionPerSession} onChange={(event) => setForm((current) => ({ ...current, tuitionPerSession: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Số buổi / tuần</span>
              <input type="number" min={1} max={7} className="input" value={form.sessionsPerWeek} onChange={(event) => setForm((current) => ({ ...current, sessionsPerWeek: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Tổng số buổi</span>
              <input type="number" min={1} className="input" value={form.totalSessions} onChange={(event) => setForm((current) => ({ ...current, totalSessions: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Ngày khai giảng</span>
              <input type="date" className="input" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
            </label>

            <label className="form-group md:col-span-2">
              <span className="label">Ngày dự kiến kết thúc</span>
              <input type="date" className="input" value={form.expectedEndDate} onChange={(event) => setForm((current) => ({ ...current, expectedEndDate: event.target.value }))} />
            </label>
          </div>

          <label className="form-group">
            <span className="label">Ghi chú nội bộ</span>
            <textarea className="input resize-none" rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
