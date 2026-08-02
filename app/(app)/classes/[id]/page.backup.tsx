import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  estimateEndDate,
  estimateEndDateFromRules,
  generateSessionDates,
  getVietnamToday,
  isSameUtcDay,
  computeSessionTiming,
  SESSION_STATUS_LABEL,
  ENROLLMENT_STATUS_LABEL,
} from "@/lib/server/class-rules";
import { getHolidayDateSet } from "@/lib/server/holidays";
import DetailTabs from "@/components/ui/DetailTabs";
import ScheduleRuleManager from "@/components/classes/ScheduleRuleManager";
import GenerateSessionsForm from "@/components/classes/GenerateSessionsForm";
import EnrollStudentForm from "@/components/classes/EnrollStudentForm";
import EnrollmentRowActions from "@/components/classes/EnrollmentRowActions";
import ClassTaskManager from "@/components/classes/ClassTaskManager";
import ClassRecurringTaskManager from "@/components/classes/ClassRecurringTaskManager";
import ClassEditForm from "@/components/classes/ClassEditForm";
import RescheduleSessionButton from "@/components/classes/RescheduleSessionButton";
import AddMakeupSessionButton from "@/components/classes/AddMakeupSessionButton";
import ClassRoadmapManager from "@/components/classes/ClassRoadmapManager";
import ClassDefaultAssignmentManager from "@/components/classes/ClassDefaultAssignmentManager";
import { isTaskDueOn, computeTaskLogStatus } from "@/lib/server/class-task-rules";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { ensureClassRoadmapItems } from "@/lib/server/class-roadmap";
import { getClassAssignmentRoleType } from "@/lib/server/class-default-assignments";

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
}

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function weekdayLabel(weekday: number) {
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][weekday] ?? String(weekday);
}

function attendanceLabel(status: string) {
  switch (status) {
    case "PRESENT":
      return "Có mặt";
    case "ABSENT":
      return "Vắng";
    case "MAKEUP":
      return "Học bù";
    case "EXCUSED":
      return "Có phép";
    default:
      return status;
  }
}

function badgeClass(status: string) {
  if (status === "ACTIVE" || status === "COMPLETED" || status === "DONE_ON_TIME") return "bg-primary/10 text-primary";
  if (status === "UNPAID" || status === "OVERDUE" || status === "CANCELLED") return "bg-red-100 text-red-700";
  if (status === "PENDING" || status === "PLANNED") return "bg-amber-100 text-amber-700";
  return "bg-ink/5 text-ink-muted48";
}

function timingLabel(timing: "past" | "today" | "upcoming") {
  if (timing === "past") return "Đã qua";
  if (timing === "today") return "Hôm nay";
  return "Sắp tới";
}

function timingClass(timing: "past" | "today" | "upcoming") {
  if (timing === "past") return "text-ink-muted48";
  if (timing === "today") return "text-primary font-semibold";
  return "text-ink-muted48";
}

// Header dùng chung cho mọi khối trong 5 tab của trang này — mỗi khối trước đây tự
// viết 1 kiểu tiêu đề khác nhau (có nơi h2 trơn, có nơi eyebrow+h2, có nơi lồng
// trong <details>), giờ quy về 1 khuôn duy nhất: icon tròn + eyebrow (tùy chọn) +
// tiêu đề + mô tả (tùy chọn) + action bên phải (tùy chọn).
function SectionHeading({
  icon,
  eyebrow,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        ) : null}
        <div>
          {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">{eyebrow}</p> : null}
          <h2 className="font-display text-base font-bold tracking-tight text-ink">{title}</h2>
          {description ? <p className="mt-1 text-sm text-ink-muted48">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const ICON_CLOCK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);
const ICON_ALERT = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const ICON_CHECKLIST = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const ICON_LINK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const ICON_CALENDAR = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const ICON_LIST = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const ICON_USERS = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ICON_SETTINGS = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

// Kiểu pill button gọn dùng chung cho các thao tác theo dòng (Mở buổi học/Đổi
// buổi/Thêm buổi bù) — trước đây mỗi nút 1 kiểu (gradient riêng/viền/text-link),
// giờ quy về cùng 1 khuôn kích thước, chỉ đổi màu theo ngữ nghĩa.
const ROW_ACTION_BASE = "inline-flex items-center justify-center rounded-xl border px-3 py-1.5 text-xs font-semibold transition";
const ROW_ACTION_SKY = `${ROW_ACTION_BASE} border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100`;

// Hack lặp lại 2 lần để bảng có padding ô đều nhau — gom về 1 hằng số dùng chung
// trong file này thay vì gõ lại chuỗi class ở cả 2 bảng.
const TABLE_CELL_PAD = "[&_td]:px-5 [&_th]:px-5";

type AttentionSeverity = "critical" | "warning" | "ok";
const ATTENTION_STYLE: Record<AttentionSeverity, { dot: string; text: string; bg: string }> = {
  critical: { dot: "bg-red-500", text: "text-red-800", bg: "bg-red-50" },
  warning: { dot: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-50" },
  ok: { dot: "bg-emerald-500", text: "text-emerald-800", bg: "bg-emerald-50" },
};

export default async function ClassDetailPage({ params }: { params: { id: string } }) {
  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      scheduleRules: { orderBy: { weekday: "asc" } },
      roadmapItems: { orderBy: { sessionNumber: "asc" } },
      defaultAssignments: { where: { isActive: true }, include: { employee: true }, orderBy: { role: "asc" } },
      sessions: {
        orderBy: { sessionDate: "desc" },
        include: {
          assignments: { include: { employee: true }, orderBy: [{ role: "asc" }, { employeeId: "asc" }] },
          attendances: true,
          journal: true,
          replacesSession: { select: { id: true, sessionDate: true } },
          replacedBySession: { select: { id: true, sessionDate: true } },
        },
      },
      enrollments: {
        include: {
          scholarships: { orderBy: { effectiveFrom: "desc" } },
          student: {
            include: {
              lead: true,
              guardians: {
                include: { guardian: { include: { user: true } } },
                orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
              },
              charges: {
                include: { allocations: true, billingPeriod: true },
                orderBy: { billingPeriod: { startDate: "desc" } },
              },
              attendances: {
                where: { session: { classId: params.id } },
                orderBy: { session: { sessionDate: "desc" } },
                take: 4,
                include: { session: true },
              },
              bookIssues: {
                where: { classId: params.id },
                orderBy: { issueDate: "desc" },
                take: 2,
                include: { book: true },
              },
            },
          },
        },
        orderBy: { enrollDate: "desc" },
      },
    },
  });
  if (!cls) notFound();

  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const canManageClass = canUpdate("schedule", role);
  const roadmapItems = await ensureClassRoadmapItems(cls.id, cls.totalSessions);

  const tasks = await prisma.task.findMany({
    where: { relatedType: "Class", relatedId: cls.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  const classTasksRaw = await prisma.classTask.findMany({
    where: { classId: cls.id },
    orderBy: { createdAt: "asc" },
    include: { logs: { orderBy: { dueDate: "desc" }, take: 5 } },
  });

  const today = new Date();
  const classTasks = classTasksRaw.map((task) => {
    const dueToday = task.isActive && isTaskDueOn(task, today);
    const todayLog = task.logs.find(
      (log) =>
        log.dueDate.getFullYear() === today.getFullYear() &&
        log.dueDate.getMonth() === today.getMonth() &&
        log.dueDate.getDate() === today.getDate()
    );
    return { ...task, dueToday, todayStatus: dueToday ? computeTaskLogStatus(today, todayLog?.completedAt ?? null, today) : null };
  });

  const courses = await prisma.course.findMany({ where: { branchId: cls.branchId }, orderBy: { name: "asc" } });
  const employees = canManageClass
    ? await prisma.employee.findMany({
        where: { branchId: cls.branchId, workStatus: "ACTIVE" },
        orderBy: { fullName: "asc" },
      })
    : [];

  const completedSessions = cls.sessions.filter((session) => session.status === "COMPLETED").length;
  const activeEnrollments = cls.enrollments.filter((enrollment) => enrollment.status === "ACTIVE");
  const holidayDates = await getHolidayDateSet(cls.branchId);
  const suggestedEnd =
    cls.expectedEndDate ??
    estimateEndDateFromRules(cls.startDate, cls.totalSessions, cls.scheduleRules, holidayDates) ??
    estimateEndDate(cls.startDate, cls.totalSessions, cls.sessionsPerWeek);
  const nextSession = [...cls.sessions].find((session) => session.sessionDate >= today) ?? null;
  const latestSession = cls.sessions[0] ?? null;
  const latestCompletedSession = cls.sessions.find((session) => session.status === "COMPLETED") ?? latestSession ?? null;

  const vietnamToday = getVietnamToday();

  // Buổi số N tính theo thứ tự ngày thực tế trong cls.sessions — buổi CANCELLED
  // không chiếm số thứ tự vì thực tế chưa từng diễn ra.
  const sessionsChronological = [...cls.sessions]
    .filter((session) => session.status !== "CANCELLED")
    .sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());
  const sessionNumberById = new Map(sessionsChronological.map((session, index) => [session.id, index + 1]));

  // Lịch trình dự kiến TOÀN KHÓA tính thẳng từ Lịch chuẩn (scheduleRules) trải suốt
  // startDate→suggestedEnd — khác với cls.sessions (chỉ những buổi ĐÃ bấm sinh trong
  // hệ thống, có thể chưa phủ hết cả khóa). Ghép theo ngày với buổi thực tế nếu có,
  // để biết buổi nào đã có trong hệ thống, buổi nào mới chỉ là dự kiến theo lịch.
  const projectedSlots =
    cls.startDate && suggestedEnd && cls.scheduleRules.length > 0
      ? generateSessionDates(cls.scheduleRules, cls.startDate, suggestedEnd, holidayDates)
      : [];
  const projectedSchedule = (cls.totalSessions ? projectedSlots.slice(0, cls.totalSessions) : projectedSlots).map((slot, index) => {
    const matchedSession = cls.sessions.find((session) => isSameUtcDay(session.sessionDate, slot.sessionDate)) ?? null;
    return {
      number: index + 1,
      sessionDate: slot.sessionDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      timing: computeSessionTiming(slot.sessionDate, vietnamToday),
      session: matchedSession,
    };
  });
  const occurredByCalendar = projectedSchedule.filter((slot) => slot.timing === "past" || slot.timing === "today").length;

  const latestAttendanceStats = latestCompletedSession
    ? latestCompletedSession.attendances.reduce(
        (acc, attendance) => {
          if (attendance.status === "PRESENT") acc.present += 1;
          if (attendance.status === "ABSENT") acc.absent += 1;
          if (attendance.status === "MAKEUP") acc.makeup += 1;
          if (attendance.status === "EXCUSED") acc.excused += 1;
          return acc;
        },
        { present: 0, absent: 0, makeup: 0, excused: 0 }
      )
    : { present: 0, absent: 0, makeup: 0, excused: 0 };

  const totalOutstanding = cls.enrollments.reduce((sum, enrollment) => {
    const classCharges = enrollment.student.charges.filter((charge) => charge.classId === cls.id);
    const total = classCharges.reduce((chargeSum, charge) => chargeSum + charge.totalAmount, 0);
    const paid = classCharges.reduce(
      (paidSum, charge) => paidSum + charge.allocations.reduce((allocationSum, allocation) => allocationSum + allocation.amount, 0),
      0
    );
    return sum + (total - paid);
  }, 0);

  const overdueEnrollments = cls.enrollments.filter((enrollment) => {
    const classCharges = enrollment.student.charges.filter((charge) => charge.classId === cls.id);
    const total = classCharges.reduce((chargeSum, charge) => chargeSum + charge.totalAmount, 0);
    const paid = classCharges.reduce(
      (paidSum, charge) => paidSum + charge.allocations.reduce((allocationSum, allocation) => allocationSum + allocation.amount, 0),
      0
    );
    return total - paid > 0;
  }).length;

  const dueTodayTasks = classTasks.filter((task) => task.dueToday);
  const openTasks = tasks.filter((task) => task.status === "OPEN");

  const attentionItems: { text: string; severity: AttentionSeverity }[] = [];
  if (!cls.scheduleRules.length) attentionItems.push({ text: "Chưa cấu hình lịch học chuẩn cho lớp.", severity: "critical" });
  if (!cls.sessions.length) attentionItems.push({ text: "Chưa sinh buổi học — lớp chưa có dữ liệu vận hành.", severity: "critical" });
  if (latestSession && !latestSession.assignments.length) attentionItems.push({ text: "Buổi gần nhất chưa phân công GV/TG thực tế.", severity: "critical" });
  if (latestSession && !latestSession.attendances.length) attentionItems.push({ text: "Buổi gần nhất chưa điểm danh.", severity: "warning" });
  if (latestSession && !latestSession.journal) attentionItems.push({ text: "Buổi gần nhất chưa có journal.", severity: "warning" });
  if (totalOutstanding > 0) attentionItems.push({ text: `Lớp còn tổng nợ ${formatVnd(totalOutstanding)}.`, severity: "warning" });
  if (dueTodayTasks.some((task) => task.todayStatus !== "DONE_ON_TIME")) attentionItems.push({ text: "Có nhắc việc hôm nay chưa hoàn tất đúng hạn.", severity: "warning" });
  const estimatedClassTuition =
    cls.tuitionPerSession && cls.totalSessions ? cls.tuitionPerSession * cls.totalSessions : null;
  const defaultTeacherNames = cls.defaultAssignments
    .filter((item) => getClassAssignmentRoleType(item.role) === "TEACHER")
    .map((item) => item.employee.fullName)
    .join(", ");
  const defaultAssistantNames = cls.defaultAssignments
    .filter((item) => getClassAssignmentRoleType(item.role) === "ASSISTANT")
    .map((item) => item.employee.shortName || item.employee.fullName)
    .join(", ");

  return (
    <div className="space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-[32px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f8fcff_0%,#e8f6ff_48%,#ffffff_100%)] p-6 shadow-[0_28px_80px_-48px_rgba(14,116,144,0.48)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-[38%] h-48 w-48 rounded-full bg-cyan-100/70 blur-3xl" />
        <div className="relative z-10">
          <Link href="/classes" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:text-sky-900">
            ← Quay lại Lớp & Lịch
          </Link>
          <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">Chi tiết lớp học</span>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{cls.className}</h1>
              <span className={`badge ${badgeClass(cls.status)}`}>{cls.status === "ACTIVE" ? "Đang hoạt động" : cls.status}</span>
              {cls.isRemedial ? <span className="badge bg-violet-100 text-violet-700">Khóa bổ trợ</span> : null}
              {totalOutstanding > 0 ? <span className="badge bg-amber-100 text-amber-700">Còn nợ {formatVnd(totalOutstanding)}</span> : null}
            </div>
            <p className="mt-3 text-sm text-ink-muted80">
              {cls.classCode}
              {cls.course ? ` · ${cls.course.name}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700">
                Sĩ số {activeEnrollments.length}
              </span>
              <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700">
                Buổi gần nhất {formatDate(latestSession?.sessionDate ?? null)}
              </span>
              {nextSession ? (
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                  Buổi tới {formatDate(nextSession.sessionDate)}
                </span>
              ) : null}
              <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700">
                {cls.scheduleRules.length
                  ? cls.scheduleRules.map((rule) => `${weekdayLabel(rule.weekday)} ${rule.startTime}-${rule.endTime}`).join(" · ")
                  : "Chưa có lịch chuẩn"}
              </span>
              <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700">
                GV {defaultTeacherNames || "Chưa gắn"}
              </span>
              <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700">
                TG {defaultAssistantNames || "Chưa gắn"}
              </span>
              {latestCompletedSession?.journal?.publishedAt ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Nhật ký buổi gần nhất đã gửi
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {latestSession ? (
              <Link href={`/classes/${cls.id}/sessions/${latestSession.id}`} className="btn-primary">
                Mở buổi học gần nhất
              </Link>
            ) : null}
            {canManageClass ? <GenerateSessionsForm classId={cls.id} /> : null}
          </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-white to-sky-50 p-5 shadow-[0_18px_45px_-36px_rgba(14,116,144,0.42)]">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Sĩ số hiện tại</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{activeEnrollments.length}</p>
          <p className="mt-1 text-xs text-ink-muted48">{cls.enrollments.length} tổng enrollment</p>
        </div>
        <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-[0_18px_45px_-36px_rgba(5,150,105,0.3)]">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Buổi đã học</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
            {completedSessions}
            {cls.totalSessions ? ` / ${cls.totalSessions}` : ""}
          </p>
          <p className="mt-1 text-xs text-ink-muted48">{latestSession ? `Buổi gần nhất ${SESSION_STATUS_LABEL[latestSession.status] ?? latestSession.status}` : "Chưa có buổi"}</p>
        </div>
        <div className="rounded-[24px] border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 p-5 shadow-[0_18px_45px_-36px_rgba(79,70,229,0.3)]">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Công nợ lớp</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalOutstanding)}</p>
          <p className="mt-1 text-xs text-ink-muted48">{overdueEnrollments} học viên còn nợ</p>
        </div>
        <div className="rounded-[24px] border border-amber-100 bg-gradient-to-br from-white to-amber-50 p-5 shadow-[0_18px_45px_-36px_rgba(180,83,9,0.25)]">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Mốc lớp</p>
          <p className="mt-2 font-display text-lg font-semibold tracking-tight">{formatDate(cls.startDate)}</p>
          <p className="mt-1 text-xs text-ink-muted48">Dự kiến KT: {formatDate(suggestedEnd)}</p>
        </div>
      </div>

      <DetailTabs
        defaultTabKey="tongquan"
        tabs={[
          {
            key: "tongquan",
            label: "Tổng quan",
            content: (
              <div className="space-y-5">
                <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-[0_18px_45px_-36px_rgba(5,150,105,0.25)]">
                  <SectionHeading
                    icon={ICON_CLOCK}
                    eyebrow="Trọng tâm vận hành"
                    title="Buổi học gần nhất"
                    action={
                      latestSession ? (
                        <Link href={`/classes/${cls.id}/sessions/${latestSession.id}`} className="text-sm font-semibold text-primary">
                          Mở chi tiết →
                        </Link>
                      ) : null
                    }
                  />
                  {latestSession ? (
                    <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-hairline pt-4 text-sm md:grid-cols-4">
                      <div>
                        <p className="text-xs text-ink-muted48">Ngày & giờ</p>
                        <p className="mt-1 font-semibold">{formatDate(latestSession.sessionDate)} · {latestSession.startTime ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted48">Điểm danh</p>
                        <p className="mt-1 font-semibold">
                          {latestAttendanceStats.present} có mặt <span className="font-normal text-ink-muted48">· {latestAttendanceStats.absent} vắng</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted48">Nhật ký</p>
                        <p className="mt-1 font-semibold">{latestSession.journal?.publishedAt ? "Đã gửi" : latestSession.journal ? "Lưu nháp" : "Chưa có"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted48">Nhân sự</p>
                        <p className="mt-1 truncate font-semibold">
                          {latestSession.assignments.filter((item) => getClassAssignmentRoleType(item.role) === "TEACHER").map((item) => item.employee.fullName).join(", ") || "Chưa phân công"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-ink-muted48">Chưa có buổi học nào để vận hành.</p>
                  )}
                </div>

                <div className="rounded-[24px] border border-hairline px-5 py-5">
                  <SectionHeading
                    icon={ICON_ALERT}
                    title="Cần chú ý"
                    action={<span className="badge bg-primary/10 text-primary">{dueTodayTasks.length} việc hôm nay</span>}
                  />
                  <div className="mt-4 space-y-2">
                    {attentionItems.length === 0 ? (
                      <div className={`flex items-center gap-2 rounded-xl ${ATTENTION_STYLE.ok.bg} px-3 py-2`}>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${ATTENTION_STYLE.ok.dot}`} />
                        <span className={`text-sm font-medium ${ATTENTION_STYLE.ok.text}`}>Lớp đang không có cảnh báo cần xử lý.</span>
                      </div>
                    ) : (
                      attentionItems.map((item, index) => (
                        <div key={index} className={`flex items-center gap-2 rounded-xl ${ATTENTION_STYLE[item.severity].bg} px-3 py-2`}>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${ATTENTION_STYLE[item.severity].dot}`} />
                          <span className={`text-sm font-medium ${ATTENTION_STYLE[item.severity].text}`}>{item.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-hairline px-5 py-5">
                  <SectionHeading icon={ICON_CHECKLIST} title="Nhắc việc hôm nay" />
                  <div className="mt-4 space-y-2">
                    {dueTodayTasks.map((task) => (
                      <div key={task.id} className="rounded-xl bg-canvas-parchment/50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-ink">{task.title}</span>
                          {task.todayStatus ? <span className={`badge ${badgeClass(task.todayStatus)}`}>{task.todayStatus}</span> : null}
                        </div>
                      </div>
                    ))}
                    {dueTodayTasks.length === 0 ? <p className="text-sm text-ink-muted48">Không có việc định kỳ tới hạn hôm nay.</p> : null}
                  </div>
                </div>

                <div className="rounded-[24px] border border-hairline px-5 py-5">
                  <SectionHeading icon={ICON_LINK} title="Liên kết nhanh" />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {latestSession ? (
                      <Link href={`/classes/${cls.id}/sessions/${latestSession.id}`} className="btn-ghost-sm">
                        Điểm danh buổi gần nhất
                      </Link>
                    ) : null}
                    <Link href="/tuition" className="btn-ghost-sm">
                      Mở học phí
                    </Link>
                    <Link href="/inventory" className="btn-ghost-sm">
                      Mở giáo trình
                    </Link>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "buoihoc",
            label: "Buổi học",
            content: (
              <div className="space-y-5">
                {projectedSchedule.length > 0 && (
                  <details className="card group" open>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <SectionHeading icon={ICON_CALENDAR} title="Lịch trình khóa học" description={`${occurredByCalendar}/${projectedSchedule.length} buổi đã đến theo lịch.`} />
                      <span className="shrink-0 text-sm font-semibold text-primary group-open:hidden">Xem lịch</span>
                      <span className="hidden shrink-0 text-sm font-semibold text-primary group-open:inline">Thu gọn</span>
                    </summary>
                    <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-hairline">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 border-b border-hairline bg-canvas-parchment/80 text-xs uppercase tracking-wide text-ink-muted48">
                          <tr>
                            <th className="py-2 pl-3 font-medium">Buổi</th>
                            <th className="py-2 font-medium">Ngày dự kiến</th>
                            <th className="py-2 font-medium">Giờ</th>
                            <th className="py-2 font-medium">Tình trạng</th>
                            <th className="py-2 font-medium">Hệ thống</th>
                            <th className="py-2 pr-3 text-right font-medium">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectedSchedule.map((slot) => (
                            <tr key={slot.number} className="border-b border-hairline last:border-0">
                              <td className="py-1.5 pl-3 font-mono text-xs text-ink-muted48">
                                #{slot.number}/{projectedSchedule.length}
                              </td>
                              <td className="py-1.5">{formatDate(slot.sessionDate)}</td>
                              <td className="py-1.5 text-ink-muted80">
                                {slot.startTime}–{slot.endTime}
                              </td>
                              <td className={`py-1.5 ${timingClass(slot.timing)}`}>{timingLabel(slot.timing)}</td>
                              <td className="py-1.5 pr-3">
                                {slot.session ? (
                                  <Link href={`/classes/${cls.id}/sessions/${slot.session.id}`} className="text-xs text-primary hover:underline">
                                    {SESSION_STATUS_LABEL[slot.session.status] ?? slot.session.status} →
                                  </Link>
                                ) : (
                                  <span className="text-xs text-ink-muted48">Chưa sinh buổi</span>
                                )}
                              </td>
                              <td className="py-1.5 pr-3 text-right">
                                {slot.session ? (
                                  <div className="flex flex-col items-end gap-1">
                                    {canManageClass && slot.session.status !== "CANCELLED" ? (
                                      <AddMakeupSessionButton sessionId={slot.session.id} sessionDateLabel={formatDate(slot.session.sessionDate)} />
                                    ) : null}
                                    {canManageClass && slot.session.status !== "CANCELLED" && slot.session.status !== "RESCHEDULED" && !slot.session.replacedBySession ? (
                                      <RescheduleSessionButton sessionId={slot.session.id} sessionDateLabel={formatDate(slot.session.sessionDate)} />
                                    ) : null}
                                  </div>
                                ) : canManageClass ? (
                                  <span className="text-xs text-amber-700">Sinh buổi trước để thao tác</span>
                                ) : (
                                  <span className="text-xs text-ink-muted48">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                <div className={`overflow-x-auto rounded-[24px] border border-hairline ${TABLE_CELL_PAD}`}>
                  <div className="px-6 py-5">
                    <SectionHeading icon={ICON_LIST} title="Danh sách buổi học" />
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="border-y border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                      <tr>
                        <th className="py-2 font-medium">Buổi</th>
                        <th className="py-2 font-medium">GV / TG</th>
                        <th className="py-2 font-medium">Điểm danh</th>
                        <th className="py-2 font-medium">Nhật ký & trạng thái</th>
                        <th className="py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cls.sessions.map((session) => {
                        const present = session.attendances.filter((item) => item.status === "PRESENT").length;
                        const absent = session.attendances.filter((item) => item.status === "ABSENT").length;
                        const teacherNames = session.assignments.filter((item) => getClassAssignmentRoleType(item.role) === "TEACHER").map((item) => item.employee.fullName).join(", ");
                        const assistantNames = session.assignments.filter((item) => getClassAssignmentRoleType(item.role) === "ASSISTANT").map((item) => item.employee.shortName || item.employee.fullName).join(", ");
                        const timing = computeSessionTiming(session.sessionDate, vietnamToday);
                        return (
                          <tr key={session.id} className="border-b border-hairline align-top transition-colors hover:bg-sky-50/25 last:border-0">
                            <td className="py-2">
                              <p className="font-mono text-xs text-ink-muted48">
                              {sessionNumberById.has(session.id) ? `#${sessionNumberById.get(session.id)}${cls.totalSessions ? `/${cls.totalSessions}` : ""}` : "—"}
                              </p>
                              {formatDate(session.sessionDate)}
                              <p className={`text-[11px] ${timingClass(timing)}`}>{timingLabel(timing)}</p>
                              <p className="text-xs text-ink-muted48">{session.startTime ?? "—"}–{session.endTime ?? "—"}</p>
                            </td>
                            <td className="py-2 text-ink-muted80">
                              <p>{teacherNames || "Chưa phân công GV"}</p>
                              <p className="text-xs text-ink-muted48">{assistantNames || "Không có TG"}</p>
                            </td>
                            <td className="py-2 text-ink-muted80">
                              {session.attendances.length ? (
                                <>
                                  {present} có mặt
                                  <p className="text-xs text-ink-muted48">{absent} vắng · {session.attendances.filter((item) => item.status === "MAKEUP").length} bù</p>
                                </>
                              ) : (
                                "Chưa điểm danh"
                              )}
                            </td>
                            <td className="py-2">
                              <p className="text-ink-muted80">{session.journal?.publishedAt ? "Đã gửi phụ huynh" : session.journal ? "Đang lưu nháp" : "Chưa có nhật ký"}</p>
                              <span className={`badge ${badgeClass(session.status)}`}>{SESSION_STATUS_LABEL[session.status] ?? session.status}</span>
                              {session.status === "RESCHEDULED" && session.replacedBySession ? (
                                <p className="mt-1 text-[11px] text-amber-700">
                                  Bù sang{" "}
                                  <Link href={`/classes/${cls.id}/sessions/${session.replacedBySession.id}`} className="underline">
                                    {formatDate(session.replacedBySession.sessionDate)}
                                  </Link>
                                </p>
                              ) : null}
                              {session.replacesSession ? (
                                <p className="mt-1 text-[11px] text-ink-muted48">Buổi bù cho {formatDate(session.replacesSession.sessionDate)}</p>
                              ) : null}
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <Link href={`/classes/${cls.id}/sessions/${session.id}`} className={ROW_ACTION_SKY}>
                                  Mở buổi học
                                </Link>
                                {canManageClass && session.status !== "CANCELLED" ? (
                                  <AddMakeupSessionButton sessionId={session.id} sessionDateLabel={formatDate(session.sessionDate)} />
                                ) : null}
                                {canManageClass && session.status !== "CANCELLED" && session.status !== "RESCHEDULED" && !session.replacedBySession ? (
                                  <RescheduleSessionButton sessionId={session.id} sessionDateLabel={formatDate(session.sessionDate)} />
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {cls.sessions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-ink-muted48">
                            <div className="flex flex-col items-center gap-3 py-2">
                              <p className="font-medium text-ink">Chưa có buổi học thực tế nào.</p>
                              <p className="max-w-md text-xs text-ink-muted48">
                                Bấm <strong>Sinh buổi học</strong> để tạo buổi thực tế từ lịch chuẩn — sau đó nút <strong>Đổi buổi</strong> và <strong>Thêm buổi bù</strong> mới hiện ở từng dòng buổi.
                              </p>
                              {canManageClass ? <GenerateSessionsForm classId={cls.id} /> : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
          {
            key: "hocvien",
            label: "Học viên",
            content: (
              <div className={`overflow-x-auto rounded-[24px] border border-hairline ${TABLE_CELL_PAD}`}>
                <div className="px-6 py-5">
                  <SectionHeading
                    icon={ICON_USERS}
                    title="Danh sách học viên trong lớp"
                    action={canManageClass ? <EnrollStudentForm classId={cls.id} courseTotalAmount={(cls.tuitionPerSession ?? 0) * (cls.totalSessions ?? 0)} /> : null}
                  />
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-y border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                    <tr>
                      <th className="py-2 font-medium">Học viên</th>
                      <th className="py-2 font-medium">Liên hệ</th>
                      <th className="py-2 font-medium">Học phí</th>
                      <th className="py-2 font-medium">Học tập</th>
                      <th className="py-2 font-medium">Trạng thái</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.enrollments.map((enrollment) => {
                      const primaryGuardian = enrollment.student.guardians.find((item) => item.isPrimary)?.guardian ?? enrollment.student.guardians[0]?.guardian ?? null;
                      const classCharges = enrollment.student.charges.filter((charge) => charge.classId === cls.id);
                      const latestCharge = classCharges[0] ?? null;
                      const outstanding =
                        classCharges.reduce((sum, charge) => sum + charge.totalAmount, 0) -
                        classCharges.reduce(
                          (sum, charge) => sum + charge.allocations.reduce((allocationSum, allocation) => allocationSum + allocation.amount, 0),
                          0
                        );
                      const now = new Date();
                      const activeScholarship = enrollment.scholarships.find(
                        (scholarship) => scholarship.effectiveFrom <= now && (!scholarship.effectiveTo || scholarship.effectiveTo >= now)
                      );
                      const latestAttendance = enrollment.student.attendances[0] ?? null;
                      const latestBookIssue = enrollment.student.bookIssues[0] ?? null;

                      return (
                        <tr key={enrollment.id} className="border-b border-hairline align-top transition-colors hover:bg-sky-50/25 last:border-0">
                          <td className="py-2">
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
                                {enrollment.student.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <Link href={`/students/${enrollment.studentId}`} className="font-medium text-primary">
                                  {enrollment.student.fullName}
                                </Link>
                                <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full bg-[#eef5ff] px-2 py-0.5 text-[11px] font-semibold text-sky-700">{enrollment.student.studentCode}</span>
                                  {enrollment.student.lead?.leadCode ? <span className="text-xs text-ink-muted48">{enrollment.student.lead.leadCode}</span> : null}
                                </p>
                                <p className="mt-0.5 text-xs text-ink-muted48">
                                  Từ {formatDate(enrollment.enrollDate)} · {enrollment.billingModel === "COURSE" ? "Đóng trọn khóa" : enrollment.billingModel === "INSTALLMENT" ? "Trả góp theo đợt" : "Đóng theo tháng"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 text-ink-muted80">
                            <p className="font-medium text-ink">{primaryGuardian?.fullName ?? "Chưa gắn"}</p>
                            <p className="text-xs text-ink-muted48">{primaryGuardian?.phone ?? "Chưa có SĐT"}</p>
                            <p className="text-xs text-ink-muted48">{primaryGuardian?.user?.email ?? "Chưa cấp tài khoản"}</p>
                          </td>
                          <td className="py-2 text-ink-muted80">
                            {latestCharge ? (
                              <>
                                <p className="font-medium text-ink">{latestCharge.billingPeriod.periodName}</p>
                                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${outstanding > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                                  {outstanding > 0 ? `Còn nợ ${formatVnd(outstanding)}` : "Đã thanh toán"}
                                </span>
                                {activeScholarship ? <p className="mt-1 text-xs text-emerald-700">Ưu đãi {Math.round(activeScholarship.percentage * 100)}%</p> : null}
                              </>
                            ) : (
                              <span className="text-xs text-ink-muted48">Chưa sinh</span>
                            )}
                          </td>
                          <td className="py-2 text-ink-muted80">
                            {latestAttendance ? (
                              <>
                                <p className="font-medium text-ink">{attendanceLabel(latestAttendance.status)} · {formatDate(latestAttendance.session.sessionDate)}</p>
                                <p className="text-xs text-ink-muted48">{latestBookIssue ? `${latestBookIssue.book.name} · SL ${latestBookIssue.quantity}` : "Chưa phát giáo trình"}</p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-ink">Chưa có dữ liệu học</p>
                                <p className="text-xs text-ink-muted48">{latestBookIssue ? `${latestBookIssue.book.name} · SL ${latestBookIssue.quantity}` : "Chưa phát giáo trình"}</p>
                              </>
                            )}
                          </td>
                          <td className="py-2">
                            <span className={`badge ${badgeClass(enrollment.status)}`}>
                              {ENROLLMENT_STATUS_LABEL[enrollment.status as keyof typeof ENROLLMENT_STATUS_LABEL] ?? enrollment.status}
                            </span>
                          </td>
                          <td className="py-2">{canManageClass && <EnrollmentRowActions enrollmentId={enrollment.id} status={enrollment.status} />}</td>
                        </tr>
                      );
                    })}
                    {cls.enrollments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-ink-muted48">
                          Chưa có học viên ghi danh.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            key: "giaoan",
            label: "Giáo án",
            content: (
              <ClassRoadmapManager
                classId={cls.id}
                items={roadmapItems}
                totalSessions={cls.totalSessions}
                editable={canManageClass}
              />
            ),
          },
          ...(canManageClass
            ? [
                {
                  key: "cauhinh",
                  label: "Cấu hình",
                  content: (
                    <div className="space-y-5">
                      <div className="card space-y-5">
                        <SectionHeading icon={ICON_SETTINGS} title="Thiết lập lớp" description="Lịch chuẩn, nhân sự mặc định và thông tin lớp." />
                        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                          <div className="rounded-2xl bg-canvas-parchment/60 p-3">
                            <p className="text-xs text-ink-muted48">Học phí tiêu chuẩn</p>
                            <p className="mt-1 font-semibold">{cls.tuitionPerSession ? formatVnd(cls.tuitionPerSession) : "Chưa đặt"}</p>
                          </div>
                          <div className="rounded-2xl bg-canvas-parchment/60 p-3">
                            <p className="text-xs text-ink-muted48">Tạm tính toàn khóa</p>
                            <p className="mt-1 font-semibold">{estimatedClassTuition ? formatVnd(estimatedClassTuition) : "Chưa đủ dữ liệu"}</p>
                          </div>
                          <div className="rounded-2xl bg-canvas-parchment/60 p-3">
                            <p className="text-xs text-ink-muted48">Kết thúc dự kiến</p>
                            <p className="mt-1 font-semibold">{formatDate(suggestedEnd)}</p>
                          </div>
                        </div>
                        <ClassDefaultAssignmentManager classId={cls.id} employees={employees} assignments={cls.defaultAssignments} />
                        <ScheduleRuleManager classId={cls.id} rules={cls.scheduleRules} />
                      </div>
                        <ClassEditForm
                          cls={{
                            id: cls.id,
                            classCode: cls.classCode,
                            className: cls.className,
                            classGroup: cls.classGroup,
                            courseId: cls.courseId,
                          tuitionPerSession: cls.tuitionPerSession,
                          sessionsPerWeek: cls.sessionsPerWeek,
                          totalSessions: cls.totalSessions,
                            startDate: cls.startDate ? cls.startDate.toISOString() : null,
                            expectedEndDate: cls.expectedEndDate ? cls.expectedEndDate.toISOString() : null,
                            notes: cls.notes,
                            roadmapItems: roadmapItems.map((item) => ({
                              sessionNumber: item.sessionNumber,
                              title: item.title ?? `Buổi ${item.sessionNumber}`,
                              objective: item.objective ?? "",
                              materials: item.materials ?? "",
                              teacherGuide: item.teacherGuide ?? "",
                              homeworkGuide: item.homeworkGuide ?? "",
                            })),
                          }}
                          courses={courses}
                        />
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <ClassTaskManager classId={cls.id} tasks={tasks} />
                        <ClassRecurringTaskManager classId={cls.id} tasks={classTasks} />
                      </div>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
