"use client";

import { useEffect, useMemo, useState } from "react";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { useClassDrawer } from "@/contexts/ClassDrawerContext";
import { formatVnd as formatVndBase } from "@/lib/export-utils";

// CỐ TÌNH chỉ giữ đúng những gì cần để tính ra học phí + lịch (mã/tên lớp, khóa
// học, học phí/buổi, tổng số buổi, ngày khai giảng, lịch cố định) — lộ trình từng
// buổi và nhân sự mặc định bỏ khỏi form tạo lớp, cấu hình sau ở "Sửa lớp"/"Cấu
// hình" trong chi tiết lớp (API vẫn nhận roadmapItems/defaultAssignments rỗng
// bình thường — server tự sinh khung lộ trình rỗng cho lớp không phải bổ trợ).

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
  });
  const [classGroupOptions, setClassGroupOptions] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    fetch("/api/classes/class-groups")
      .then((res) => res.json())
      .then((data) => setClassGroupOptions(data.items ?? []))
      .catch(() => {});
  }, [open]);
  const [scheduleRules, setScheduleRules] = useState<ScheduleRuleDraft[]>([buildEmptyRule()]);

  const tuitionPerSession = form.tuitionPerSession === "" ? null : Number(form.tuitionPerSession);
  const totalSessions = form.totalSessions === "" ? null : Number(form.totalSessions);
  const sessionsPerWeek = scheduleRules.length;
  const normalizedStartDate = useMemo(() => parseYmdToUtc(form.startDate), [form.startDate]);
  const estimatedEndDate = useMemo(
    () => estimateEndDateFromRules(normalizedStartDate, totalSessions, scheduleRules, holidayDateSet),
    [normalizedStartDate, totalSessions, scheduleRules, holidayDateSet],
  );
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
    });
    setScheduleRules([buildEmptyRule()]);
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
        sessionsPerWeek,
        notes: form.notes.trim() || null,
        scheduleRules: scheduleRules.map((rule) => ({
          weekday: Number(rule.weekday),
          startTime: rule.startTime,
          endTime: rule.endTime,
          room: rule.room.trim() || null,
        })),
        roadmapItems: [],
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
              <input
                className="input"
                list="class-group-options"
                value={form.classGroup}
                onChange={(event) => patchForm("classGroup", event.target.value)}
                placeholder="Chọn ngăn có sẵn hoặc gõ tên mới..."
              />
              <datalist id="class-group-options">
                {classGroupOptions.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
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
