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
import TransferEnrollmentButton from "@/components/classes/TransferEnrollmentButton";
import AddEnrollmentSessionsButton from "@/components/classes/AddEnrollmentSessionsButton";
import ClassTaskManager from "@/components/classes/ClassTaskManager";
import ClassRecurringTaskManager from "@/components/classes/ClassRecurringTaskManager";
import ClassQuickActions from "@/components/classes/ClassQuickActions";
import RescheduleSessionButton from "@/components/classes/RescheduleSessionButton";
import ClassDefaultAssignmentManager from "@/components/classes/ClassDefaultAssignmentManager";
import RemedialBulkAssignPanel from "@/components/classes/RemedialBulkAssignPanel";
import SessionLinkWithDrawer from "@/components/classes/SessionLinkWithDrawer";
import PageGuide from "@/components/ui/PageGuide";
import PageHero from "@/components/ui/PageHero/PageHero";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import { isTaskDueOn, computeTaskLogStatus } from "@/lib/server/class-task-rules";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { ensureClassRoadmapItems } from "@/lib/server/class-roadmap";
import { getClassAssignmentRoleType } from "@/lib/server/class-default-assignments";
import { getEnrollmentLearningSnapshot } from "@/lib/server/enrollment-learning";
import { formatVnd, formatDate } from "@/lib/export-utils";

function weekdayLabel(weekday: number) {
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][weekday] ?? String(weekday);
}
function attendanceLabel(status: string) {
  switch (status) {
    case "PRESENT": return "Có mặt";
    case "ABSENT":
    case "MAKEUP":
      return "Vắng";
    default: return status;
  }
}

function badgeClass(status: string) {
  if (status === "ACTIVE" || status === "COMPLETED" || status === "DONE_ON_TIME") return "bg-[#dcfce7] text-[#166534]";
  if (status === "UNPAID" || status === "OVERDUE" || status === "CANCELLED") return "bg-[#fee2e2] text-[#991b1b]";
  if (status === "PENDING" || status === "PLANNED") return "bg-[#fef9c3] text-[#854d0e]";
  return "bg-[#f1f5f9] text-[#475569]";
}
function timingLabel(timing: "past" | "today" | "upcoming") {
  if (timing === "past") return "Đã qua";
  if (timing === "today") return "Hôm nay";
  return "Sắp tới";
}
function timingClass(timing: "past" | "today" | "upcoming") {
  if (timing === "past") return "text-[#94a3b8]";
  if (timing === "today") return "text-[#f97316] font-semibold";
  return "text-[#64748b]";
}

function SectionHeading({ icon, eyebrow, title, description, action }: {
  icon?: ReactNode; eyebrow?: string; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff7ed] text-[#f97316]">{icon}</span> : null}
        <div>
          {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#64748b]">{eyebrow}</p> : null}
          <h2 className="text-base font-bold tracking-tight text-[#0f1729]">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[#64748b]">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const ICON_CLOCK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
const ICON_ALERT = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const ICON_CHECKLIST = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
const ICON_LINK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
const ICON_LIST = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
const ICON_USERS = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const ICON_SETTINGS = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>;

const ATTENTION_STYLE = {
  critical: { dot: "bg-red-500", text: "text-red-800", bg: "bg-red-50", border: "border-red-200" },
  warning: { dot: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200" },
  ok: { dot: "bg-emerald-500", text: "text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200" },
};
type AttentionSeverity = keyof typeof ATTENTION_STYLE;

const CLASS_DETAIL_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="class-header"]',
    title: "Mã lớp, khóa gốc và các cảnh báo quan trọng",
    description:
      "Badge \"Bổ trợ\" nghĩa là lớp isRemedial — không tự tính học phí, chỉ dùng để học viên tiêu buổi bổ trợ. Badge cam \"Nợ\" là tổng công nợ thật của TẤT CẢ học viên trong lớp cộng lại (tính động, không cộng trùng nợ cũ giữa các kỳ).",
    placement: "bottom",
  },
  {
    target: '[data-tour="class-actions"]',
    title: "Sinh buổi học — chỉ tạo đúng theo lịch cố định, không tự do",
    description:
      "\"Sinh buổi học\" chạy đúng cơ chế mà hệ thống tự làm mỗi ngày lúc 2h sáng — sinh theo đúng thứ/giờ đã khai báo, tự né ngày lễ, dừng lại đúng lúc đủ tổng số buổi cam kết. Muốn thêm 1 buổi lệch khỏi lịch chuẩn (bù riêng) thì dùng nút \"Đổi buổi\" ở từng dòng buổi học bên dưới, không phải nút này.",
    placement: "bottom",
  },
  {
    target: '[data-tour="class-kpi-completed"]',
    title: "\"Đã học\" đếm buổi COMPLETED thật, không phải buổi đã lên lịch",
    description:
      "Số này chỉ tăng khi buổi đó đã được điểm danh xong (chuyển trạng thái COMPLETED) — 1 lớp có thể đã lên lịch đủ 20 buổi nhưng số này vẫn là 0 nếu chưa ai điểm danh. Đây cũng chính là cơ sở duy nhất để tính học phí theo tháng, không dùng số buổi đã lên lịch.",
    placement: "bottom",
  },
  {
    target: '[data-tour="class-kpi-debt"]',
    title: "Công nợ toàn lớp — cộng dồn đúng, không trùng",
    description: "Tổng công nợ thật của mọi học viên trong lớp. Muốn xử lý thu tiền từng người thì vào đúng hồ sơ học viên đó, không thu gộp ở đây.",
    placement: "bottom",
  },
  {
    target: '[data-tour="class-kpi-time"]',
    title: "Ngày kết thúc dự kiến — con số tự động điều chỉnh",
    description:
      "Đây chỉ là DỰ TRÙ để theo dõi tiến độ, không phải mốc cố định — mỗi khi có buổi bị đổi lịch, huỷ, hoặc sinh muộn hơn kế hoạch (nghỉ lễ, gián đoạn...), hệ thống tự động đẩy ngày này ra cho khớp thực tế, không cần sửa tay.",
    placement: "left",
  },
  {
    target: '[data-tour="class-tabs"]',
    title: "Lịch buổi học, học viên, roadmap và checklist — tách theo tab",
    description: "Đổi buổi, điểm danh, ghi danh học viên mới, phân công giáo viên mặc định đều nằm đúng trong từng tab liên quan, không có 1 chỗ chung cho tất cả.",
    placement: "top",
  },
];

const CLASS_DETAIL_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu trang này",
    items: [
      "Đây là màn hình điều hành đầy đủ của một lớp: tổng quan, lịch buổi, học viên, roadmap và checklist vận hành.",
      "Mỗi tab trong trang lớp đại diện cho một nhóm việc riêng để dễ nhìn và dễ thao tác hơn.",
      "Nếu lớp đang chạy thực tế, nên xử lý từ đây để dữ liệu lịch, học viên và buổi học bám nhau.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách dùng nhanh",
    items: [
      "Tab Tổng quan để xem sĩ số, tiến độ lớp, ngày kết thúc dự kiến và các cảnh báo quan trọng.",
      "Tab Buổi học để đổi lịch, thêm buổi bù, điểm danh và đi vào nhật ký từng session.",
      "Tab Học viên để ghi danh, rút lớp, xem trạng thái và xử lý đúng từng học viên trong lớp.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Khi thêm buổi bù hoặc đổi lịch, ngày kết thúc dự kiến của lớp là mốc động và có thể thay đổi.",
      "Rút lớp có thể kéo theo buổi bổ trợ, credit và ảnh hưởng học phí nên không nên thao tác vội.",
      "Roadmap, giáo trình buổi học và phân công GV/TG nên được cập nhật đồng bộ để giáo viên dùng ngay.",
    ],
    tone: "warning" as const,
  },
];

export default async function ClassDetailPage({ params }: { params: { id: string } }) {
  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      nextClass: { include: { course: true } },
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
                include: {
                  allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } },
                  billingPeriod: true,
                },
                orderBy: { billingPeriod: { startDate: "desc" } },
              },
              attendances: {
                where: { session: { classId: params.id } },
                orderBy: { session: { sessionDate: "desc" } },
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

  // Danh sách học viên đang có buổi bổ trợ khả dụng (mọi lớp, không chỉ lớp này) —
  // để gán hàng loạt nhiều học viên cùng lúc vào 1 buổi tương lai của lớp bổ trợ, thay
  // vì phải mở "Gán nhập học" + "Đăng ký học bù" riêng cho từng người một.
  let remedialCandidates: { id: string; fullName: string; studentCode: string; availableCredits: number }[] = [];
  let remedialFutureSessions: { id: string; sessionDate: string; startTime: string | null; endTime: string | null }[] = [];
  if (cls.isRemedial && canManageClass) {
    const creditGroups = await prisma.sessionCredit.groupBy({
      by: ["studentId"],
      where: { status: "AVAILABLE", student: { branchId: cls.branchId } },
      _count: { _all: true },
    });
    const candidateStudents = creditGroups.length
      ? await prisma.student.findMany({
          where: { id: { in: creditGroups.map((g) => g.studentId) } },
          select: { id: true, fullName: true, studentCode: true },
          orderBy: { fullName: "asc" },
        })
      : [];
    remedialCandidates = candidateStudents.map((student) => ({
      ...student,
      availableCredits: creditGroups.find((g) => g.studentId === student.id)?._count._all ?? 0,
    }));

    const todayStart = getVietnamToday();
    remedialFutureSessions = cls.sessions
      .filter((session) => session.status !== "CANCELLED" && session.status !== "COMPLETED" && session.sessionDate >= todayStart)
      .sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime())
      .map((session) => ({
        id: session.id,
        sessionDate: session.sessionDate.toISOString(),
        startTime: session.startTime,
        endTime: session.endTime,
      }));
  }
  // Lớp để chuyển tiếp phải CÙNG khóa học (cùng nội dung) — học viên giữa khóa
  // chuyển lớp là để học tiếp cùng chương trình ở lớp khác, không phải đổi sang
  // môn/nội dung khác. Trước đây lọc theo branch+status mà thiếu courseId nên hiện
  // ra lẫn lộn mọi lớp trong cơ sở, kể cả khác hẳn nội dung.
  // KHÔNG lọc cứng theo courseId — "chuyển lớp" còn bao gồm cả trường hợp học viên
  // chuyển LÊN khóa nâng cao (khác courseId hẳn), không chỉ chuyển sang lớp khác cùng
  // nội dung. Vẫn ưu tiên hiện lớp CÙNG khóa học lên đầu danh sách (trường hợp phổ
  // biến nhất) để không quay lại tình trạng danh sách lẫn lộn ngẫu nhiên như trước.
  const continuationClassOptionsRaw = canManageClass
    ? await prisma.class.findMany({
        where: { branchId: cls.branchId, id: { not: cls.id }, status: "ACTIVE", isRemedial: false },
        include: { course: true },
        orderBy: [{ className: "asc" }, { classCode: "asc" }],
        take: 200,
      })
    : [];
  const continuationClassOptions = [...continuationClassOptionsRaw].sort(
    (a, b) => Number(b.courseId === cls.courseId) - Number(a.courseId === cls.courseId),
  );

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
    const todayLog = task.logs.find((log) =>
      log.dueDate.getFullYear() === today.getFullYear() &&
      log.dueDate.getMonth() === today.getMonth() &&
      log.dueDate.getDate() === today.getDate()
    );
    return { ...task, dueToday, todayStatus: dueToday ? computeTaskLogStatus(today, todayLog?.completedAt ?? null, today) : null };
  });

  const courses = await prisma.course.findMany({ where: { branchId: cls.branchId }, orderBy: { name: "asc" } });
  const employees = canManageClass
    ? await prisma.employee.findMany({ where: { branchId: cls.branchId, workStatus: "ACTIVE" }, orderBy: { fullName: "asc" } })
    : [];

  const completedSessions = cls.sessions.filter((s) => s.status === "COMPLETED").length;
  const activeEnrollments = cls.enrollments.filter((e) => e.status === "ACTIVE");
  const holidayDates = await getHolidayDateSet(cls.branchId);
  const suggestedEnd =
    cls.expectedEndDate ??
    estimateEndDateFromRules(cls.startDate, cls.totalSessions, cls.scheduleRules, holidayDates) ??
    estimateEndDate(cls.startDate, cls.totalSessions, cls.sessionsPerWeek);
  const nextSession = [...cls.sessions].find((s) => s.sessionDate >= today) ?? null;
  const latestSession = cls.sessions[0] ?? null;
  const latestCompletedSession = cls.sessions.find((s) => s.status === "COMPLETED") ?? latestSession ?? null;
  const vietnamToday = getVietnamToday();

  const sessionsChronological = [...cls.sessions]
    .filter((s) => s.status !== "CANCELLED")
    .sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());
  const sessionNumberById = new Map(sessionsChronological.map((s, i) => [s.id, i + 1]));

  const projectedSlots =
    cls.startDate && suggestedEnd && cls.scheduleRules.length > 0
      ? generateSessionDates(cls.scheduleRules, cls.startDate, suggestedEnd, holidayDates)
      : [];
  const projectedSchedule = (cls.totalSessions ? projectedSlots.slice(0, cls.totalSessions) : projectedSlots).map((slot, index) => ({
    number: index + 1,
    sessionDate: slot.sessionDate,
    startTime: slot.startTime,
    endTime: slot.endTime,
    timing: computeSessionTiming(slot.sessionDate, vietnamToday),
    session: cls.sessions.find((s) => isSameUtcDay(s.sessionDate, slot.sessionDate)) ?? null,
  }));
  const occurredByCalendar = projectedSchedule.filter((s) => s.timing === "past" || s.timing === "today").length;

  const latestAttendanceStats = latestCompletedSession
    ? latestCompletedSession.attendances.reduce(
        (acc, a) => {
          if (a.status === "PRESENT") acc.present += 1;
          if (a.status === "ABSENT") acc.absent += 1;
          if (a.status === "MAKEUP") acc.makeup += 1;
          return acc;
        },
        { present: 0, absent: 0, makeup: 0 }
      )
    : { present: 0, absent: 0, makeup: 0 };

  const totalOutstanding = cls.enrollments.reduce((sum, enrollment) => {
    const cc = enrollment.student.charges.filter((c) => c.classId === cls.id);
    const total = cc.reduce((s, c) => s + c.totalAmount, 0);
    const paid = cc.reduce((s, c) => s + c.allocations.reduce((ss, a) => ss + a.amount, 0), 0);
    return sum + (total - paid);
  }, 0);

  const overdueEnrollments = cls.enrollments.filter((enrollment) => {
    const cc = enrollment.student.charges.filter((c) => c.classId === cls.id);
    const total = cc.reduce((s, c) => s + c.totalAmount, 0);
    const paid = cc.reduce((s, c) => s + c.allocations.reduce((ss, a) => ss + a.amount, 0), 0);
    return total - paid > 0;
  }).length;

  const dueTodayTasks = classTasks.filter((t) => t.dueToday);

  const attentionItems: { text: string; severity: AttentionSeverity }[] = [];
  if (!cls.scheduleRules.length) attentionItems.push({ text: "Chưa cấu hình lịch học chuẩn cho lớp.", severity: "critical" });
  if (!cls.sessions.length) attentionItems.push({ text: "Chưa sinh buổi học — lớp chưa có dữ liệu vận hành.", severity: "critical" });
  if (latestSession && !latestSession.assignments.length) attentionItems.push({ text: "Buổi gần nhất chưa phân công GV/TG thực tế.", severity: "critical" });
  if (latestSession && !latestSession.attendances.length) attentionItems.push({ text: "Buổi gần nhất chưa điểm danh.", severity: "warning" });
  if (latestSession && !latestSession.journal) attentionItems.push({ text: "Buổi gần nhất chưa có journal.", severity: "warning" });
  if (totalOutstanding > 0) attentionItems.push({ text: `Lớp còn tổng nợ ${formatVnd(totalOutstanding)}.`, severity: "warning" });
  if (dueTodayTasks.some((t) => t.todayStatus !== "DONE_ON_TIME")) attentionItems.push({ text: "Có nhắc việc hôm nay chưa hoàn tất đúng hạn.", severity: "warning" });

  const estimatedClassTuition = cls.tuitionPerSession && cls.totalSessions ? cls.tuitionPerSession * cls.totalSessions : null;
  const defaultTeacherNames = cls.defaultAssignments.filter((i) => getClassAssignmentRoleType(i.role) === "TEACHER").map((i) => i.employee.fullName).join(", ");
  const defaultAssistantNames = cls.defaultAssignments.filter((i) => getClassAssignmentRoleType(i.role) === "ASSISTANT").map((i) => i.employee.shortName || i.employee.fullName).join(", ");

  // Nguồn duy nhất cho "đã học/còn lại/tiền còn lại" của từng enrollment — trước đây
  // trang này tự tính lại bằng enrollment.student.attendances (TOÀN BỘ lịch sử điểm danh
  // của học viên qua mọi lớp, không lọc theo lớp này), ra số khác với trang học viên vốn
  // đã dùng đúng getEnrollmentLearningSnapshot. Dùng chung 1 hàm để 2 trang luôn khớp số.
  const learningSnapshotByEnrollment = new Map(
    await Promise.all(
      cls.enrollments.map(async (enrollment) => [
        enrollment.id,
        await getEnrollmentLearningSnapshot(prisma, {
          ...enrollment,
          class: { totalSessions: cls.totalSessions, tuitionPerSession: cls.tuitionPerSession, nextClassId: cls.nextClassId, course: cls.course },
        }),
      ] as const)
    )
  );
  const activeLearningSnapshots = activeEnrollments.map((enrollment) => ({
    enrollment,
    snapshot: learningSnapshotByEnrollment.get(enrollment.id)!,
  }));
  const completionReadyCount = activeLearningSnapshots.filter((item) => item.snapshot.remainingMainSessions <= 0).length;
  const completionNeedTransferCount = activeLearningSnapshots.filter((item) => item.snapshot.remainingMainSessions > 0).length;
  const completionTransferValueAmount = activeLearningSnapshots.reduce(
    (sum, item) => sum + (item.snapshot.remainingMainSessions > 0 ? item.snapshot.remainingValue : 0),
    0,
  );
  const completionFreeExtraSessions = activeLearningSnapshots.reduce(
    (sum, item) => sum + (item.snapshot.remainingMainSessions > 0 ? item.snapshot.manualExtraRemainingSessions : 0),
    0,
  );

  return (
    <div className="space-y-3 sm:space-y-5 pb-16 sm:pb-20">
      <PageGuide
        title="Guide chi tiết lớp"
        summary="Giải thích nhanh các tab điều hành lớp, nơi đổi lịch, điểm danh và quản lý học viên."
        sections={CLASS_DETAIL_GUIDE_SECTIONS}
        buttonLabel="Guide lớp"
      />

      {/* ── HEADER ── */}
      <PageHero
        backHref="/classes"
        identityDataTour="class-header"
        backLabel={
          <>
            <span className="hidden sm:inline">Quay lại Lớp &amp; Lịch</span>
            <span className="sm:hidden">Lớp</span>
          </>
        }
        avatarIcon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-7 sm:h-7 md:w-8 md:h-8">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        }
        statusPill={
          <span className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wide ${cls.status === "ACTIVE" ? "bg-[#10b981] text-white" : "bg-[#64748b] text-white"}`}>
            <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-white" />
            <span className="hidden sm:inline">{cls.status === "ACTIVE" ? "ĐANG HOẠT ĐỘNG" : cls.status}</span>
            <span className="sm:hidden">{cls.status === "ACTIVE" ? "HOẠT ĐỘNG" : cls.status}</span>
          </span>
        }
        title={cls.className}
        badges={
          <>
            <span className="inline-flex items-center rounded-lg bg-[#f97316] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-white">{cls.classCode}</span>
            {cls.course && <span className="inline-flex items-center rounded-lg bg-[#ea580c] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-white truncate max-w-[120px] sm:max-w-none">{cls.course.name}</span>}
            {cls.isRemedial && <span className="inline-flex items-center rounded-lg bg-[#f97316] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-white whitespace-nowrap">Bổ trợ</span>}
            {totalOutstanding > 0 && <span className="inline-flex items-center rounded-lg bg-[#f59e0b] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-white whitespace-nowrap">Nợ {formatVnd(totalOutstanding)}</span>}
            {nextSession && (
              <span className="inline-flex items-center gap-1 sm:gap-1.5 rounded-lg bg-[#f97316] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-white whitespace-nowrap">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:w-3 sm:h-3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="hidden sm:inline">Buổi tới {formatDate(nextSession.sessionDate)}</span>
                <span className="sm:hidden">{formatDate(nextSession.sessionDate)}</span>
              </span>
            )}
          </>
        }
        actions={
          <ClassQuickActions
            classId={cls.id}
            className={cls.className}
            status={cls.status}
            latestSessionId={latestSession?.id ?? null}
            returnPath={`/classes/${cls.id}`}
            canManageClass={canManageClass}
            totalSessions={cls.totalSessions}
            existingSessionCount={cls.sessions.length}
            activeEnrollmentsCount={activeEnrollments.length}
            nextClassName={cls.nextClass?.className ?? null}
            needTransferCount={completionNeedTransferCount}
            completedCount={completionReadyCount}
            transferValueAmount={completionTransferValueAmount}
            freeExtraSessions={completionFreeExtraSessions}
            editCls={{
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
              nextClassId: cls.nextClassId,
              notes: cls.notes,
              roadmapItems: roadmapItems.map((item) => ({
                sessionNumber: item.sessionNumber,
                title: item.title ?? `Buổi ${item.sessionNumber}`,
                objective: item.objective ?? "",
                materials: item.materials ?? "",
                teacherGuide: item.teacherGuide ?? "",
                homeworkGuide: item.homeworkGuide ?? "",
                teacherRequirement: item.teacherRequirement ?? "",
              })),
            }}
            courses={courses}
            classOptions={continuationClassOptions}
            extraSlot={<SpotlightTour steps={CLASS_DETAIL_TOUR_STEPS} />}
          />
        }
      />

      {/* ── KPI 5 CARDS ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Sĩ số</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-[#0f1729] mb-0.5 sm:mb-1">{activeEnrollments.length}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b]">học sinh</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-tour="class-kpi-completed">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Đã học</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-[#0f1729] mb-0.5 sm:mb-1">{completedSessions}{cls.totalSessions ? <span className="text-sm sm:text-base md:text-lg text-[#64748b]"> / {cls.totalSessions}</span> : ""}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b] truncate">buổi hoàn thành</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-tour="class-kpi-debt">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Công nợ</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-[#0f1729] mb-0.5 sm:mb-1">{formatVnd(totalOutstanding)}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b]">{overdueEnrollments} HV nợ</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Điểm danh</p>
          <p className="text-lg sm:text-xl md:text-2xl font-black text-[#0f1729] mb-0.5 sm:mb-1">{latestAttendanceStats.present}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b]">mặt / {latestAttendanceStats.absent} vắng</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-[#e5eaf7] bg-white p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-tour="class-kpi-time">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-md border border-[#e5eaf7] mb-3 sm:mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-6 sm:h-6"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[#64748b] mb-0.5 sm:mb-1">Thời gian</p>
          <p className="text-sm sm:text-base md:text-lg font-black text-[#0f1729] mb-0.5 sm:mb-1 truncate">{formatDate(cls.startDate)}</p>
          <p className="text-[10px] sm:text-xs font-semibold text-[#64748b] truncate">đến {formatDate(suggestedEnd)}</p>
        </div>
      </div>

      {/* ── TABS ── */}
      <div data-tour="class-tabs">
      <DetailTabs
        defaultTabKey="tongquan"
        tabs={[
          {
            key: "tongquan",
            label: "Tổng quan",
            content: (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                  <SectionHeading icon={ICON_CLOCK} eyebrow="Trọng tâm" title="Buổi gần nhất"
                    action={latestSession ? (
                      <SessionLinkWithDrawer
                        sessionId={latestSession.id}
                        classId={cls.id}
                        returnPath={`/classes/${cls.id}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-[#f97316] hover:text-[#ea580c]"
                      >
                        Mở buổi <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </SessionLinkWithDrawer>
                    ) : null}
                  />
                  {latestSession ? (
                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-[#f8faff] p-4 border border-[#e5eaf7]">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Ngày học</p>
                        <p className="font-bold text-[#0f1729]">{formatDate(latestSession.sessionDate)}</p>
                        <p className="text-sm text-[#64748b] mt-1">{latestSession.startTime ?? "—"}{latestSession.endTime ? ` - ${latestSession.endTime}` : ""}</p>
                      </div>
                      <div className="rounded-xl bg-[#f8faff] p-4 border border-[#e5eaf7]">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Điểm danh</p>
                        <p className="font-bold text-[#0f1729]">{latestAttendanceStats.present} có mặt</p>
                        <p className="text-sm text-[#64748b] mt-1">{latestAttendanceStats.absent} vắng</p>
                      </div>
                      <div className="rounded-xl bg-[#f8faff] p-4 border border-[#e5eaf7]">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Nhật ký</p>
                        <p className="font-bold text-[#0f1729]">{latestSession.journal?.publishedAt ? "Đã gửi PH" : latestSession.journal ? "Đang lưu nháp" : "Chưa có"}</p>
                      </div>
                      <div className="rounded-xl bg-[#f8faff] p-4 border border-[#e5eaf7]">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Giáo viên</p>
                        <p className="font-bold text-[#0f1729] truncate">
                          {latestSession.assignments.filter((i) => getClassAssignmentRoleType(i.role) === "TEACHER").map((i) => i.employee.fullName).join(", ") || "Chưa phân công"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[#64748b] bg-[#f8faff] rounded-xl p-4 border border-[#e5eaf7]">Chưa có buổi học nào.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                  <SectionHeading icon={ICON_ALERT} title="Cần xử lý"
                    action={<span className="inline-flex items-center rounded-full bg-[#f97316] px-3 py-1 text-xs font-bold text-white">{dueTodayTasks.length} việc</span>}
                  />
                  <div className="mt-4 space-y-2">
                    {attentionItems.length === 0 ? (
                      <div className="flex items-center gap-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] px-4 py-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#10b981]" />
                        <span className="text-sm font-semibold text-[#065f46]">Hiện không có cảnh báo cần xử lý.</span>
                      </div>
                    ) : attentionItems.map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${ATTENTION_STYLE[item.severity].bg} border ${ATTENTION_STYLE[item.severity].border}`}>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${ATTENTION_STYLE[item.severity].dot}`} />
                        <span className={`text-sm font-semibold ${ATTENTION_STYLE[item.severity].text}`}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                  <SectionHeading icon={ICON_CHECKLIST} title="Việc hôm nay" description="Những việc cần chạm tay trong ngày để lớp chạy ổn." />
                  <div className="mt-4 space-y-2">
                    {dueTodayTasks.map((task) => (
                      <div key={task.id} className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] px-4 py-3 flex items-center justify-between gap-3">
                        <span className="font-semibold text-[#0f1729]">{task.title}</span>
                        {task.todayStatus ? <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${badgeClass(task.todayStatus)}`}>{task.todayStatus}</span> : null}
                      </div>
                    ))}
                    {dueTodayTasks.length === 0 && <p className="text-sm text-[#64748b] bg-[#f8faff] rounded-xl p-4 border border-[#e5eaf7]">Hôm nay chưa có việc tới hạn.</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                  <SectionHeading icon={ICON_LINK} title="Đi nhanh" description="Mở đúng khu đang cần xử lý mà không vòng qua nhiều màn." />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {latestSession && (
                      <SessionLinkWithDrawer
                        sessionId={latestSession.id}
                        classId={cls.id}
                        returnPath={`/classes/${cls.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-[#e5eaf7] bg-white px-4 py-2 text-sm font-semibold text-[#0f1729] shadow-sm hover:border-[#f97316] hover:text-[#f97316] transition-all"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        Điểm danh buổi gần nhất
                      </SessionLinkWithDrawer>
                    )}
                    <Link href="/tuition" className="inline-flex items-center gap-2 rounded-xl border-2 border-[#e5eaf7] bg-white px-4 py-2 text-sm font-semibold text-[#0f1729] shadow-sm hover:border-[#f97316] hover:text-[#f97316] transition-all">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Mở học phí
                    </Link>
                    <Link href="/inventory" className="inline-flex items-center gap-2 rounded-xl border-2 border-[#e5eaf7] bg-white px-4 py-2 text-sm font-semibold text-[#0f1729] shadow-sm hover:border-[#f97316] hover:text-[#f97316] transition-all">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
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
                <div className="rounded-2xl border border-[#e5eaf7] bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-[#e5eaf7]">
                    <SectionHeading
                      icon={ICON_LIST}
                      title="Lịch buổi học"
                      description="Một dòng là một buổi thật: học khi nào, ai dạy, đã điểm danh chưa và có nhật ký chưa."
                    />
                  </div>
                  {/* Desktop: Full 6-column table */}
                <div className="hidden lg:block overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#f8fbff] text-xs uppercase tracking-[0.18em] text-[#7b8ea5]">
                        <tr>
                          <th className="py-3 px-5 font-bold">Buổi</th>
                          <th className="py-3 px-5 font-bold">Hôm nay dạy gì</th>
                          <th className="py-3 px-5 font-bold">Người dạy</th>
                          <th className="py-3 px-5 font-bold">Điểm danh</th>
                          <th className="py-3 px-5 font-bold">Nhật ký</th>
                          <th className="py-3 px-5 font-bold text-right">Tác vụ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectedSchedule.map((slot) => {
                          const session = slot.session;
                          const roadmapItem = roadmapItems.find((item) => item.sessionNumber === slot.number) ?? null;
                          const present = session ? session.attendances.filter((a) => a.status === "PRESENT").length : 0;
                          const absent = session ? session.attendances.filter((a) => a.status === "ABSENT").length : 0;
                          const teacherNames = session
                            ? session.assignments.filter((a) => getClassAssignmentRoleType(a.role) === "TEACHER").map((a) => a.employee.fullName).join(", ")
                            : "";
                          const assistantNames = session
                            ? session.assignments.filter((a) => getClassAssignmentRoleType(a.role) === "ASSISTANT").map((a) => a.employee.shortName || a.employee.fullName).join(", ")
                            : "";
                          const timing = slot.timing;
                          return (
                            <tr key={slot.number} className="border-b border-[#eef3f9] align-top hover:bg-[#fbfdff] last:border-0 transition-colors">
                              <td className="px-5 py-5">
                                <p className="inline-flex rounded-full bg-[#eff6ff] px-3 py-1 font-mono text-xs font-bold text-[#2563eb]">#{slot.number}/{projectedSchedule.length}</p>
                                <p className="mt-2 text-base font-bold text-[#12304a]">{formatDate(slot.sessionDate)}</p>
                                <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${timingClass(timing)}`}>{timingLabel(timing)}</p>
                                <p className="mt-2 inline-flex rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-xs font-semibold text-[#4b6480]">{slot.startTime ?? "—"} – {slot.endTime ?? "—"}</p>
                                {!session ? <p className="mt-2 inline-flex rounded-full border border-[#ffe0b2] bg-[#fff8eb] px-3 py-1 text-xs font-semibold text-[#c67c14]">Chưa tạo buổi</p> : null}
                              </td>
                              <td className="px-5 py-5">
                                <p className="text-base font-bold text-[#12304a]">
                                  {roadmapItem?.title?.trim() || `Buổi ${slot.number}`}
                                </p>
                                  <p className="mt-2 text-sm leading-6 text-[#64748b]">
                                    {roadmapItem?.objective?.trim() || "Chưa có mục tiêu hoặc ghi chú dạy cho buổi này."}
                                  </p>
                                {roadmapItem?.materials?.trim() ? (
                                  <p className="mt-3 inline-flex rounded-2xl border border-[#e8eef8] bg-[#f8fbff] px-3 py-2 text-xs font-medium text-[#0f1729]">
                                    Tài liệu: <span className="ml-1 text-[#64748b]">{roadmapItem.materials}</span>
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-5 py-5">
                                <p className="text-base font-bold text-[#12304a]">{teacherNames || "Chưa phân công GV"}</p>
                                <p className="mt-2 inline-flex rounded-full border border-[#e8eef8] bg-[#f8fbff] px-3 py-1 text-xs font-semibold text-[#64748b]">{assistantNames || "Không có trợ giảng"}</p>
                              </td>
                              <td className="px-5 py-5">
                                {session && session.attendances.length ? (
                                  <div className="space-y-2">
                                    <p className="inline-flex rounded-full bg-[#ecfdf3] px-3 py-1 text-sm font-bold text-[#15803d]">{present} có mặt</p>
                                    <p className="inline-flex rounded-full bg-[#fff1f2] px-3 py-1 text-xs font-semibold text-[#e11d48]">{absent} vắng</p>
                                  </div>
                                ) : <p className="inline-flex rounded-2xl border border-[#e8eef8] bg-[#f8fbff] px-3 py-2 text-sm font-semibold text-[#7b8ea5]">{session ? "Chưa điểm danh" : "Chưa có buổi"}</p>}
                              </td>
                              <td className="px-5 py-5">
                                {session ? (
                                  <div className="space-y-2">
                                    <p className="inline-flex rounded-2xl border border-[#e8eef8] bg-white px-3 py-2 text-sm font-semibold text-[#64748b]">{session.journal?.publishedAt ? "Đã gửi PH" : session.journal ? "Đang lưu nháp" : "Chưa có nhật ký"}</p>
                                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${badgeClass(session.status)}`}>{SESSION_STATUS_LABEL[session.status] ?? session.status}</span>
                                    {session.status === "RESCHEDULED" && session.replacedBySession && (
                                      <p className="mt-2 text-xs text-[#f59e0b] font-semibold">
                                        Bù sang{" "}
                                        <SessionLinkWithDrawer
                                          sessionId={session.replacedBySession.id}
                                          classId={cls.id}
                                          returnPath={`/classes/${cls.id}`}
                                          className="underline cursor-pointer"
                                        >
                                          {formatDate(session.replacedBySession.sessionDate)}
                                        </SessionLinkWithDrawer>
                                      </p>
                                    )}
                                    {session.replacesSession ? <p className="mt-2 text-xs text-[#64748b]">Buổi bù cho {formatDate(session.replacesSession.sessionDate)}</p> : null}
                                  </div>
                                ) : (
                                  <p className="text-sm text-[#94a3b8]">Chưa có trạng thái.</p>
                                )}
                              </td>
                              <td className="px-5 py-5 text-right">
                                {session ? (
                                  <div className="flex flex-col items-end gap-2">
                                    <SessionLinkWithDrawer
                                      sessionId={session.id}
                                      classId={cls.id}
                                      returnPath={`/classes/${cls.id}`}
                                      className="inline-flex min-w-[140px] items-center justify-center rounded-xl bg-[#0ea5e9] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#0284c7]"
                                    >
                                      Điểm danh / nhật ký
                                    </SessionLinkWithDrawer>
                                    {canManageClass && session.status !== "CANCELLED" && session.status !== "RESCHEDULED" && !session.replacedBySession ? <RescheduleSessionButton sessionId={session.id} sessionDateLabel={formatDate(session.sessionDate)} /> : null}
                                  </div>
                                ) : canManageClass ? (
                                  <span className="text-xs text-[#f59e0b] font-semibold">Sinh buổi trước</span>
                                ) : <span className="text-xs text-[#94a3b8]">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {projectedSchedule.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-12 text-center">
                              <div className="flex flex-col items-center gap-4">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f8faff]">
                                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                </div>
                                <div>
                                  <p className="font-bold text-[#0f1729] mb-2">Chưa có buổi học thực tế nào</p>
                                  <p className="text-sm text-[#64748b] mb-4">Bấm <strong>Sinh buổi học</strong> để tạo buổi từ lịch chuẩn</p>
                                  {canManageClass && (
                    <GenerateSessionsForm classId={cls.id} totalSessions={cls.totalSessions} existingSessionCount={cls.sessions.length} />
                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                {/* Mobile/Tablet: Compact horizontal layout */}
                <div className="lg:hidden space-y-2 p-4">
                  {projectedSchedule.map((slot) => {
                    const session = slot.session;
                    const roadmapItem = roadmapItems.find((item) => item.sessionNumber === slot.number) ?? null;
                    const present = session ? session.attendances.filter((a) => a.status === "PRESENT").length : 0;
                    const absent = session ? session.attendances.filter((a) => a.status === "ABSENT").length : 0;
                    const teacherNames = session
                      ? session.assignments.filter((a) => getClassAssignmentRoleType(a.role) === "TEACHER").map((a) => a.employee.fullName).join(", ")
                      : "";
                    const assistantNames = session
                      ? session.assignments.filter((a) => getClassAssignmentRoleType(a.role) === "ASSISTANT").map((a) => a.employee.shortName || a.employee.fullName).join(", ")
                      : "";
                    const timing = slot.timing;

                    return (
                      <div key={slot.number} className="rounded-xl border border-[#e5eaf7] bg-white p-3 shadow-sm">
                        {/* Header row - Session info + Status */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="inline-flex shrink-0 rounded-full bg-[#eff6ff] px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563eb]">
                              #{slot.number}
                            </span>
                            <span className="text-sm font-bold text-[#12304a] truncate">{formatDate(slot.sessionDate)}</span>
                            <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${timingClass(timing)}`}>
                              {timingLabel(timing)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {session ? (
                              <>
                                <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${badgeClass(session.status)}`}>
                                  {SESSION_STATUS_LABEL[session.status] ?? session.status}
                                </span>
                              </>
                            ) : (
                              <span className="inline-flex rounded-md border border-[#ffe0b2] bg-[#fff8eb] px-1.5 py-0.5 text-[10px] font-semibold text-[#c67c14]">
                                Chưa tạo
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Time + Topic row */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#64748b]">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              {slot.startTime ?? "—"} – {slot.endTime ?? "—"}
                            </span>
                            <p className="mt-0.5 text-xs font-medium text-[#12304a] line-clamp-1">
                              {roadmapItem?.title?.trim() || `Buổi ${slot.number}`}
                            </p>
                          </div>
                        </div>

                        {/* Teacher + Attendance row */}
                        <div className="flex items-center justify-between gap-2 text-[11px] mb-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-[#64748b]">GV: </span>
                            <span className="font-medium text-[#12304a] truncate">{teacherNames || "Chưa phân công"}</span>
                          </div>
                          {session && session.attendances.length ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#ecfdf3] px-1.5 py-0.5 text-[10px] font-bold text-[#15803d]">
                                ✓ {present}
                              </span>
                              {absent > 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#fff1f2] px-1.5 py-0.5 text-[10px] font-bold text-[#e11d48]">
                                  ✗ {absent}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#94a3b8] text-[10px]">{session ? "Chưa điểm danh" : "—"}</span>
                          )}
                        </div>

                        {/* Action buttons row */}
                        <div className="flex items-center gap-2 pt-2 border-t border-[#f1f5f9]">
                          {session ? (
                            <>
                              <SessionLinkWithDrawer
                                sessionId={session.id}
                                classId={cls.id}
                                returnPath={`/classes/${cls.id}`}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#0ea5e9] px-3 py-2 text-xs font-bold text-white hover:bg-[#0284c7] transition-colors"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                </svg>
                                Mở buổi
                              </SessionLinkWithDrawer>
                              {canManageClass && session.status !== "CANCELLED" && session.status !== "RESCHEDULED" && !session.replacedBySession && (
                                <div className="shrink-0">
                                  <RescheduleSessionButton sessionId={session.id} sessionDateLabel={formatDate(session.sessionDate)} />
                                </div>
                              )}
                            </>
                          ) : canManageClass ? (
                            <p className="flex-1 text-center text-[11px] text-[#f59e0b] font-semibold py-1">Sinh buổi trước</p>
                          ) : (
                            <p className="flex-1 text-center text-[11px] text-[#94a3b8] py-1">—</p>
                          )}
                        </div>

                        {/* Reschedule info if applicable */}
                        {session && session.status === "RESCHEDULED" && session.replacedBySession && (
                          <div className="mt-2 pt-2 border-t border-[#f1f5f9]">
                            <p className="text-[10px] text-[#f59e0b] font-medium">
                              → Bù sang{" "}
                              <SessionLinkWithDrawer
                                sessionId={session.replacedBySession.id}
                                classId={cls.id}
                                returnPath={`/classes/${cls.id}`}
                                className="underline font-semibold cursor-pointer"
                              >
                                {formatDate(session.replacedBySession.sessionDate)}
                              </SessionLinkWithDrawer>
                            </p>
                          </div>
                        )}
                        {session && session.replacesSession && (
                          <div className="mt-2 pt-2 border-t border-[#f1f5f9]">
                            <p className="text-[10px] text-[#64748b]">← Buổi bù cho {formatDate(session.replacesSession.sessionDate)}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {projectedSchedule.length === 0 && (
                    <div className="py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f8faff]">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-[#0f1729] mb-2">Chưa có buổi học thực tế nào</p>
                          <p className="text-sm text-[#64748b] mb-4">Bấm <strong>Sinh buổi học</strong> để tạo buổi từ lịch chuẩn</p>
                          {canManageClass && (
                    <GenerateSessionsForm classId={cls.id} totalSessions={cls.totalSessions} existingSessionCount={cls.sessions.length} />
                  )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
            ),
          },

          {
            key: "hocvien",
            label: "Học viên",
            content: (
              <div className="rounded-2xl border border-[#e5eaf7] bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-[#e5eaf7] flex items-center justify-between">
                  <SectionHeading
                    icon={ICON_USERS}
                    title="Học viên trong lớp"
                    description="Theo dõi nhanh trạng thái học, phí đang treo và xử lý rút lớp ngay tại đây."
                  />
                  {canManageClass && (
                    <EnrollStudentForm
                      classId={cls.id}
                      courseTotalAmount={(cls.tuitionPerSession ?? 0) * (cls.totalSessions ?? 0)}
                      defaultMainSessionCount={cls.totalSessions ?? 0}
                      defaultUnitPrice={cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0}
                    />
                  )}
                </div>
                {cls.isRemedial && canManageClass ? (
                  <div className="px-6 pt-4">
                    <RemedialBulkAssignPanel classId={cls.id} candidates={remedialCandidates} futureSessions={remedialFutureSessions} />
                  </div>
                ) : null}
                {/* Desktop: Full 5-column table */}
                <div className="hidden lg:block overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#f8faff] text-xs uppercase tracking-wide text-[#64748b]">
                      <tr>
                        <th className="py-3 px-5 font-bold">Học viên</th>
                        <th className="py-3 px-5 font-bold">Phụ huynh</th>
                        <th className="py-3 px-5 font-bold">Phí đang treo</th>
                        <th className="py-3 px-5 font-bold">Cập nhật gần nhất</th>
                        <th className="py-3 px-5 font-bold text-right">Tác vụ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cls.enrollments.map((enrollment) => {
                        const primaryGuardian = enrollment.student.guardians.find((g) => g.isPrimary)?.guardian ?? enrollment.student.guardians[0]?.guardian ?? null;
                        const classCharges = enrollment.student.charges.filter((c) => c.classId === cls.id);
                        const latestCharge = classCharges[0] ?? null;
                        const outstanding = classCharges.reduce((s, c) => s + c.totalAmount, 0) - classCharges.reduce((s, c) => s + c.allocations.reduce((ss, a) => ss + a.amount, 0), 0);
                        const now = new Date();
                        const activeScholarship = enrollment.scholarships.find((sc) => sc.effectiveFrom <= now && (!sc.effectiveTo || sc.effectiveTo >= now));
                        const latestAttendance = enrollment.student.attendances[0] ?? null;
                        const latestBookIssue = enrollment.student.bookIssues[0] ?? null;
                        const snapshot = learningSnapshotByEnrollment.get(enrollment.id)!;
                        const purchasedMainSessions = snapshot.entitledMainSessions;
                        const unitPrice = snapshot.unitPrice;
                        const attendedMainSessions = snapshot.completedMainSessions;
                        const remainingMainSessions = snapshot.remainingMainSessions;
                        const remainingMainValue = snapshot.remainingValue;
                        return (
                          <tr key={enrollment.id} className="border-b border-[#f0f4f8] align-top hover:bg-[#f8faff] last:border-0 transition-colors">
                            <td className="py-4 px-5">
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-sm font-bold text-white shadow-md">
                                  {enrollment.student.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <Link href={`/students/${enrollment.studentId}`} className="font-bold text-[#f97316] hover:text-[#ea580c]">{enrollment.student.fullName}</Link>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="rounded-lg bg-[#f97316] px-2 py-0.5 text-xs font-bold text-white">{enrollment.student.studentCode}</span>
                                    <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-bold ${badgeClass(enrollment.status)}`}>
                                      {ENROLLMENT_STATUS_LABEL[enrollment.status as keyof typeof ENROLLMENT_STATUS_LABEL] ?? enrollment.status}
                                    </span>
                                    <span className="rounded-lg bg-[#eef6ff] px-2 py-0.5 text-xs font-semibold text-[#2563eb]">
                                      {enrollment.billingModel === "COURSE" ? "Theo khóa" : enrollment.billingModel === "INSTALLMENT" ? "Trả góp" : "Theo tháng"}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-[#64748b]">Vào lớp từ {formatDate(enrollment.enrollDate)}</p>
                                  <p className="mt-1 text-xs font-semibold text-[#2563eb]">
                                    Đã học {attendedMainSessions}/{purchasedMainSessions} · còn {remainingMainSessions} buổi · {formatVnd(remainingMainValue)}
                                  </p>
                                  {snapshot.manualExtraSessions > 0 ? (
                                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                                      Có {snapshot.manualExtraSessions} buổi cộng linh động
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-5">
                              <p className="font-semibold text-[#0f1729]">{primaryGuardian?.fullName ?? "Chưa gắn"}</p>
                              <p className="text-xs text-[#64748b] mt-1">{primaryGuardian?.phone ?? "Chưa có SĐT"}</p>
                              <p className="text-xs text-[#64748b] mt-0.5">{primaryGuardian?.user?.email ?? "Chưa có portal"}</p>
                            </td>
                            <td className="py-4 px-5">
                              {latestCharge ? (
                                <div className="space-y-1.5">
                                  <p className="font-semibold text-[#0f1729]">{outstanding > 0 ? formatVnd(outstanding) : "0đ"}</p>
                                  <p className="text-xs text-[#64748b]">{latestCharge.billingPeriod.periodName}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${outstanding > 0 ? "bg-[#fee2e2] text-[#991b1b]" : "bg-[#d1fae5] text-[#065f46]"}`}>
                                      {outstanding > 0 ? "Còn phải thu" : "Đã thu hết"}
                                    </span>
                                    {activeScholarship ? (
                                      <span className="inline-flex rounded-lg bg-[#ecfdf5] px-2.5 py-1 text-xs font-bold text-[#047857]">
                                        HB {Math.round(activeScholarship.percentage * 100)}%
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              ) : <span className="text-sm text-[#94a3b8]">Chưa sinh</span>}
                            </td>
                            <td className="py-4 px-5">
                              <div className="space-y-1.5">
                                <p className="font-semibold text-[#0f1729]">{latestAttendance ? attendanceLabel(latestAttendance.status) : "Chưa điểm danh"}</p>
                                <p className="text-xs text-[#64748b]">{latestAttendance ? formatDate(latestAttendance.session.sessionDate) : "Chưa có buổi gần nhất"}</p>
                                <p className="text-xs text-[#64748b]">{latestBookIssue ? `${latestBookIssue.book.name} · SL ${latestBookIssue.quantity}` : "Chưa phát sách"}</p>
                              </div>
                            </td>
                            <td className="py-4 px-5">
                              <div className="flex justify-end">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Link
                                    href={`/students/${enrollment.studentId}`}
                                    className="inline-flex min-w-[104px] items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100"
                                  >
                                    Mở hồ sơ
                                  </Link>
                                  {canManageClass ? <EnrollmentRowActions enrollmentId={enrollment.id} status={enrollment.status} /> : null}
                                  {canManageClass && enrollment.status === "ACTIVE" ? (
                                    <AddEnrollmentSessionsButton enrollmentId={enrollment.id} studentName={enrollment.student.fullName} />
                                  ) : null}
                                  {canManageClass && enrollment.status === "ACTIVE" && remainingMainSessions > 0 ? (
                                    <TransferEnrollmentButton
                                      enrollmentId={enrollment.id}
                                      currentClassName={cls.className}
                                      currentCourseId={cls.courseId}
                                      remainingSessions={remainingMainSessions}
                                      paidRemainingSessions={snapshot.paidRemainingSessions}
                                      manualExtraRemainingSessions={snapshot.manualExtraRemainingSessions}
                                      oldUnitPrice={unitPrice}
                                      scholarshipPct={snapshot.scholarshipPct}
                                      defaultTargetClassId={cls.nextClassId}
                                      classOptions={continuationClassOptions}
                                    />
                                  ) : null}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {cls.enrollments.length === 0 && (
                        <tr><td colSpan={5} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f8faff]">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                            </div>
                            <p className="font-bold text-[#0f1729]">Chưa có học viên ghi danh</p>
                          </div>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile/Tablet: Card view */}
                <div className="lg:hidden space-y-3 p-4">
                  {cls.enrollments.map((enrollment) => {
                    const primaryGuardian = enrollment.student.guardians.find((g) => g.isPrimary)?.guardian ?? enrollment.student.guardians[0]?.guardian ?? null;
                    const classCharges = enrollment.student.charges.filter((c) => c.classId === cls.id);
                    const latestCharge = classCharges[0] ?? null;
                    const outstanding = classCharges.reduce((s, c) => s + c.totalAmount, 0) - classCharges.reduce((s, c) => s + c.allocations.reduce((ss, a) => ss + a.amount, 0), 0);
                    const now = new Date();
                    const activeScholarship = enrollment.scholarships.find((sc) => sc.effectiveFrom <= now && (!sc.effectiveTo || sc.effectiveTo >= now));
                    const latestAttendance = enrollment.student.attendances[0] ?? null;
                    const latestBookIssue = enrollment.student.bookIssues[0] ?? null;
                    const snapshot = learningSnapshotByEnrollment.get(enrollment.id)!;
                    const purchasedMainSessions = snapshot.entitledMainSessions;
                    const unitPrice = snapshot.unitPrice;
                    const attendedMainSessions = snapshot.completedMainSessions;
                    const remainingMainSessions = snapshot.remainingMainSessions;
                    const remainingMainValue = snapshot.remainingValue;

                    return (
                      <div key={enrollment.id} className="rounded-2xl border border-[#e5eaf7] bg-white p-4 shadow-sm">
                        {/* Student Header with Avatar & Name */}
                        <div className="flex items-start gap-3 mb-3 pb-3 border-b border-[#e5eaf7]">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-base font-bold text-white shadow-md">
                            {enrollment.student.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={`/students/${enrollment.studentId}`} className="font-bold text-[#f97316] hover:text-[#ea580c] block">
                              {enrollment.student.fullName}
                            </Link>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-lg bg-[#f97316] px-2 py-0.5 text-xs font-bold text-white">
                                {enrollment.student.studentCode}
                              </span>
                              <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-bold ${badgeClass(enrollment.status)}`}>
                                {ENROLLMENT_STATUS_LABEL[enrollment.status as keyof typeof ENROLLMENT_STATUS_LABEL] ?? enrollment.status}
                              </span>
                              <span className="rounded-lg bg-[#eef6ff] px-2 py-0.5 text-xs font-semibold text-[#2563eb]">
                                {enrollment.billingModel === "COURSE" ? "Theo khóa" : enrollment.billingModel === "INSTALLMENT" ? "Trả góp" : "Theo tháng"}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs text-[#64748b]">Vào lớp từ {formatDate(enrollment.enrollDate)}</p>
                            <p className="mt-1 text-xs font-semibold text-[#2563eb]">
                              Đã học {attendedMainSessions}/{purchasedMainSessions} · còn {remainingMainSessions} buổi · {formatVnd(remainingMainValue)}
                            </p>
                            {snapshot.manualExtraSessions > 0 ? (
                              <p className="mt-1 text-xs font-semibold text-emerald-700">
                                Có {snapshot.manualExtraSessions} buổi cộng linh động
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* Guardian Info */}
                        <div className="mb-3 pb-3 border-b border-[#e5eaf7]">
                          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-1.5">Phụ huynh</p>
                          <p className="font-semibold text-[#0f1729] text-sm">{primaryGuardian?.fullName ?? "Chưa gắn"}</p>
                          <p className="text-xs text-[#64748b] mt-1">{primaryGuardian?.phone ?? "Chưa có SĐT"}</p>
                          <p className="text-xs text-[#64748b] mt-0.5 truncate">{primaryGuardian?.user?.email ?? "Chưa có portal"}</p>
                        </div>

                        {/* Outstanding Balance */}
                        <div className="mb-3 pb-3 border-b border-[#e5eaf7]">
                          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-1.5">Phí đang treo</p>
                          {latestCharge ? (
                            <div className="space-y-2">
                              <div className="flex items-baseline justify-between">
                                <p className="font-bold text-[#0f1729]">{outstanding > 0 ? formatVnd(outstanding) : "0đ"}</p>
                                <p className="text-xs text-[#64748b]">{latestCharge.billingPeriod.periodName}</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${outstanding > 0 ? "bg-[#fee2e2] text-[#991b1b]" : "bg-[#d1fae5] text-[#065f46]"}`}>
                                  {outstanding > 0 ? "Còn phải thu" : "Đã thu hết"}
                                </span>
                                {activeScholarship && (
                                  <span className="inline-flex rounded-lg bg-[#ecfdf5] px-2.5 py-1 text-xs font-bold text-[#047857]">
                                    HB {Math.round(activeScholarship.percentage * 100)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-[#94a3b8]">Chưa sinh</span>
                          )}
                        </div>

                        {/* Latest Activity */}
                        <div className="mb-3 pb-3 border-b border-[#e5eaf7]">
                          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-1.5">Cập nhật gần nhất</p>
                          <div className="space-y-1">
                            <p className="font-semibold text-[#0f1729] text-sm">
                              {latestAttendance ? attendanceLabel(latestAttendance.status) : "Chưa điểm danh"}
                            </p>
                            <p className="text-xs text-[#64748b]">
                              {latestAttendance ? formatDate(latestAttendance.session.sessionDate) : "Chưa có buổi gần nhất"}
                            </p>
                            <p className="text-xs text-[#64748b]">
                              {latestBookIssue ? `${latestBookIssue.book.name} · SL ${latestBookIssue.quantity}` : "Chưa phát sách"}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          <Link
                            href={`/students/${enrollment.studentId}`}
                            className="flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                            </svg>
                            Mở hồ sơ học viên
                          </Link>
                          {canManageClass && <EnrollmentRowActions enrollmentId={enrollment.id} status={enrollment.status} />}
                          {canManageClass && enrollment.status === "ACTIVE" ? (
                            <AddEnrollmentSessionsButton enrollmentId={enrollment.id} studentName={enrollment.student.fullName} />
                          ) : null}
                          {canManageClass && enrollment.status === "ACTIVE" && remainingMainSessions > 0 ? (
                            <TransferEnrollmentButton
                              enrollmentId={enrollment.id}
                              currentClassName={cls.className}
                              currentCourseId={cls.courseId}
                              remainingSessions={remainingMainSessions}
                              paidRemainingSessions={snapshot.paidRemainingSessions}
                              manualExtraRemainingSessions={snapshot.manualExtraRemainingSessions}
                              oldUnitPrice={unitPrice}
                              scholarshipPct={snapshot.scholarshipPct}
                              defaultTargetClassId={cls.nextClassId}
                              classOptions={continuationClassOptions}
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {cls.enrollments.length === 0 && (
                    <div className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f8faff]">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                          </svg>
                        </div>
                        <p className="font-bold text-[#0f1729]">Chưa có học viên ghi danh</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ),
          },

          ...(canManageClass
            ? [
                {
                  key: "cauhinh",
                  label: "Cấu hình",
                  content: (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                        <SectionHeading icon={ICON_SETTINGS} title="Thiết lập lớp" description="Lịch chuẩn, nhân sự mặc định và thông tin lớp." />
                        <div className="mt-5 grid grid-cols-3 gap-4">
                          <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Học phí tiêu chuẩn</p>
                            <p className="text-lg font-black text-[#0f1729]">{cls.tuitionPerSession ? formatVnd(cls.tuitionPerSession) : "Chưa đặt"}</p>
                          </div>
                          <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Tạm tính toàn khóa</p>
                            <p className="text-lg font-black text-[#0f1729]">{estimatedClassTuition ? formatVnd(estimatedClassTuition) : "Chưa đủ dữ liệu"}</p>
                          </div>
                          <div className="rounded-xl bg-[#f8faff] border border-[#e5eaf7] p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Kết thúc dự kiến</p>
                            <p className="text-lg font-black text-[#0f1729]">{formatDate(suggestedEnd)}</p>
                          </div>
                        </div>
                        <div className="mt-5">
                          <ClassDefaultAssignmentManager classId={cls.id} employees={employees} assignments={cls.defaultAssignments} />
                        </div>
                        <div className="mt-5">
                          <ScheduleRuleManager classId={cls.id} rules={cls.scheduleRules} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                        <ClassRecurringTaskManager classId={cls.id} tasks={classTasks} />
                        <ClassTaskManager classId={cls.id} tasks={tasks} />
                      </div>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
      </div>
    </div>
  );
}
