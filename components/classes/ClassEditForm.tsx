"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd as formatVndBase } from "@/lib/export-utils";
import ClassRoadmapEditor, { useRoadmapDrafts, type RoadmapDraft, type RoadmapSessionDate } from "@/components/classes/ClassRoadmapEditor";

type Course = { id: string; code: string; name: string };
type ClassOption = { id: string; classCode: string; className: string };

type ClassProfile = {
  id: string;
  classCode: string;
  className: string;
  classGroup: string | null;
  courseId: string | null;
  tuitionPerSession: number | null;
  sessionsPerWeek: number | null;
  totalSessions: number | null;
  startDate: string | null;
  expectedEndDate: string | null;
  nextClassId?: string | null;
  notes: string | null;
  roadmapItems: RoadmapDraft[];
};

function toDateInput(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatVnd(amount: number | null) {
  return amount == null || Number.isNaN(amount) ? "—" : formatVndBase(amount);
}

const CLASS_EDIT_GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng form sửa lớp?",
    items: [
      "Dùng khi cần chỉnh thông tin lõi của lớp đã tạo: khóa học, học phí, tổng số buổi, ngày khai giảng hoặc lộ trình từng buổi.",
      "Đây là form sửa cấu trúc lớp, không phải nơi xử lý một buổi lẻ bị dời lịch hay học bù.",
      "Nếu lớp đang chạy, nên hiểu rõ tác động trước khi sửa học phí hoặc tổng số buổi.",
    ],
    tone: "info" as const,
  },
  {
    title: "Những phần quan trọng nhất",
    items: [
      "Học phí / buổi và tổng số buổi quyết định ước tính quy mô học phí toàn khóa.",
      "Lộ trình từng buổi là thứ giáo viên nhìn về sau để biết hôm nay dạy gì, dùng gì, dặn gì.",
      "Ngày kết thúc dự kiến là mốc vận hành, còn thực tế có thể thay đổi nếu có nghỉ lễ, buổi bù hoặc dời lịch.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ gặp",
    items: [
      "Sửa tổng số buổi nhưng quên rà lại khối roadmap theo buổi.",
      "Dùng form này để xử lý vấn đề attendance/buổi lẻ sẽ làm lệch khung lớp gốc.",
      "Đổi học phí mà không thống nhất lại với đội vận hành học phí sẽ dễ gây hiểu nhầm về sau.",
    ],
    tone: "warning" as const,
  },
];

export default function ClassEditForm({
  cls,
  courses,
  triggerClassName,
  triggerLabel = "Sửa thông tin lớp",
  renderSummary = true,
  classOptions = [],
  onSuccess,
}: {
  cls: ClassProfile;
  courses: Course[];
  classOptions?: ClassOption[];
  triggerClassName?: string;
  triggerLabel?: string;
  renderSummary?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Gợi ý autocomplete cho "Nhóm lớp" — chọn lại đúng ngăn cũ hoặc gõ tên ngăn mới nếu
  // chưa có, tránh gõ lệch chính tả sinh ra ngăn trùng nghĩa.
  const [classGroupOptions, setClassGroupOptions] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    fetch("/api/classes/class-groups")
      .then((res) => res.json())
      .then((data) => setClassGroupOptions(data.items ?? []))
      .catch(() => {});
  }, [open]);
  const [form, setForm] = useState({
    className: cls.className,
    classGroup: cls.classGroup ?? "",
    courseId: cls.courseId ?? "",
    tuitionPerSession: cls.tuitionPerSession?.toString() ?? "",
    sessionsPerWeek: cls.sessionsPerWeek?.toString() ?? "",
    totalSessions: cls.totalSessions?.toString() ?? "",
    startDate: toDateInput(cls.startDate),
    expectedEndDate: toDateInput(cls.expectedEndDate),
    nextClassId: cls.nextClassId ?? "",
    notes: cls.notes ?? "",
  });
  const totalSessions = form.totalSessions === "" ? 0 : Number(form.totalSessions);
  // Khung lộ trình dùng chung với form Tạo lớp — xem components/classes/ClassRoadmapEditor.tsx.
  const {
    setRoadmapItems,
    roadmapItemsInRange,
    hiddenAuthoredCount: hiddenAuthoredRoadmapCount,
  } = useRoadmapDrafts(cls.roadmapItems ?? [], totalSessions);

  // Ngày thật của từng buổi (buổi đã sinh lịch) + ngày dự kiến theo lịch cố định cho các buổi
  // chưa sinh, và số buổi đã dạy để khóa vị trí — xem app/api/classes/[id]/roadmap-dates.
  const [sessionDates, setSessionDates] = useState<Record<number, RoadmapSessionDate>>({});
  const [taughtCount, setTaughtCount] = useState(0);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/classes/${cls.id}/roadmap-dates?total=${totalSessions}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const map: Record<number, RoadmapSessionDate> = {};
        for (const item of data.dates ?? []) map[item.sessionNumber] = { date: item.date, status: item.status };
        setSessionDates(map);
        setTaughtCount(Number(data.taughtCount) || 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, cls.id, totalSessions]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/classes/${cls.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        roadmapItems: roadmapItemsInRange.map((item) => ({
          sessionNumber: item.sessionNumber,
          title: item.title,
          objective: item.objective,
          materials: item.materials,
          teacherGuide: item.teacherGuide,
          homeworkGuide: item.homeworkGuide,
          teacherRequirement: item.teacherRequirement,
        })),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không lưu được thông tin lớp.");
      return;
    }

    setOpen(false);
    router.refresh();
    onSuccess?.();
  }

  const course = courses.find((item) => item.id === cls.courseId);

  return (
    <>
      {renderSummary ? (
      <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0f1729]">Thông tin lớp học</h2>
            <p className="mt-1 text-sm text-[#64748b]">Tóm tắt khóa học, học phí, tiến độ và ghi chú vận hành của lớp.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#0f1729] shadow-sm transition-all hover:border-[#0f1729] hover:text-[#0f1729]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Sửa thông tin lớp
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Nhóm lớp</p>
            <p className="font-semibold text-[#0f1729]">{cls.classGroup ?? "Chưa khai báo"}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Khóa học</p>
            <p className="font-semibold text-[#0f1729]">{course ? `[${course.code}] ${course.name}` : "Chưa gắn"}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Học phí / buổi</p>
            <p className="font-semibold text-[#0f1729]">{formatVnd(cls.tuitionPerSession)}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Số buổi / tuần</p>
            <p className="font-semibold text-[#0f1729]">{cls.sessionsPerWeek ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Tổng số buổi</p>
            <p className="font-semibold text-[#0f1729]">{cls.totalSessions ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Ghi chú</p>
            <p className="font-semibold text-[#0f1729]">{cls.notes ?? "Chưa có ghi chú"}</p>
          </div>
        </div>
      </div>
      ) : null}

      {!renderSummary ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={triggerClassName ?? "inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#0f1729] shadow-sm transition-all hover:border-[#0f1729] hover:text-[#0f1729]"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          {triggerLabel}
        </button>
      ) : null}

      <ResponsiveDrawer 
        widthClassName="max-w-5xl"
        open={open}
        onClose={() => setOpen(false)}
        title="Sửa thông tin lớp học"
        description="Cập nhật khóa học, học phí, số buổi, lộ trình từng buổi và ghi chú vận hành của lớp."
        guide={<FormGuide title="Hướng dẫn sửa lớp học" summary="Đây là form chỉnh cấu trúc lõi của lớp. Người vận hành nên rà kỹ học phí, số buổi và lộ trình từng buổi trước khi lưu để tránh ảnh hưởng dây chuyền." sections={CLASS_EDIT_GUIDE_SECTIONS} position="inline" />}
      >
        <form onSubmit={save} className="space-y-6">
          <label className="form-group">
            <span className="label">Tên lớp</span>
            <input required className="input" value={form.className} onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))} />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group">
              <span className="label">Nhóm lớp</span>
              <input
                className="input"
                list="class-group-options"
                placeholder="Chọn ngăn có sẵn hoặc gõ tên ngăn mới..."
                value={form.classGroup}
                onChange={(event) => setForm((current) => ({ ...current, classGroup: event.target.value }))}
              />
              <datalist id="class-group-options">
                {classGroupOptions.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
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
              <CurrencyInput value={form.tuitionPerSession} onChange={(next) => setForm((current) => ({ ...current, tuitionPerSession: String(next) }))} />
              <p className="form-hint">{form.tuitionPerSession ? formatVnd(Number(form.tuitionPerSession) || 0) : ""}</p>
            </label>

            <label className="form-group">
              <span className="label">Số buổi / tuần</span>
              <input type="number" min={1} max={7} className="input" value={form.sessionsPerWeek} onChange={(event) => setForm((current) => ({ ...current, sessionsPerWeek: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Tổng số buổi</span>
              <input type="number" min={1} className="input" value={form.totalSessions} onChange={(event) => setForm((current) => ({ ...current, totalSessions: event.target.value }))} />
              {hiddenAuthoredRoadmapCount > 0 ? (
                <p className="form-hint text-amber-700">
                  Đang giảm số buổi: nội dung lộ trình đã soạn cho {hiddenAuthoredRoadmapCount} buổi cuối sẽ tạm ẩn và không được lưu — tăng số buổi trở lại để khôi phục.
                </p>
              ) : null}
            </label>

            <label className="form-group">
              <span className="label">Ngày khai giảng</span>
              <input type="date" className="input" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
            </label>

            <label className="form-group md:col-span-2">
              <span className="label">Ngày dự kiến kết thúc</span>
              <input type="date" className="input" value={form.expectedEndDate} onChange={(event) => setForm((current) => ({ ...current, expectedEndDate: event.target.value }))} />
            </label>

            <label className="form-group md:col-span-2">
              <span className="label">Lớp tiếp theo (không bắt buộc)</span>
              <select className="input" value={form.nextClassId} onChange={(event) => setForm((current) => ({ ...current, nextClassId: event.target.value }))}>
                <option value="">Chưa cấu hình</option>
                {classOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.classCode} - {item.className}
                  </option>
                ))}
              </select>
              <p className="form-hint">Học viên học hết lớp này mà chưa đủ số buổi sẽ được đề xuất chuyển sang lớp đã chọn ở đây.</p>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[#e5eaf7] bg-[#fbfdff] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#64748b]">Mã lớp</p>
              <p className="mt-2 text-base font-semibold text-[#0f1729]">{cls.classCode}</p>
            </div>
            <div className="rounded-2xl border border-[#e5eaf7] bg-[#fbfdff] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#64748b]">Số buổi lộ trình đang lưu</p>
              <p className="mt-2 text-base font-semibold text-[#0f1729]">{roadmapItemsInRange.length}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-[24px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
            <div>
              <p className="text-sm font-semibold text-[#0f1729]">Tài liệu học tập theo từng buổi</p>
              <p className="mt-1 text-xs text-[#64748b]">Sao chép từ lớp đã có, nạp file Excel, hoặc sửa trực tiếp từng buổi.</p>
            </div>
            <ClassRoadmapEditor
              items={roadmapItemsInRange}
              setItems={setRoadmapItems}
              totalSessions={totalSessions}
              classCode={cls.classCode}
              courseId={form.courseId || null}
              excludeClassId={cls.id}
              sessionDates={sessionDates}
              taughtCount={taughtCount}
              onTotalSessionsChange={(next) => setForm((current) => ({ ...current, totalSessions: String(next) }))}
            />
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
      </ResponsiveDrawer>
    </>
  );
}
