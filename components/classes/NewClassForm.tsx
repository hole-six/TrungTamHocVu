"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FormGuide from "@/components/ui/FormGuide";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd as formatVndBase } from "@/lib/export-utils";

type Course = {
  id: string;
  code: string;
  name: string;
  tuitionPerSession: number;
  sessionsPerWeek: number;
};

type Employee = {
  id: string;
  fullName: string;
  shortName: string;
  position: string | null;
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

type RoadmapDraft = {
  sessionNumber: number;
  title: string;
  objective: string;
  materials: string;
  teacherGuide: string;
  homeworkGuide: string;
};

type DefaultAssignmentDraft = {
  key: string;
  roleType: "TEACHER" | "ASSISTANT";
  employeeId: string;
  notes: string;
};

const DEFAULT_ASSIGNMENT_GROUPS = [
  { roleType: "TEACHER" as const, label: "Giáo viên", helper: "Có thể thêm nhiều giáo viên cho lớp" },
  { roleType: "ASSISTANT" as const, label: "Trợ giảng", helper: "Có thể thêm nhiều trợ giảng cho lớp" },
] as const;

const WEEKDAY_OPTIONS = [
  { value: "1", label: "Thứ 2" },
  { value: "2", label: "Thứ 3" },
  { value: "3", label: "Thứ 4" },
  { value: "4", label: "Thứ 5" },
  { value: "5", label: "Thứ 6" },
  { value: "6", label: "Thứ 7" },
  { value: "0", label: "Chủ nhật" },
];

const NEW_CLASS_GUIDE_SECTIONS = [
  {
    title: "Form này dùng để làm gì?",
    items: [
      "Dùng khi trung tâm cần mở một lớp học mới với đầy đủ lịch chuẩn, học phí, lộ trình và nhân sự mặc định.",
      "Dữ liệu tạo ở đây kéo theo buổi học, học phí, giáo trình từng buổi và vận hành lớp về sau.",
      "Người mới nên đi theo thứ tự: chọn khóa học → chốt lịch chuẩn → chốt học phí và số buổi → chuẩn bị lộ trình từng buổi.",
    ],
    tone: "info" as const,
  },
  {
    title: "Các phần cần hiểu rõ",
    items: [
      "Lịch chuẩn là khung sinh ra các buổi học ban đầu của lớp.",
      "Học phí / buổi × tổng số buổi là cơ sở ước tính toàn khóa.",
      "Tài liệu học tập theo từng buổi sẽ đi xuống phần giáo viên và nhật ký lớp về sau.",
      "Nhân sự mặc định giúp phân công giáo viên/trợ giảng nhanh hơn khi lớp bắt đầu chạy.",
    ],
    tone: "success" as const,
  },
  {
    title: "Những lỗi phải tránh",
    items: [
      "Tạo lớp khi lịch chuẩn chưa rõ sẽ làm buổi học sinh ra bị sai từ đầu.",
      "Nhập sai tổng số buổi sẽ kéo lệch roadmap và tính toán học phí.",
      "Gộp chuyện dời buổi/học bù vào lịch chuẩn ngay lúc tạo lớp sẽ làm khung lớp rất khó vận hành.",
    ],
    tone: "warning" as const,
  },
];

function formatVnd(amount: number | null) {
  return amount == null || Number.isNaN(amount) ? "—" : formatVndBase(amount);
}

function weekdayLabel(value: string) {
  return WEEKDAY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function buildEmptyRule(): ScheduleRuleDraft {
  return {
    weekday: "1",
    startTime: "",
    endTime: "",
    room: "",
  };
}

function buildRoadmapDraft(sessionNumber: number): RoadmapDraft {
  return {
    sessionNumber,
    title: `Buổi ${sessionNumber}`,
    objective: "",
    materials: "",
    teacherGuide: "",
    homeworkGuide: "",
  };
}

function buildAssignmentDraft(roleType: "TEACHER" | "ASSISTANT", seed = Math.random().toString(36).slice(2)): DefaultAssignmentDraft {
  return {
    key: `${roleType}-${seed}`,
    roleType,
    employeeId: "",
    notes: "",
  };
}

function normalizeAssignmentRole(roleType: "TEACHER" | "ASSISTANT", index: number) {
  return roleType === "TEACHER" ? `TEACHER_${index + 1}` : `ASSISTANT_${index + 1}`;
}

function computeDurationLabel(startTime: string, endTime: string) {
  if (!startTime || !endTime) return "Chưa đủ giờ";
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  if (Number.isNaN(startTotal) || Number.isNaN(endTotal) || endTotal <= startTotal) return "Giờ chưa hợp lệ";
  const minutes = endTotal - startTotal;
  const hourPart = Math.floor(minutes / 60);
  const minutePart = minutes % 60;
  if (minutePart === 0) return `${hourPart} giờ`;
  return `${hourPart} giờ ${minutePart} phút`;
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
  holidayDates: Set<string> = new Set()
) {
  if (!startDate || !totalSessions || totalSessions <= 0 || rules.length === 0) return null;

  const normalizedRules = rules
    .filter((rule) => {
      const weekday = Number(rule.weekday);
      return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6;
    })
    .slice()
    .sort((a, b) => {
      const weekdayDiff = Number(a.weekday) - Number(b.weekday);
      if (weekdayDiff !== 0) return weekdayDiff;
      return a.startTime.localeCompare(b.startTime);
    });

  if (normalizedRules.length === 0) return null;

  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  let countedSessions = 0;
  let guard = 0;

  while (guard < 3660) {
    if (!holidayDates.has(cursor.toISOString().slice(0, 10))) {
      const todayRules = normalizedRules.filter((rule) => Number(rule.weekday) === cursor.getUTCDay());
      for (const _rule of todayRules) {
        countedSessions += 1;
        if (countedSessions === totalSessions) {
          return new Date(cursor);
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }

  return null;
}

function computeStudySpanLabel(startDate: Date | null, endDate: Date | null) {
  if (!startDate || !endDate) return "—";
  const dayDiff = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
  const weeks = Math.floor(dayDiff / 7);
  const days = dayDiff % 7;
  if (weeks === 0) return `${days + 1} ngày lịch`;
  if (days === 0) return `${weeks + 1} tuần lịch`;
  return `${weeks} tuần ${days} ngày`;
}

export default function NewClassForm({
  courses,
  employees,
  holidayDates = [],
  classOptions = [],
}: {
  courses: Course[];
  employees: Employee[];
  holidayDates?: string[];
  classOptions?: ClassOption[];
}) {
  const router = useRouter();
  const holidayDateSet = useMemo(() => new Set(holidayDates), [holidayDates]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
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
  const [scheduleRules, setScheduleRules] = useState<ScheduleRuleDraft[]>([buildEmptyRule()]);
  const [roadmapItems, setRoadmapItems] = useState<RoadmapDraft[]>([]);
  const [visibleRoadmapCount, setVisibleRoadmapCount] = useState(12);
  const [defaultAssignments, setDefaultAssignments] = useState<DefaultAssignmentDraft[]>([
    buildAssignmentDraft("TEACHER"),
    buildAssignmentDraft("ASSISTANT"),
  ]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === form.courseId) ?? null,
    [courses, form.courseId],
  );

  const tuitionPerSession = form.tuitionPerSession === "" ? null : Number(form.tuitionPerSession);
  const totalSessions = form.totalSessions === "" ? null : Number(form.totalSessions);
  const sessionsPerWeek = scheduleRules.length;
  const normalizedStartDate = useMemo(() => parseYmdToUtc(form.startDate), [form.startDate]);
  const estimatedEndDate = useMemo(
    () => estimateEndDateFromRules(normalizedStartDate, totalSessions, scheduleRules, holidayDateSet),
    [normalizedStartDate, totalSessions, scheduleRules, holidayDateSet],
  );
  const estimatedWeeks =
    totalSessions != null && sessionsPerWeek > 0 ? Math.ceil(totalSessions / sessionsPerWeek) : null;
  const estimatedSpanLabel = useMemo(
    () => computeStudySpanLabel(normalizedStartDate, estimatedEndDate),
    [estimatedEndDate, normalizedStartDate],
  );
  const estimatedCourseTuition =
    tuitionPerSession != null && totalSessions != null && tuitionPerSession >= 0 && totalSessions >= 0
      ? tuitionPerSession * totalSessions
      : null;
  const visibleRoadmapItems = roadmapItems.slice(0, visibleRoadmapCount);

  useEffect(() => {
    const normalizedTotal = totalSessions && totalSessions > 0 ? totalSessions : 0;
    setRoadmapItems((prev) => {
      if (normalizedTotal <= 0) return [];
      const next: RoadmapDraft[] = [];
      for (let sessionNumber = 1; sessionNumber <= normalizedTotal; sessionNumber += 1) {
        const existing = prev.find((item) => item.sessionNumber === sessionNumber);
        next.push(existing ?? buildRoadmapDraft(sessionNumber));
      }
      return next;
    });
    setVisibleRoadmapCount((current) => {
      if (normalizedTotal <= 0) return 12;
      return Math.max(12, Math.min(normalizedTotal, current));
    });
  }, [totalSessions]);

  function patchForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function patchRule(index: number, key: keyof ScheduleRuleDraft, value: string) {
    setScheduleRules((prev) => prev.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, [key]: value } : rule)));
    setError(null);
  }

  function patchRoadmap(sessionNumber: number, key: keyof Omit<RoadmapDraft, "sessionNumber">, value: string) {
    setRoadmapItems((prev) =>
      prev.map((item) => (item.sessionNumber === sessionNumber ? { ...item, [key]: value } : item)),
    );
    setError(null);
    setImportSummary(null);
  }

  function patchDefaultAssignment(rowKey: string, key: "employeeId" | "notes", value: string) {
    setDefaultAssignments((prev) => prev.map((item) => (item.key === rowKey ? { ...item, [key]: value } : item)));
    setError(null);
  }

  function addDefaultAssignment(roleType: "TEACHER" | "ASSISTANT") {
    setDefaultAssignments((prev) => [...prev, buildAssignmentDraft(roleType)]);
    setError(null);
  }

  function removeDefaultAssignment(rowKey: string) {
    setDefaultAssignments((prev) => {
      const next = prev.filter((item) => item.key !== rowKey);
      return next.length > 0 ? next : [buildAssignmentDraft("TEACHER"), buildAssignmentDraft("ASSISTANT")];
    });
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
    patchForm("courseId", courseId);
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      courseId,
      tuitionPerSession: String(selected.tuitionPerSession),
    }));
  }

  async function downloadRoadmapTemplate() {
    if (!roadmapItems.length) {
      setError("Cần nhập tổng số buổi trước rồi mới tải được file mẫu lộ trình.");
      return;
    }

    setError(null);
    setImportSummary(null);

    const query = new URLSearchParams({
      totalSessions: String(roadmapItems.length),
      classCode: form.classCode.trim() || "lop-moi",
    });
    const response = await fetch(`/api/classes/roadmap-template?${query.toString()}`);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "Không thể tạo file mẫu Excel.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mau-lo-trinh-${form.classCode.trim() || "lop-moi"}-${roadmapItems.length}-buoi.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setImportSummary("Đã tải file mẫu .xlsx có sẵn cột hướng dẫn, ví dụ và màu nền rõ ràng để điền bằng Excel.");
  }

  async function importRoadmapFile(file: File) {
    if (!roadmapItems.length) {
      setError("Cần nhập tổng số buổi trước rồi mới nhập file lộ trình.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/classes/roadmap-import", {
      method: "POST",
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Không thể đọc file lộ trình đã tải lên.");
      return;
    }

    const importedRows: Array<{
      sessionNumber: number;
      title: string;
      objective: string;
      materials: string;
      teacherGuide: string;
      homeworkGuide: string;
    }> = Array.isArray(result.items) ? result.items : [];

    let mergedCount = 0;
    setRoadmapItems((prev) =>
      prev.map((item) => {
        const imported = importedRows.find((row) => row.sessionNumber === item.sessionNumber);
        if (!imported) return item;
        mergedCount += 1;
        return {
          ...item,
          title: imported.title || item.title,
          objective: imported.objective || item.objective,
          materials: imported.materials || item.materials,
          teacherGuide: imported.teacherGuide || item.teacherGuide,
          homeworkGuide: imported.homeworkGuide || item.homeworkGuide,
        };
      }),
    );

    setError(null);
    setImportSummary(`Đã merge ${mergedCount} buổi từ file "${file.name}" vào chương trình đào tạo hiện tại.`);
  }

  function validate() {
    if (!form.classCode.trim() || !form.className.trim()) {
      return "Mã lớp và tên lớp là bắt buộc.";
    }
    if (!form.isRemedial) {
      if (!form.totalSessions || Number(form.totalSessions) <= 0) {
        return "Cần nhập tổng số buổi hợp lệ.";
      }
      if (!form.tuitionPerSession || Number(form.tuitionPerSession) < 0) {
        return "Cần nhập học phí trên mỗi buổi.";
      }
    }
    if (scheduleRules.length === 0) {
      return "Phải có ít nhất 1 buổi học cố định trong tuần.";
    }
    for (const [index, rule] of scheduleRules.entries()) {
      if (!rule.startTime || !rule.endTime) {
        return `Buổi cố định ${index + 1} đang thiếu giờ bắt đầu hoặc giờ kết thúc.`;
      }
      if (rule.startTime >= rule.endTime) {
        return `Buổi cố định ${index + 1} có giờ kết thúc phải sau giờ bắt đầu.`;
      }
    }
    const duplicateRuleKey = new Set<string>();
    for (const [index, rule] of scheduleRules.entries()) {
      const key = `${rule.weekday}-${rule.startTime}-${rule.endTime}`;
      if (duplicateRuleKey.has(key)) {
        return `Buổi cố định ${index + 1} đang bị trùng thứ và khung giờ với một buổi khác.`;
      }
      duplicateRuleKey.add(key);
    }
    return null;
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
        roadmapItems: form.isRemedial
          ? []
          : roadmapItems.map((item) => ({
              sessionNumber: item.sessionNumber,
              title: item.title.trim(),
              objective: item.objective.trim() || null,
              materials: item.materials.trim() || null,
              teacherGuide: item.teacherGuide.trim() || null,
              homeworkGuide: item.homeworkGuide.trim() || null,
            })),
        defaultAssignments: [
          ...defaultAssignments
            .filter((item) => item.roleType === "TEACHER" && item.employeeId)
            .map((item, index) => ({
              role: normalizeAssignmentRole("TEACHER", index),
              employeeId: item.employeeId || null,
              notes: item.notes.trim() || null,
            })),
          ...defaultAssignments
            .filter((item) => item.roleType === "ASSISTANT" && item.employeeId)
            .map((item, index) => ({
              role: normalizeAssignmentRole("ASSISTANT", index),
              employeeId: item.employeeId || null,
              notes: item.notes.trim() || null,
            })),
        ],
      };

      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "Không thể tạo lớp học.");
      }

      router.push(`/classes/${result.item.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể tạo lớp học.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell mx-auto w-full max-w-[1700px] px-4 pb-10 sm:px-6 2xl:max-w-[1840px]">
      <div className="space-y-5">
        <Link
          href="/classes"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#6b7280] transition-colors hover:text-[#f97316]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại quản lý lớp học
        </Link>

        <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white overflow-hidden">
          <div className="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-lg bg-[#fff7ed] border border-[#fed7aa] px-3 py-1.5">
                <div className="h-2 w-2 rounded-full bg-[#f97316]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#f97316]">
                  Thiết lập lớp mới
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                  Tạo lớp học với lịch rõ ràng
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7280] sm:text-base">
                  Chốt buổi học cố định ngay từ lúc tạo lớp, đồng thời nhập chương trình đào tạo theo từng buổi để giáo viên biết hôm nay dạy gì.
                </p>
                <div className="pt-3">
                  <FormGuide
                    title="Hướng dẫn tạo lớp học mới"
                    summary="Đây là form dài và quan trọng nhất của khu lớp học. Nếu đi đúng thứ tự và hiểu vai trò của từng khối, người mới vẫn có thể tạo lớp rất chắc tay."
                    sections={NEW_CLASS_GUIDE_SECTIONS}
                    position="inline"
                    buttonLabel="Guide tạo lớp"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border-2 border-[#e5e7eb] bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Khóa khả dụng</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">{courses.length}</p>
              </div>
              <div className="rounded-xl border-2 border-[#e5e7eb] bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Buổi/tuần</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">{sessionsPerWeek}</p>
              </div>
              <div className="rounded-xl border-2 border-[#e5e7eb] bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Lộ trình</p>
                <p className="mt-2 text-2xl font-black text-[#111827]">{roadmapItems.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_340px] 2xl:grid-cols-[minmax(0,1.9fr)_360px]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[28px] border border-[#e4ebf8] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_22px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="border-b border-[#e8edf5] px-6 py-5">
                <h2 className="text-sm font-bold text-ink">Thông tin lớp và khóa học</h2>
                <p className="mt-1 text-xs leading-5 text-ink-muted48">Nhận diện lớp rõ ràng để sau này nhìn vào biết học gì, học lúc nào, thu bao nhiêu.</p>
                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.isRemedial}
                    onChange={(event) => patchForm("isRemedial", event.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">Đây là khóa bổ trợ</span>
                    <span className="mt-0.5 block text-xs text-ink-muted48">
                      Không thu học phí riêng, không cần giáo án cố định — dùng để xếp buổi học bù cho học sinh có "buổi dư". Form sẽ rút gọn bớt các mục không cần.
                    </span>
                  </span>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-5 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
                <label className="form-group">
                  <span className="label">Mã lớp *</span>
                  <input className="input" value={form.classCode} onChange={(event) => patchForm("classCode", event.target.value)} placeholder="VD: CAM-A1-T2T4-SANG" />
                </label>
                <label className="form-group sm:col-span-2">
                  <span className="label">Tên lớp *</span>
                  <input className="input" value={form.className} onChange={(event) => patchForm("className", event.target.value)} placeholder="VD: Cambridge A1 - sáng thứ 2/4" />
                </label>
                <label className="form-group">
                  <span className="label">Nhóm lớp</span>
                  <input className="input" value={form.classGroup} onChange={(event) => patchForm("classGroup", event.target.value)} placeholder="Thiếu nhi, THCS, IELTS..." />
                </label>
                {!form.isRemedial ? (
                  <label className="form-group">
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
                  <span className="label">Ngày khai giảng</span>
                  <input type="date" className="input" value={form.startDate} onChange={(event) => patchForm("startDate", event.target.value)} />
                </label>
                {!form.isRemedial ? (
                  <label className="form-group">
                    <span className="label">Học phí / buổi *</span>
                    <CurrencyInput value={form.tuitionPerSession} onChange={(next) => patchForm("tuitionPerSession", String(next))} placeholder="100000" />
                  </label>
                ) : null}
                <label className="form-group">
                  <span className="label">Số buổi cam kết{form.isRemedial ? " (không bắt buộc)" : " *"}</span>
                  <input type="number" min={1} className="input" value={form.totalSessions} onChange={(event) => patchForm("totalSessions", event.target.value)} placeholder="50" />
                  <p className="mt-2 text-xs text-ink-muted48">Dùng để khóa học phí/lộ trình cho từng học viên. Lịch thực tế có thể sinh dài hơn nếu lớp cần dạy tiếp.</p>
                </label>
                {!form.isRemedial ? (
                  <label className="form-group">
                    <span className="label">Lớp tiếp theo (không bắt buộc)</span>
                    <select className="input" value={form.nextClassId} onChange={(event) => patchForm("nextClassId", event.target.value)}>
                      <option value="">Chưa cấu hình</option>
                      {classOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.classCode} - {item.className}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-ink-muted48">Học viên học hết lớp này mà chưa đủ số buổi sẽ được đề xuất chuyển sang lớp đã chọn ở đây.</p>
                  </label>
                ) : null}
                <div className="form-group">
                  <span className="label">Số buổi / tuần</span>
                  <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-ink">
                    {sessionsPerWeek} buổi/tuần
                  </div>
                  <p className="mt-2 text-xs text-ink-muted48">Tự tính theo số buổi cố định bạn khai báo ở phần lịch học bên dưới.</p>
                </div>
                <div className="form-group">
                  <span className="label">Ngày dự kiến kết thúc</span>
                  <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-ink">
                    {formatDateLabel(estimatedEndDate)}
                  </div>
                  <p className="mt-2 text-xs text-ink-muted48">Tính theo ngày khai giảng, tổng số buổi và đúng các thứ học cố định đã chọn.</p>
                </div>
                <label className="form-group sm:col-span-2 lg:col-span-3">
                  <span className="label">Ghi chú nội bộ</span>
                  <textarea className="input min-h-[110px]" value={form.notes} onChange={(event) => patchForm("notes", event.target.value)} placeholder="Cam kết với phụ huynh, lưu ý giáo viên, phòng học, chính sách bù..." />
                </label>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-[#e4ebf8] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_22px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#e8edf5] px-6 py-5">
                <div>
                  <h2 className="text-sm font-bold text-ink">Lịch học cố định theo tuần</h2>
                  <p className="mt-1 text-xs leading-5 text-ink-muted48">Chọn chính xác thứ và khung giờ của từng buổi cố định. Đây là lịch chuẩn để sinh buổi học.</p>
                </div>
                <button type="button" onClick={addRule} className="btn-ghost">
                  Thêm buổi cố định
                </button>
              </div>
              <div className="space-y-4 px-6 py-5">
                {scheduleRules.map((rule, index) => (
                  <div key={`${index}-${rule.weekday}-${rule.startTime}`} className="rounded-[24px] border border-[#dbe7ff] bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">Buổi cố định {index + 1}</p>
                        <p className="mt-1 text-xs text-ink-muted48">Có thể sửa lại sau ở trang lớp. Khi cần dời lịch hoặc học bù, xử lý ở từng buổi cụ thể.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
                        disabled={scheduleRules.length === 1}
                      >
                        Xóa buổi này
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <label className="form-group">
                        <span className="label">Thứ</span>
                        <select className="input" value={rule.weekday} onChange={(event) => patchRule(index, "weekday", event.target.value)}>
                          {WEEKDAY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-group">
                        <span className="label">Giờ bắt đầu</span>
                        <input type="time" className="input" value={rule.startTime} onChange={(event) => patchRule(index, "startTime", event.target.value)} />
                      </label>
                      <label className="form-group">
                        <span className="label">Giờ kết thúc</span>
                        <input type="time" className="input" value={rule.endTime} onChange={(event) => patchRule(index, "endTime", event.target.value)} />
                      </label>
                      <label className="form-group">
                        <span className="label">Phòng học</span>
                        <input className="input" value={rule.room} onChange={(event) => patchRule(index, "room", event.target.value)} placeholder="P.102" />
                      </label>
                    </div>

                    <div className="mt-3 rounded-2xl bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
                      Lịch chuẩn: <strong className="text-ink">{weekdayLabel(rule.weekday)}</strong>
                      {rule.startTime ? <> · <strong className="text-ink">{rule.startTime}</strong></> : null}
                      {rule.endTime ? <> - <strong className="text-ink">{rule.endTime}</strong></> : null}
                      {rule.room ? <> · Phòng <strong className="text-ink">{rule.room}</strong></> : null}
                      {" · "}
                      <strong className="text-ink">{computeDurationLabel(rule.startTime, rule.endTime)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-[#e4ebf8] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_22px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="border-b border-[#e8edf5] px-6 py-5">
                <h2 className="text-sm font-bold text-ink">Nhân sự mặc định của lớp</h2>
                <p className="mt-1 text-xs leading-5 text-ink-muted48">Thêm bao nhiêu giáo viên hoặc trợ giảng tùy nhu cầu. Các buổi sinh ra sau này sẽ tự nhận theo cấu hình này.</p>
              </div>
              <div className="space-y-4 px-6 py-5">
                {DEFAULT_ASSIGNMENT_GROUPS.map((group) => {
                  const rows = defaultAssignments.filter((item) => item.roleType === group.roleType);
                  return (
                    <div key={group.roleType} className="rounded-[24px] border border-[#dbe7ff] bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{group.label}</p>
                          <p className="mt-1 text-xs text-ink-muted48">{group.helper}</p>
                        </div>
                        <button type="button" onClick={() => addDefaultAssignment(group.roleType)} className="btn-ghost-sm">
                          + Thêm {group.label.toLowerCase()}
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {rows.map((item, index) => (
                          <div key={item.key} className="grid gap-3 rounded-[20px] border border-[#e6eefc] px-3 py-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
                            <label className="form-group">
                              <span className="label">{group.label} {index + 1}</span>
                              <select className="input" value={item.employeeId} onChange={(event) => patchDefaultAssignment(item.key, "employeeId", event.target.value)}>
                                <option value="">Chưa gắn</option>
                                {employees.map((employee) => (
                                  <option key={employee.id} value={employee.id}>
                                    {employee.fullName} {employee.shortName ? `(${employee.shortName})` : ""} {employee.position ? `· ${employee.position}` : ""}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="form-group">
                              <span className="label">Ghi chú</span>
                              <input
                                className="input"
                                value={item.notes}
                                onChange={(event) => patchDefaultAssignment(item.key, "notes", event.target.value)}
                                placeholder="Ghi chú ngắn nếu cần"
                              />
                            </label>

                            <div className="flex items-end">
                              <button type="button" onClick={() => removeDefaultAssignment(item.key)} className="btn-ghost-sm text-rose-600 hover:text-rose-700">
                                Xóa
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {!form.isRemedial ? (
            <div className="overflow-hidden rounded-[28px] border border-[#e4ebf8] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_22px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="flex flex-col gap-3 border-b border-[#e8edf5] px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-ink">Chương trình đào tạo theo số buổi</h2>
                  <p className="mt-1 text-xs leading-5 text-ink-muted48">
                    Nhập trước nội dung dạy cho từng buổi ngay lúc tạo lớp. Sau này giáo viên mở buổi học sẽ thấy đúng bài cần dạy, tài liệu và ghi chú.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={downloadRoadmapTemplate} className="btn-ghost">
                    Tải file mẫu .xlsx
                  </button>
                  <label className="btn-ghost cursor-pointer">
                    Nhập file để merge
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        await importRoadmapFile(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
                    <p className="font-semibold text-ink">{roadmapItems.length || 0} buổi đang có khung lộ trình</p>
                    <p className="mt-1 text-xs">Tăng `tổng số buổi` ở trên thì khu này tự nở ra theo đúng số buổi.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-6 py-5">
                {importSummary ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {importSummary}
                  </div>
                ) : null}
                {roadmapItems.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#c9d9f3] bg-[#f8fbff] px-5 py-6 text-sm text-ink-muted48">
                    Nhập `tổng số buổi` trước để hệ thống sinh chương trình đào tạo từ buổi 1 đến buổi cuối.
                  </div>
                ) : (
                  <>
                    {visibleRoadmapItems.map((item) => (
                      <div key={item.sessionNumber} className="rounded-[24px] border border-[#dbe7ff] bg-white p-4 shadow-sm">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">Buổi {item.sessionNumber}</p>
                            <p className="mt-1 text-xs text-ink-muted48">Đây là khung cố định để giáo viên mở buổi lên là nhìn thấy ngay hôm nay dạy gì.</p>
                          </div>
                          <span className="badge bg-sky-100 text-sky-700">Lộ trình chuẩn</span>
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          <label className="form-group lg:col-span-2">
                            <span className="label">Tên bài / tên buổi</span>
                            <input
                              className="input"
                              value={item.title}
                              onChange={(event) => patchRoadmap(item.sessionNumber, "title", event.target.value)}
                              placeholder={`Ví dụ: Unit 1 - Lesson ${item.sessionNumber}`}
                            />
                          </label>
                          <label className="form-group">
                            <span className="label">Mục tiêu buổi học</span>
                            <textarea
                              className="input min-h-[110px]"
                              value={item.objective}
                              onChange={(event) => patchRoadmap(item.sessionNumber, "objective", event.target.value)}
                              placeholder="Học viên phải đạt được gì sau buổi này?"
                            />
                          </label>
                          <label className="form-group">
                            <span className="label">Tài liệu / học cụ</span>
                            <textarea
                              className="input min-h-[110px]"
                              value={item.materials}
                              onChange={(event) => patchRoadmap(item.sessionNumber, "materials", event.target.value)}
                              placeholder="Sách, workbook, minitest, file nghe, học cụ..."
                            />
                          </label>
                          <label className="form-group">
                            <span className="label">Ghi chú cho giáo viên</span>
                            <textarea
                              className="input min-h-[140px]"
                              value={item.teacherGuide}
                              onChange={(event) => patchRoadmap(item.sessionNumber, "teacherGuide", event.target.value)}
                              placeholder="Cách vào bài, phần cần nhấn mạnh, lưu ý với học viên yếu/mạnh..."
                            />
                          </label>
                          <label className="form-group">
                            <span className="label">Dặn dò / bài tập cuối buổi</span>
                            <textarea
                              className="input min-h-[140px]"
                              value={item.homeworkGuide}
                              onChange={(event) => patchRoadmap(item.sessionNumber, "homeworkGuide", event.target.value)}
                              placeholder="Bài tập, dặn phụ huynh, việc cần ôn lại sau buổi này..."
                            />
                          </label>
                        </div>
                      </div>
                    ))}

                    {visibleRoadmapCount < roadmapItems.length ? (
                      <div className="flex justify-center pt-2">
                        <button
                          type="button"
                          onClick={() => setVisibleRoadmapCount((current) => Math.min(current + 12, roadmapItems.length))}
                          className="btn-ghost"
                        >
                          Xem thêm {Math.min(12, roadmapItems.length - visibleRoadmapCount)} buổi nữa
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            ) : null}
          </div>

          <aside className="space-y-5">
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Tóm tắt lịch & học phí</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="detail-row">
                  <dt className="detail-label">Học phí / buổi</dt>
                  <dd className="detail-value">{formatVnd(tuitionPerSession)}</dd>
                </div>
                <div className="detail-row">
                  <dt className="detail-label">Tổng số buổi</dt>
                  <dd className="detail-value">{totalSessions ?? "—"}</dd>
                </div>
                <div className="detail-row">
                  <dt className="detail-label">Ngày kết thúc dự kiến</dt>
                  <dd className="detail-value">{formatDateLabel(estimatedEndDate)} · {estimatedWeeks ?? "—"} tuần</dd>
                </div>
                <div className="detail-row">
                  <dt className="detail-label">Tạm tính toàn khóa</dt>
                  <dd className="detail-value text-primary">{formatVnd(estimatedCourseTuition)}</dd>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-ink-muted48">
                Công thức đang dùng ngay khi tạo lớp: <strong>học phí/buổi × tổng số buổi</strong>. Ngày kết thúc tính theo đúng các buổi cố định bên dưới ({estimatedSpanLabel}).
              </p>
              <div className="mt-4 space-y-1.5 border-t border-hairline pt-3 text-sm text-ink-muted80">
                {scheduleRules.map((rule, index) => (
                  <p key={`${index}-${rule.weekday}-${rule.startTime}`}>
                    • Buổi {index + 1}: {weekdayLabel(rule.weekday)} {rule.startTime || "--:--"} - {rule.endTime || "--:--"} {rule.room ? `· ${rule.room}` : ""}
                  </p>
                ))}
                {!scheduleRules.length ? <p>• Chưa có buổi cố định nào.</p> : null}
              </div>
            </div>

            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Chương trình đang chuẩn bị</p>
              <div className="mt-3 space-y-2 text-sm text-ink-muted80">
                <p>• Hệ thống sẽ tạo đúng {roadmapItems.length || 0} mục lộ trình theo số buổi của lớp.</p>
                <p>• Giáo viên vào từng buổi sẽ thấy tên bài, mục tiêu, tài liệu và ghi chú đã khai báo từ đây.</p>
                <p>• Có thể tải file mẫu `.xlsx`, điền tay bằng Excel rồi nhập lại để merge hàng loạt.</p>
                <p>• Nếu chưa kịp điền hết, bạn vẫn có thể tạo lớp trước rồi quay lại hoàn thiện ở chi tiết lớp.</p>
              </div>
            </div>

            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Quy tắc vận hành</p>
              <ul className="mt-3 space-y-3 text-sm text-ink">
                <li>• Lịch đang nhập ở đây là lịch chuẩn cố định, dùng để sinh buổi học ban đầu.</li>
                <li>• Nếu có nghỉ, dời hoặc học bù, trung tâm xử lý sau ở cấp buổi học thực tế, không sửa méo toàn bộ khung lớp.</li>
                <li>• Trang chi tiết lớp đã có khu vực sửa lịch chuẩn và lộ trình, nên tạo xong vẫn chỉnh được.</li>
                <li>• Học viên học bù sang ngày khác sẽ được ghi nhận ở attendance/buổi học, không làm mất lịch chuẩn của lớp gốc.</li>
              </ul>
            </div>

            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Thiết kế bù / chuyển buổi</p>
              <ul className="mt-3 space-y-3 text-sm text-ink-muted80">
                <li>• `Lịch chuẩn` là bộ khung gốc của lớp, giữ ổn định để sinh buổi và tính tiến độ khóa.</li>
                <li>• `Buổi dời lịch` là buổi gốc được đổi sang ngày khác, nên xử lý ở buổi học cụ thể chứ không sửa cả lịch lớp.</li>
                <li>• `Buổi học bù` là phát sinh thêm cho một số học viên hoặc cho cả lớp, vẫn nên ghi nhận như buổi thực tế riêng để attendance và journal không bị nhập nhằng.</li>
              </ul>
            </div>

            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Nhân sự mặc định sẽ đi theo lớp</p>
              <div className="mt-3 space-y-2 text-sm text-ink-muted80">
                {DEFAULT_ASSIGNMENT_GROUPS.map((group) => {
                  const rows = defaultAssignments.filter((item) => item.roleType === group.roleType && item.employeeId);
                  return (
                    <p key={group.roleType}>
                      • {group.label}:{" "}
                      <strong className="text-ink">
                        {rows.length > 0
                          ? rows
                              .map((item) => {
                                const employee = employees.find((row) => row.id === item.employeeId);
                                return employee ? `${employee.fullName}${employee.shortName ? ` (${employee.shortName})` : ""}` : null;
                              })
                              .filter(Boolean)
                              .join(", ")
                          : "Chưa gắn"}
                      </strong>
                    </p>
                  );
                })}
              </div>
            </div>

            {selectedCourse ? (
              <div className="card">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Đang lấy từ khóa chuẩn</p>
                <p className="mt-3 text-sm font-semibold text-ink">[{selectedCourse.code}] {selectedCourse.name}</p>
                <p className="mt-2 text-sm text-ink-muted80">
                  Mẫu khóa này đang gợi ý <strong>{formatVnd(selectedCourse.tuitionPerSession)}/buổi</strong>. Bạn vẫn có thể sửa tay theo lớp thực tế.
                </p>
              </div>
            ) : null}
          </aside>
        </div>

        {error ? (
          <div className="alert-danger flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        ) : null}

        <div className="sticky bottom-4 z-10 -mx-2 rounded-[24px] border border-[#e4ebf8] bg-white/92 p-4 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur-md">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={() => router.push("/classes")} disabled={submitting} className="btn-ghost">
              Hủy
            </button>
            <button type="submit" disabled={submitting} className="btn-primary min-w-[160px]">
              {submitting ? "Đang tạo..." : "Tạo lớp học"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
