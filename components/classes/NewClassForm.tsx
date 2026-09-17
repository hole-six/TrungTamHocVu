"use client";

import { useEffect, useMemo, useState } from "react";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import CurrencyInput from "@/components/ui/CurrencyInput";
import PickOrCreateSelect from "@/components/ui/PickOrCreateSelect";
import { useClassDrawer } from "@/contexts/ClassDrawerContext";
import { formatVnd as formatVndBase } from "@/lib/export-utils";
import ClassRoadmapEditor, { isAuthoredRoadmapDraft, useRoadmapDrafts, type RoadmapSessionDate } from "@/components/classes/ClassRoadmapEditor";

// Form tạo lớp giữ phần BẮT BUỘC gọn (mã/tên lớp, khóa học, học phí/buổi, tổng số buổi,
// ngày khai giảng, lịch cố định). Tài liệu học tập theo từng buổi là mục MỞ RỘNG không
// bắt buộc ngay trong form: trước đây phải tạo lớp xong, đóng form, mở lại "Sửa lớp" mới
// soạn được giáo án — hai bước cho một việc. Bỏ trống thì server tự sinh khung rỗng như
// cũ. Nhân sự mặc định vẫn cấu hình sau trong chi tiết lớp.

type Course = {
  id: string;
  code: string;
  name: string;
  tuitionPerSession: number;
  sessionsPerWeek: number;
};

type ClassOption = {
  id: string;
  classCode: string;
  className: string;
};

type ScheduleRuleDraft = {
  weekday: string;
  startTime: string;
  endTime: string;
  room: string;
};

const WEEKDAY_OPTIONS = [
  { value: "1", label: "Thứ 2" },
  { value: "2", label: "Thứ 3" },
  { value: "3", label: "Thứ 4" },
  { value: "4", label: "Thứ 5" },
  { value: "5", label: "Thứ 6" },
  { value: "6", label: "Thứ 7" },
  { value: "0", label: "Chủ nhật" },
];

function formatVnd(amount: number | null) {
  return amount == null || Number.isNaN(amount) ? "—" : formatVndBase(amount);
}

function weekdayLabel(value: string) {
  return WEEKDAY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function buildEmptyRule(): ScheduleRuleDraft {
  return { weekday: "1", startTime: "", endTime: "", room: "" };
}

function parseYmdToUtc(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateLabel(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Ngày học của từng buổi theo lịch cố định, bỏ ngày nghỉ trung tâm — cùng cách đếm với
// estimateEndDateFromRules bên dưới. Dùng để khung lộ trình hiện "Buổi 12 · T3 14/10" ngay
// lúc tạo lớp, chèn buổi ôn thi vào đúng tuần mong muốn mà không phải lưu rồi mở lại.
function listSessionDatesFromRules(
  startDate: Date | null,
  count: number,
  rules: ScheduleRuleDraft[],
  holidayDates: Set<string>,
): Record<number, RoadmapSessionDate> {
  const result: Record<number, RoadmapSessionDate> = {};
  const validRules = rules.filter((rule) => rule.startTime && Number.isInteger(Number(rule.weekday)));
  if (!startDate || count <= 0 || validRules.length === 0) return result;
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  let counted = 0;
  let guard = 0;
  while (counted < count && guard < 3660) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!holidayDates.has(iso)) {
      for (const _rule of validRules.filter((rule) => Number(rule.weekday) === cursor.getUTCDay())) {
        counted += 1;
        result[counted] = { date: iso, status: "PROJECTED" };
        if (counted >= count) break;
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return result;
}

function estimateEndDateFromRules(
  startDate: Date | null,
  totalSessions: number | null,
  rules: ScheduleRuleDraft[],
  holidayDates: Set<string> = new Set(),
) {
  if (!startDate || !totalSessions || totalSessions <= 0 || rules.length === 0) return null;

  const normalizedRules = rules
    .filter((rule) => {
      const weekday = Number(rule.weekday);
      return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6;
    })
    .slice()
    .sort((a, b) => Number(a.weekday) - Number(b.weekday) || a.startTime.localeCompare(b.startTime));

  if (normalizedRules.length === 0) return null;

  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  let countedSessions = 0;
  let guard = 0;

  while (guard < 3660) {
    if (!holidayDates.has(cursor.toISOString().slice(0, 10))) {
      const todayRules = normalizedRules.filter((rule) => Number(rule.weekday) === cursor.getUTCDay());
      for (const _rule of todayRules) {
        countedSessions += 1;
        if (countedSessions === totalSessions) return new Date(cursor);
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return null;
}

export default function NewClassForm({
  courses,
  holidayDates = [],
  classOptions = [],
  triggerDataTour,
}: {
  courses: Course[];
  holidayDates?: string[];
  classOptions?: ClassOption[];
  triggerDataTour?: string;
}) {
  const { openDrawer } = useClassDrawer();
  const holidayDateSet = useMemo(() => new Set(holidayDates), [holidayDates]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    classCode: "",
    className: "",
    classGroup: "",
    courseId: "",
    tuitionPerSession: "",
    totalSessions: "",
    nextClassId: "",
    startDate: "",
    notes: "",
    isRemedial: false,
    // Không bắt buộc: chiết khấu áp cho CẢ LỚP, mọi học viên ghi danh lấy làm mặc định.
    discountPercent: "",
  });
  // Không bắt buộc: sách kèm theo của lớp. Có gắn thì học viên vào lớp tự có yêu cầu
  // mua sách và tiền sách vào luôn phiếu học phí, khỏi phải nhập tay từng em.
  const [bookOptions, setBookOptions] = useState<{ id: string; name: string; unitPrice: number }[]>([]);
  const [classBooks, setClassBooks] = useState<{ bookId: string; quantity: number }[]>([]);
  const [classGroupOptions, setClassGroupOptions] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    fetch("/api/classes/class-groups")
      .then((res) => res.json())
      .then((data) => setClassGroupOptions(data.items ?? []))
      .catch(() => {});
    fetch("/api/books")
      .then((res) => res.json())
      .then((data) => setBookOptions(data.items ?? []))
      .catch(() => {});
  }, [open]);
  const [scheduleRules, setScheduleRules] = useState<ScheduleRuleDraft[]>([buildEmptyRule()]);
  const [showRoadmap, setShowRoadmap] = useState(false);

  const tuitionPerSession = form.tuitionPerSession === "" ? null : Number(form.tuitionPerSession);
  const totalSessions = form.totalSessions === "" ? null : Number(form.totalSessions);
  const { setRoadmapItems, roadmapItemsInRange } = useRoadmapDrafts([], totalSessions ?? 0);
  const authoredRoadmapCount = roadmapItemsInRange.filter(isAuthoredRoadmapDraft).length;
  // Tính dư 20 buổi để mục vừa chèn thêm cũng có ngày ngay.
  const roadmapSessionDates = useMemo(
    () => listSessionDatesFromRules(parseYmdToUtc(form.startDate), (totalSessions ?? 0) + 20, scheduleRules, holidayDateSet),
    [form.startDate, totalSessions, scheduleRules, holidayDateSet],
  );
  const sessionsPerWeek = scheduleRules.length;
  const normalizedStartDate = useMemo(() => parseYmdToUtc(form.startDate), [form.startDate]);
  const estimatedEndDate = useMemo(
    () => estimateEndDateFromRules(normalizedStartDate, totalSessions, scheduleRules, holidayDateSet),
    [normalizedStartDate, totalSessions, scheduleRules, holidayDateSet],
  );
  const discountPercent = form.discountPercent === "" ? 0 : Math.min(100, Math.max(0, Number(form.discountPercent) || 0));
  const tuitionAfterDiscount =
    tuitionPerSession != null && tuitionPerSession >= 0 ? Math.round(tuitionPerSession * (1 - discountPercent / 100)) : null;
  const classBooksTotal = classBooks.reduce((sum, item) => {
    const book = bookOptions.find((option) => option.id === item.bookId);
    return sum + (book ? book.unitPrice * item.quantity : 0);
  }, 0);

  const estimatedCourseTuition =
    tuitionPerSession != null && totalSessions != null && tuitionPerSession >= 0 && totalSessions >= 0
      ? tuitionPerSession * totalSessions
      : null;

  function patchForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function patchRule(index: number, key: keyof ScheduleRuleDraft, value: string) {
    setScheduleRules((prev) => prev.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, [key]: value } : rule)));
    setError(null);
  }

  function addRule() {
    setScheduleRules((prev) => [...prev, buildEmptyRule()]);
  }

  function removeRule(index: number) {
    setScheduleRules((prev) => (prev.length === 1 ? prev : prev.filter((_, ruleIndex) => ruleIndex !== index)));
  }

  function applyCourseTemplate(courseId: string) {
    const selected = courses.find((course) => course.id === courseId);
    if (!selected) {
      patchForm("courseId", courseId);
      return;
    }
    setForm((prev) => ({ ...prev, courseId, tuitionPerSession: String(selected.tuitionPerSession) }));
  }

  function validate() {
    if (!form.classCode.trim() || !form.className.trim()) return "Mã lớp và tên lớp là bắt buộc.";
    if (!form.startDate) return "Ngày khai giảng là bắt buộc.";
    if (!form.isRemedial) {
      if (!form.totalSessions || Number(form.totalSessions) <= 0) return "Cần nhập tổng số buổi hợp lệ.";
      if (!form.tuitionPerSession || Number(form.tuitionPerSession) < 0) return "Cần nhập học phí trên mỗi buổi.";
    }
    for (const [index, rule] of scheduleRules.entries()) {
      if (!rule.startTime || !rule.endTime) return `Buổi cố định ${index + 1} đang thiếu giờ.`;
      if (rule.startTime >= rule.endTime) return `Buổi cố định ${index + 1} có giờ kết thúc phải sau giờ bắt đầu.`;
    }
    const seen = new Set<string>();
    for (const [index, rule] of scheduleRules.entries()) {
      const key = `${rule.weekday}-${rule.startTime}-${rule.endTime}`;
      if (seen.has(key)) return `Buổi cố định ${index + 1} đang trùng thứ và khung giờ với một buổi khác.`;
      seen.add(key);
    }
    return null;
  }

  function reset() {
    setForm({
      classCode: "",
      className: "",
      classGroup: "",
      courseId: "",
      tuitionPerSession: "",
      totalSessions: "",
      nextClassId: "",
      startDate: "",
      notes: "",
      isRemedial: false,
      discountPercent: "",
    });
    setClassBooks([]);
    setScheduleRules([buildEmptyRule()]);
    setRoadmapItems([]);
    setShowRoadmap(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextError = validate();
    if (nextError) {
      setError(nextError);
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        classCode: form.classCode.trim(),
        className: form.className.trim(),
        classGroup: form.classGroup.trim() || null,
        isRemedial: form.isRemedial,
        courseId: form.isRemedial ? null : form.courseId || null,
        totalSessions: form.totalSessions ? Number(form.totalSessions) : null,
        nextClassId: form.isRemedial ? null : form.nextClassId || null,
        startDate: form.startDate || null,
        tuitionPerSession: form.isRemedial ? null : Number(form.tuitionPerSession),
        discountPercent: form.isRemedial ? 0 : discountPercent,
        books: form.isRemedial ? [] : classBooks.filter((item) => item.bookId),
        sessionsPerWeek,
        notes: form.notes.trim() || null,
        scheduleRules: scheduleRules.map((rule) => ({
          weekday: Number(rule.weekday),
          startTime: rule.startTime,
          endTime: rule.endTime,
          room: rule.room.trim() || null,
        })),
        // Chỉ gửi những buổi ĐÃ SOẠN nội dung — các buổi còn lại server tự sinh khung
        // rỗng "Buổi N" (ensureClassRoadmapItems), khỏi gửi vài chục dòng trống.
        roadmapItems: form.isRemedial
          ? []
          : roadmapItemsInRange.filter(isAuthoredRoadmapDraft).map((item) => ({
              sessionNumber: item.sessionNumber,
              title: item.title,
              objective: item.objective,
              materials: item.materials,
              teacherGuide: item.teacherGuide,
              homeworkGuide: item.homeworkGuide,
              teacherRequirement: item.teacherRequirement,
            })),
        defaultAssignments: [],
      };

      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Không thể tạo lớp học.");

      setOpen(false);
      reset();
      openDrawer(result.item.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể tạo lớp học.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5"
        data-tour={triggerDataTour}
      >
        <span className="hidden sm:inline">+ Thêm lớp học</span>
        <span className="sm:hidden">+ Lớp</span>
      </button>

      <ResponsiveDrawer widthClassName="max-w-3xl" open={open} onClose={() => setOpen(false)} title="Thêm lớp học">
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="mt-0.5 flex items-start gap-3 rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
            <input type="checkbox" className="mt-0.5" checked={form.isRemedial} onChange={(event) => patchForm("isRemedial", event.target.checked)} />
            <span className="text-sm font-medium text-ink">Đây là lớp bổ trợ (không thu học phí riêng)</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {!form.isRemedial ? (
              <label className="form-group sm:col-span-2">
                <span className="label">Khóa học chuẩn</span>
                <select className="input" value={form.courseId} onChange={(event) => applyCourseTemplate(event.target.value)}>
                  <option value="">-- Nhập tay / chưa gắn khóa --</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      [{course.code}] {course.name} · {formatVnd(course.tuitionPerSession)}/buổi
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="form-group">
              <span className="label">Mã lớp *</span>
              <input required className="input" value={form.classCode} onChange={(event) => patchForm("classCode", event.target.value)} placeholder="VD: CAM-A1-T2T4" />
            </label>
            <label className="form-group">
              <span className="label">Tên lớp *</span>
              <input required className="input" value={form.className} onChange={(event) => patchForm("className", event.target.value)} placeholder="VD: Cambridge A1" />
            </label>
            <label className="form-group">
              <span className="label">Nhóm lớp</span>
              {/* Trước đây là <input list=...> + <datalist>: trình duyệt chỉ gợi ý sau
                  khi đã gõ và không có nút sổ, nên nhìn vào không biết trung tâm đang
                  có sẵn những nhóm nào. Giờ sổ thẳng danh sách nhóm đã có, vẫn thêm
                  được nhóm mới qua lựa chọn cuối. */}
              <PickOrCreateSelect
                value={form.classGroup}
                onChange={(next) => patchForm("classGroup", next)}
                options={classGroupOptions}
                emptyLabel="Chưa xếp nhóm"
                createLabel="+ Nhóm lớp mới..."
                createPlaceholder="Nhập tên nhóm lớp mới"
              />
            </label>
            <label className="form-group">
              <span className="label">Ngày khai giảng *</span>
              <input required type="date" className="input" value={form.startDate} onChange={(event) => patchForm("startDate", event.target.value)} />
            </label>
            {!form.isRemedial ? (
              <label className="form-group">
                <span className="label">Học phí / buổi *</span>
                <CurrencyInput value={form.tuitionPerSession} onChange={(next) => patchForm("tuitionPerSession", String(next))} placeholder="100000" />
              </label>
            ) : null}
            <label className="form-group">
              <span className="label">Tổng số buổi{form.isRemedial ? "" : " *"}</span>
              <input type="number" min={1} className="input" value={form.totalSessions} onChange={(event) => patchForm("totalSessions", event.target.value)} placeholder="50" />
            </label>
            {!form.isRemedial ? (
              <label className="form-group">
                <span className="label">Chiết khấu cả lớp % (không bắt buộc)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  className="input"
                  value={form.discountPercent}
                  onChange={(event) => patchForm("discountPercent", event.target.value)}
                  placeholder="0"
                />
                <span className="mt-1 text-[11px] text-ink-muted48">
                  {discountPercent > 0 && tuitionAfterDiscount != null
                    ? `Học phí thực thu: ${tuitionAfterDiscount.toLocaleString("vi-VN")}đ/buổi (gốc ${(tuitionPerSession ?? 0).toLocaleString("vi-VN")}đ). Mọi học viên ghi danh vào lớp lấy mức này làm mặc định, vẫn sửa riêng được.`
                    : "Để trống nếu lớp không có chiết khấu."}
                </span>
              </label>
            ) : null}
            {!form.isRemedial ? (
              <label className="form-group sm:col-span-2">
                <span className="label">Lớp tiếp theo (không bắt buộc)</span>
                <select className="input" value={form.nextClassId} onChange={(event) => patchForm("nextClassId", event.target.value)}>
                  <option value="">Chưa cấu hình</option>
                  {classOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.classCode} - {item.className}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {!form.isRemedial ? (
            <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold text-ink">Sách kèm theo (không bắt buộc)</span>
                  <p className="mt-0.5 text-[11px] text-ink-muted48">
                    Học viên ghi danh vào lớp sẽ tự có yêu cầu mua các cuốn này, tiền sách vào luôn phiếu học phí. Em nào chuyển lớp thì gỡ sách ra được ở hồ sơ học viên.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setClassBooks((prev) => [...prev, { bookId: "", quantity: 1 }])}
                  className="btn-ghost-sm"
                >
                  + Thêm sách
                </button>
              </div>
              {classBooks.length === 0 ? (
                <p className="mt-3 text-xs text-ink-muted48">Lớp này chưa gắn sách nào.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {classBooks.map((item, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <select
                        className="input h-9 flex-1 min-w-[200px]"
                        value={item.bookId}
                        onChange={(event) =>
                          setClassBooks((prev) => prev.map((row, i) => (i === index ? { ...row, bookId: event.target.value } : row)))
                        }
                      >
                        <option value="">— chọn sách —</option>
                        {bookOptions.map((book) => (
                          <option key={book.id} value={book.id}>
                            {book.name} · {book.unitPrice.toLocaleString("vi-VN")}đ
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        className="input h-9 w-20"
                        value={item.quantity}
                        onChange={(event) =>
                          setClassBooks((prev) =>
                            prev.map((row, i) => (i === index ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) } : row)),
                          )
                        }
                      />
                      <button type="button" onClick={() => setClassBooks((prev) => prev.filter((_, i) => i !== index))} className="btn-ghost-sm">
                        Bỏ
                      </button>
                    </div>
                  ))}
                  {classBooksTotal > 0 ? (
                    <p className="text-xs font-semibold text-ink-muted80">
                      Tiền sách mỗi học viên: {classBooksTotal.toLocaleString("vi-VN")}đ
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">Lịch học cố định</span>
              <button type="button" onClick={addRule} className="btn-ghost-sm">
                + Thêm buổi
              </button>
            </div>
            <div className="mt-3 divide-y divide-[#f1f5f9]">
              {scheduleRules.map((rule, index) => (
                <div key={index} className="grid grid-cols-2 gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-4">
                  <label className="form-group">
                    <span className="label-sm">Thứ</span>
                    <select className="input" value={rule.weekday} onChange={(event) => patchRule(index, "weekday", event.target.value)}>
                      {WEEKDAY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-group">
                    <span className="label-sm">Bắt đầu</span>
                    <input type="time" className="input" value={rule.startTime} onChange={(event) => patchRule(index, "startTime", event.target.value)} />
                  </label>
                  <label className="form-group">
                    <span className="label-sm">Kết thúc</span>
                    <input type="time" className="input" value={rule.endTime} onChange={(event) => patchRule(index, "endTime", event.target.value)} />
                  </label>
                  <div className="flex items-end gap-2">
                    <label className="form-group flex-1">
                      <span className="label-sm">Phòng</span>
                      <input className="input" value={rule.room} onChange={(event) => patchRule(index, "room", event.target.value)} placeholder="P.102" />
                    </label>
                    <button type="button" onClick={() => removeRule(index)} disabled={scheduleRules.length === 1} className="btn-ghost-sm text-rose-600 disabled:opacity-40">
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!form.isRemedial ? (
            <div className="rounded-xl border border-[#dbe7ff] bg-[#f8fbff] p-4">
              <button
                type="button"
                onClick={() => setShowRoadmap((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={showRoadmap}
              >
                <span>
                  <span className="block text-sm font-semibold text-ink">Tài liệu học tập theo từng buổi (không bắt buộc)</span>
                  <span className="mt-0.5 block text-xs text-[#64748b]">
                    {authoredRoadmapCount > 0
                      ? `Đã soạn ${authoredRoadmapCount}/${roadmapItemsInRange.length} buổi — sẽ lưu cùng lúc tạo lớp.`
                      : "Sao chép từ lớp cùng khóa, nạp file Excel, hoặc để trống và soạn sau."}
                  </span>
                </span>
                <span className="btn-ghost-sm whitespace-nowrap">{showRoadmap ? "Thu gọn" : "Mở ra soạn"}</span>
              </button>
              {showRoadmap ? (
                <div className="mt-4 border-t border-[#e5eaf7] pt-4">
                  <ClassRoadmapEditor
                    items={roadmapItemsInRange}
                    setItems={setRoadmapItems}
                    totalSessions={totalSessions ?? 0}
                    classCode={form.classCode}
                    courseId={form.courseId || null}
                    sessionDates={roadmapSessionDates}
                    onTotalSessionsChange={(next) => patchForm("totalSessions", String(next))}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Tạm tính</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[#94a3b8]">Học phí / buổi</p>
                <p className="text-sm font-semibold text-ink">{formatVnd(tuitionPerSession)}</p>
              </div>
              <div>
                <p className="text-xs text-[#94a3b8]">Tổng học phí khóa</p>
                <p className="text-sm font-semibold text-primary">{formatVnd(estimatedCourseTuition)}</p>
              </div>
              <div>
                <p className="text-xs text-[#94a3b8]">Dự kiến kết thúc</p>
                <p className="text-sm font-semibold text-ink">{formatDateLabel(estimatedEndDate)}</p>
              </div>
            </div>
          </div>

          <label className="form-group">
            <span className="label">Ghi chú nội bộ</span>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={(event) => patchForm("notes", event.target.value)} />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Đang tạo..." : "Tạo lớp học"}
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
