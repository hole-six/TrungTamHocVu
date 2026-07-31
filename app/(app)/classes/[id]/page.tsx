import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  estimateEndDate,
  generateSessionDates,
  getVietnamToday,
  isSameUtcDay,
  computeSessionTiming,
  SESSION_STATUS_LABEL,
  ENROLLMENT_STATUS_LABEL,
} from "@/lib/server/class-rules";
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
import { isTaskDueOn, computeTaskLogStatus } from "@/lib/server/class-task-rules";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { ensureClassRoadmapItems } from "@/lib/server/class-roadmap";

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

export default async function ClassDetailPage({ params }: { params: { id: string } }) {
  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      scheduleRules: { orderBy: { weekday: "asc" } },
      roadmapItems: { orderBy: { sessionNumber: "asc" } },
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

  const completedSessions = cls.sessions.filter((session) => session.status === "COMPLETED").length;
  const activeEnrollments = cls.enrollments.filter((enrollment) => enrollment.status === "ACTIVE");
  const suggestedEnd = cls.expectedEndDate ?? estimateEndDate(cls.startDate, cls.totalSessions, cls.sessionsPerWeek);
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
      ? generateSessionDates(cls.scheduleRules, cls.startDate, suggestedEnd)
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
  const estimatedClassTuition =
    cls.tuitionPerSession && cls.totalSessions ? cls.tuitionPerSession * cls.totalSessions : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/classes" className="text-sm text-primary">
          ← Quay lại Lớp & Lịch
        </Link>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{cls.className}</h1>
              <span className={`badge ${badgeClass(cls.status)}`}>{cls.status === "ACTIVE" ? "Đang hoạt động" : cls.status}</span>
              {latestCompletedSession?.journal?.publishedAt ? <span className="badge bg-emerald-100 text-emerald-700">Nhật ký buổi gần nhất đã gửi</span> : null}
              {totalOutstanding > 0 ? <span className="badge bg-amber-100 text-amber-700">Còn nợ {formatVnd(totalOutstanding)}</span> : null}
            </div>
            <p className="mt-2 text-sm text-ink-muted48">
              Mã lớp: <strong>{cls.classCode}</strong>
              {cls.course ? <span> · Khóa học: {cls.course.name}</span> : null}
              {" · "}Sĩ số hoạt động: {activeEnrollments.length}
              {" · "}Buổi gần nhất: {formatDate(latestSession?.sessionDate ?? null)}
              {nextSession ? ` · Buổi tới: ${formatDate(nextSession.sessionDate)}` : ""}
            </p>
            <p className="mt-1 text-sm text-ink-muted48">
              Lịch chuẩn: {cls.scheduleRules.length ? cls.scheduleRules.map((rule) => `${weekdayLabel(rule.weekday)} ${rule.startTime}-${rule.endTime}`).join(" · ") : "Chưa cấu hình"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {latestSession ? (
              <Link
                href={`/classes/${cls.id}/sessions/${latestSession.id}`}
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0ea5e9_0%,#0284c7_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(2,132,199,0.9)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_46px_-24px_rgba(2,132,199,0.95)]"
              >
                Mở buổi học gần nhất
              </Link>
            ) : null}
            {canManageClass ? <GenerateSessionsForm classId={cls.id} /> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Sĩ số hiện tại</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{activeEnrollments.length}</p>
          <p className="mt-1 text-xs text-ink-muted48">{cls.enrollments.length} tổng enrollment</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Buổi đã học</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
            {completedSessions}
            {cls.totalSessions ? ` / ${cls.totalSessions}` : ""}
          </p>
          <p className="mt-1 text-xs text-ink-muted48">{latestSession ? `Buổi gần nhất ${SESSION_STATUS_LABEL[latestSession.status] ?? latestSession.status}` : "Chưa có buổi"}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Điểm danh buổi gần nhất</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{latestAttendanceStats.present}</p>
          <p className="mt-1 text-xs text-ink-muted48">
            Có mặt · {latestAttendanceStats.absent} vắng · {latestAttendanceStats.makeup} bù
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Công nợ lớp</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatVnd(totalOutstanding)}</p>
          <p className="mt-1 text-xs text-ink-muted48">{overdueEnrollments} học viên còn nợ</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Nhắc việc hôm nay</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{dueTodayTasks.length}</p>
          <p className="mt-1 text-xs text-ink-muted48">{openTasks.length} task mở</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Mốc lớp</p>
          <p className="mt-2 font-display text-lg font-semibold tracking-tight">{formatDate(cls.startDate)}</p>
          <p className="mt-1 text-xs text-ink-muted48">Dự kiến KT: {formatDate(suggestedEnd)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.9fr)]">
        <div className="space-y-6">
          {cls.sessions.length === 0 ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Lớp này chưa có buổi học thực tế nên chưa thể bấm đổi buổi hoặc thêm buổi bù</p>
                  <p className="mt-1 text-sm text-amber-800">
                    Trước tiên hãy bấm <strong>Sinh buổi học</strong> để tạo các buổi thực tế từ lịch chuẩn. Sau đó ở từng dòng buổi sẽ hiện rõ nút
                    <strong> Đổi buổi</strong> và <strong>Thêm buổi bù</strong>.
                  </p>
                </div>
                {canManageClass ? <GenerateSessionsForm classId={cls.id} /> : null}
              </div>
            </div>
          ) : null}

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Tổng quan vận hành lớp</h2>
                <p className="mt-1 text-sm text-ink-muted48">Một nơi để điều hành lớp: lịch, buổi học, nhân sự, học viên, học phí và nhắc việc.</p>
              </div>
              {canManageClass ? <EnrollStudentForm classId={cls.id} /> : null}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Ngữ cảnh lớp</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-ink-muted48">Khóa học</dt>
                    <dd className="text-right font-medium">{cls.course?.name ?? "Chưa gắn khóa"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-ink-muted48">Buổi/tuần · HP/buổi</dt>
                    <dd className="text-right font-medium">{cls.sessionsPerWeek ?? "—"} · {cls.tuitionPerSession ? formatVnd(cls.tuitionPerSession) : "—"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-ink-muted48">Tổng buổi · Tạm tính khóa</dt>
                    <dd className="text-right font-medium">{cls.totalSessions ?? "—"} · {estimatedClassTuition ? formatVnd(estimatedClassTuition) : "—"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-ink-muted48">Lịch học chuẩn</dt>
                    <dd className="text-right font-medium">
                      {cls.scheduleRules.length ? cls.scheduleRules.map((rule) => `${weekdayLabel(rule.weekday)} ${rule.startTime}`).join(", ") : "Chưa có"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-ink-muted48">Buổi kế tiếp</dt>
                    <dd className="text-right font-medium">{nextSession ? `${formatDate(nextSession.sessionDate)} · ${nextSession.startTime ?? "—"}` : "Chưa có"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Buổi gần nhất</p>
                {latestSession ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-ink-muted48">Ngày / trạng thái</span>
                      <span className="text-right font-medium">
                        {formatDate(latestSession.sessionDate)} · {SESSION_STATUS_LABEL[latestSession.status] ?? latestSession.status}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-ink-muted48">GV / TG thực tế</span>
                      <span className="text-right font-medium">
                        {latestSession.assignments.filter((item) => item.role === "TEACHER").map((item) => item.employee.fullName).join(", ") || "Chưa phân công"}
                        {" · "}
                        {latestSession.assignments.filter((item) => item.role !== "TEACHER").map((item) => item.employee.shortName || item.employee.fullName).join(", ") || "Không có TG"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-ink-muted48">Điểm danh / nhật ký lớp</span>
                      <span className="text-right font-medium">
                        {latestSession.attendances.length} dòng · {latestSession.journal?.publishedAt ? "Đã gửi phụ huynh" : latestSession.journal ? "Đang lưu nháp" : "Chưa có"}
                      </span>
                    </div>
                    <Link href={`/classes/${cls.id}/sessions/${latestSession.id}`} className="inline-flex text-sm font-medium text-primary">
                      Mở buổi học này →
                    </Link>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-ink-muted48">Chưa có buổi học nào.</p>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Quy tắc lịch lớp</p>
                <ul className="mt-3 space-y-2 text-sm text-ink-muted80">
                  <li>• Lịch ở đây là lịch chuẩn cố định để sinh buổi học theo tuần.</li>
                  <li>• Nếu lớp có nghỉ, dời lịch hoặc học bù thì xử lý ở từng buổi thực tế, không làm méo lịch chuẩn của cả khóa.</li>
                  <li>• Học viên học bù sang ngày khác vẫn giữ được lớp gốc và được ghi nhận ở điểm danh buổi phát sinh.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Cách nhìn tiền lớp</p>
                <ul className="mt-3 space-y-2 text-sm text-ink-muted80">
                  <li>• Mức chuẩn của lớp đang là {cls.tuitionPerSession ? formatVnd(cls.tuitionPerSession) : "—"} mỗi buổi.</li>
                  <li>• Tạm tính toàn khóa đang lấy theo công thức học phí/buổi × tổng số buổi.</li>
                  <li>• Tiền thực thu từng học viên vẫn phải theo charge, scholarship và thanh toán của chính học viên đó.</li>
                </ul>
              </div>
            </div>
          </div>

          {canManageClass ? (
            <>
              <ScheduleRuleManager classId={cls.id} rules={cls.scheduleRules} />
            </>
          ) : null}

          {projectedSchedule.length > 0 && (
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight">Lịch trình khóa học</h2>
                  <p className="mt-1 text-sm text-ink-muted48">
                    Tính thẳng từ Lịch chuẩn ({cls.scheduleRules.map((r) => weekdayLabel(r.weekday)).join(", ")}) trải từ {formatDate(cls.startDate)} đến{" "}
                    {formatDate(suggestedEnd)} — buổi nào cũng có ngày cụ thể dù hệ thống đã sinh buổi hay chưa.
                  </p>
                </div>
                <span className="badge bg-primary/10 text-primary">
                  Đã qua theo lịch: {occurredByCalendar}/{projectedSchedule.length}
                </span>
              </div>
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
            </div>
          )}

          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Danh sách buổi học</h2>
                <p className="mt-1 text-sm text-ink-muted48">Nhìn nhanh attendance, assignment và journal của từng buổi.</p>
              </div>
            </div>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Buổi</th>
                  <th className="py-2 font-medium">Ngày</th>
                  <th className="py-2 font-medium">Giờ</th>
                  <th className="py-2 font-medium">GV / TG</th>
                  <th className="py-2 font-medium">Điểm danh</th>
                  <th className="py-2 font-medium">Nhật ký lớp</th>
                  <th className="py-2 font-medium">Trạng thái</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {cls.sessions.map((session) => {
                  const present = session.attendances.filter((item) => item.status === "PRESENT").length;
                  const absent = session.attendances.filter((item) => item.status === "ABSENT").length;
                  const teacherNames = session.assignments.filter((item) => item.role === "TEACHER").map((item) => item.employee.fullName).join(", ");
                  const assistantNames = session.assignments.filter((item) => item.role !== "TEACHER").map((item) => item.employee.shortName || item.employee.fullName).join(", ");
                  const timing = computeSessionTiming(session.sessionDate, vietnamToday);
                  return (
                    <tr key={session.id} className="border-b border-hairline last:border-0 align-top">
                      <td className="py-2 font-mono text-xs text-ink-muted48">
                        {sessionNumberById.has(session.id) ? `#${sessionNumberById.get(session.id)}${cls.totalSessions ? `/${cls.totalSessions}` : ""}` : "—"}
                      </td>
                      <td className="py-2">
                        {formatDate(session.sessionDate)}
                        <p className={`text-[11px] ${timingClass(timing)}`}>{timingLabel(timing)}</p>
                      </td>
                      <td className="py-2 text-ink-muted80">{session.startTime ?? "—"}–{session.endTime ?? "—"}</td>
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
                      <td className="py-2 text-ink-muted80">{session.journal?.publishedAt ? "Đã gửi phụ huynh" : session.journal ? "Đang lưu nháp" : "Chưa có"}</td>
                      <td className="py-2">
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
                          <Link
                            href={`/classes/${cls.id}/sessions/${session.id}`}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                          >
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
                    <td colSpan={8} className="py-6 text-center text-ink-muted48">
                      <div className="flex flex-col items-center gap-3 py-2">
                        <p>Chưa có buổi học thực tế nào.</p>
                        <p className="text-xs text-ink-muted48">Bạn cần bấm "Sinh buổi học" trước, sau đó nút "Đổi buổi" và "Thêm buổi bù" mới hiện ở từng dòng buổi.</p>
                        {canManageClass ? <GenerateSessionsForm classId={cls.id} /> : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <ClassRoadmapManager
            classId={cls.id}
            items={roadmapItems}
            totalSessions={cls.totalSessions}
            editable={canManageClass}
          />

          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Danh sách học viên trong lớp</h2>
                <p className="mt-1 text-sm text-ink-muted48">Đối chất học viên, phụ huynh, scholarship, công nợ và lịch sử học gần nhất ngay trên 1 bảng.</p>
              </div>
            </div>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Học viên</th>
                  <th className="py-2 font-medium">Phụ huynh</th>
                  <th className="py-2 font-medium">Tài khoản phụ huynh</th>
                  <th className="py-2 font-medium">Ưu đãi học phí</th>
                  <th className="py-2 font-medium">Kỳ gần nhất</th>
                  <th className="py-2 font-medium">Công nợ</th>
                  <th className="py-2 font-medium">Học gần nhất</th>
                  <th className="py-2 font-medium">Sách</th>
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
                    <tr key={enrollment.id} className="border-b border-hairline last:border-0 align-top">
                      <td className="py-2">
                        <Link href={`/students/${enrollment.studentId}`} className="font-medium text-primary">
                          {enrollment.student.fullName}
                        </Link>
                        <p className="text-xs text-ink-muted48">
                          {enrollment.student.studentDisplayId ?? enrollment.student.studentCode}
                          {enrollment.student.lead?.leadCode ? ` · ${enrollment.student.lead.leadCode}` : ""}
                        </p>
                        <p className="text-xs text-ink-muted48">Từ {formatDate(enrollment.enrollDate)}</p>
                      </td>
                      <td className="py-2 text-ink-muted80">
                        <p>{primaryGuardian?.fullName ?? "Chưa gắn"}</p>
                        <p className="text-xs text-ink-muted48">{primaryGuardian?.phone ?? "Chưa có SĐT"}</p>
                      </td>
                      <td className="py-2 text-ink-muted80">
                        {primaryGuardian?.user?.email ?? "Chưa cấp"}
                        <p className="text-xs text-ink-muted48">{primaryGuardian?.user ? (primaryGuardian.user.isActive ? "Hoạt động" : "Đã thu hồi") : "Cần cấp"}</p>
                      </td>
                      <td className="py-2">
                        {activeScholarship ? (
                          <span className="badge bg-emerald-50 text-emerald-700" title={activeScholarship.reason ?? undefined}>
                            {Math.round(activeScholarship.percentage * 100)}%
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted48">Không</span>
                        )}
                      </td>
                      <td className="py-2 text-ink-muted80">
                        {latestCharge ? (
                          <>
                            <p>{latestCharge.billingPeriod.periodName}</p>
                            <p className="text-xs text-ink-muted48">{latestCharge.sessionCount} buổi · {formatVnd(latestCharge.totalAmount)}</p>
                          </>
                        ) : (
                          "Chưa sinh"
                        )}
                      </td>
                      <td className={`py-2 font-medium ${outstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatVnd(outstanding)}</td>
                      <td className="py-2 text-ink-muted80">
                        {latestAttendance ? (
                          <>
                            <p>{formatDate(latestAttendance.session.sessionDate)}</p>
                            <p className="text-xs text-ink-muted48">{attendanceLabel(latestAttendance.status)}</p>
                          </>
                        ) : (
                          "Chưa có"
                        )}
                      </td>
                      <td className="py-2 text-ink-muted80">
                        {latestBookIssue ? (
                          <>
                            <p>{latestBookIssue.book.name}</p>
                            <p className="text-xs text-ink-muted48">SL {latestBookIssue.quantity} · {latestBookIssue.paymentStatus}</p>
                          </>
                        ) : (
                          "Chưa phát"
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
                    <td colSpan={10} className="py-6 text-center text-ink-muted48">
                      Chưa có học viên ghi danh.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">Bảng điều hành lớp</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-2xl border border-hairline p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Cảnh báo lớp</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {!cls.scheduleRules.length ? <li>• Chưa cấu hình lịch học chuẩn cho lớp.</li> : null}
                  {!cls.sessions.length ? <li>• Chưa sinh buổi học — lớp chưa có dữ liệu vận hành.</li> : null}
                  {latestSession && !latestSession.assignments.length ? <li>• Buổi gần nhất chưa phân công GV/TG thực tế.</li> : null}
                  {latestSession && !latestSession.attendances.length ? <li>• Buổi gần nhất chưa điểm danh.</li> : null}
                  {latestSession && !latestSession.journal ? <li>• Buổi gần nhất chưa có journal.</li> : null}
                  {totalOutstanding > 0 ? <li>• Lớp còn tổng nợ {formatVnd(totalOutstanding)}.</li> : null}
                  {dueTodayTasks.some((task) => task.todayStatus !== "DONE_ON_TIME") ? <li>• Có nhắc việc hôm nay chưa hoàn tất đúng hạn.</li> : null}
                </ul>
              </div>

              <div className="rounded-2xl border border-hairline p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Nhắc việc hôm nay</p>
                <div className="mt-2 space-y-2">
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

              <div className="rounded-2xl border border-hairline p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Liên kết nhanh</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {latestSession ? (
                    <Link href={`/classes/${cls.id}/sessions/${latestSession.id}`} className="text-primary">
                      Điểm danh buổi gần nhất →
                    </Link>
                  ) : null}
                  <Link href="/tuition" className="text-primary">
                    Mở học phí →
                  </Link>
                  <Link href="/inventory" className="text-primary">
                    Mở giáo trình →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {canManageClass ? (
            <>
              <ClassEditForm
                cls={{
                  id: cls.id,
                  className: cls.className,
                  classGroup: cls.classGroup,
                  courseId: cls.courseId,
                  tuitionPerSession: cls.tuitionPerSession,
                  sessionsPerWeek: cls.sessionsPerWeek,
                  totalSessions: cls.totalSessions,
                  startDate: cls.startDate ? cls.startDate.toISOString() : null,
                  expectedEndDate: cls.expectedEndDate ? cls.expectedEndDate.toISOString() : null,
                  notes: cls.notes,
                }}
                courses={courses}
              />
              <ClassTaskManager classId={cls.id} tasks={tasks} />
              <ClassRecurringTaskManager classId={cls.id} tasks={classTasks} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
