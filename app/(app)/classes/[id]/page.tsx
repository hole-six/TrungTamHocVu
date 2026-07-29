import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { estimateEndDate, SESSION_STATUS_LABEL } from "@/lib/server/class-rules";
import { ENROLLMENT_STATUS_LABEL } from "@/lib/server/class-rules";
import ScheduleRuleManager from "@/components/classes/ScheduleRuleManager";
import GenerateSessionsForm from "@/components/classes/GenerateSessionsForm";
import EnrollStudentForm from "@/components/classes/EnrollStudentForm";
import EnrollmentRowActions from "@/components/classes/EnrollmentRowActions";
import ClassTaskManager from "@/components/classes/ClassTaskManager";
import ClassRecurringTaskManager from "@/components/classes/ClassRecurringTaskManager";
import { isTaskDueOn, computeTaskLogStatus } from "@/lib/server/class-task-rules";

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
}

export default async function ClassDetailPage({ params }: { params: { id: string } }) {
  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      scheduleRules: { orderBy: { weekday: "asc" } },
      sessions: { orderBy: { sessionDate: "desc" }, take: 30 },
      enrollments: { include: { student: true }, orderBy: { enrollDate: "desc" } },
    },
  });
  if (!cls) notFound();

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
  const classTasks = classTasksRaw.map((t) => {
    const dueToday = t.isActive && isTaskDueOn(t, today);
    const todayLog = t.logs.find(
      (l) =>
        l.dueDate.getFullYear() === today.getFullYear() &&
        l.dueDate.getMonth() === today.getMonth() &&
        l.dueDate.getDate() === today.getDate()
    );
    return { ...t, dueToday, todayStatus: dueToday ? computeTaskLogStatus(today, todayLog?.completedAt ?? null, today) : null };
  });

  const completedSessions = cls.sessions.filter((s) => s.status === "COMPLETED").length;
  const activeEnrollments = cls.enrollments.filter((e) => e.status === "ACTIVE");
  const suggestedEnd = cls.expectedEndDate ?? estimateEndDate(cls.startDate, cls.totalSessions, cls.sessionsPerWeek);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/classes" className="text-sm text-primary">
          ← Quay lại Lớp & Lịch
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{cls.className}</h1>
            <p className="mt-1 text-sm text-ink-muted48">
              Mã lớp: <strong>{cls.classCode}</strong> {cls.course && <>· Khóa học: {cls.course.name}</>}
            </p>
          </div>
          <span className={`badge ${cls.status === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-ink/5 text-ink-muted48"}`}>
            {cls.status === "ACTIVE" ? "Đang hoạt động" : cls.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Sĩ số hiện tại</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{activeEnrollments.length}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Buổi đã học</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
            {completedSessions}
            {cls.totalSessions ? ` / ${cls.totalSessions}` : ""}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Ngày bắt đầu</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatDate(cls.startDate)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Dự kiến kết thúc</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{formatDate(suggestedEnd)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ScheduleRuleManager classId={cls.id} rules={cls.scheduleRules} />
          <GenerateSessionsForm classId={cls.id} />

          <div className="card overflow-x-auto">
            <h2 className="font-display text-lg font-semibold tracking-tight">Buổi học gần đây</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Ngày</th>
                  <th className="py-2 font-medium">Giờ</th>
                  <th className="py-2 font-medium">Phòng</th>
                  <th className="py-2 font-medium">Trạng thái</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {cls.sessions.map((s) => (
                  <tr key={s.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(s.sessionDate)}</td>
                    <td className="py-2 text-ink-muted80">
                      {s.startTime}–{s.endTime}
                    </td>
                    <td className="py-2 text-ink-muted80">{s.room ?? "—"}</td>
                    <td className="py-2">
                      <span className="badge bg-ink/5 text-ink-muted80">{SESSION_STATUS_LABEL[s.status] ?? s.status}</span>
                    </td>
                    <td className="py-2 text-right">
                      <Link href={`/classes/${cls.id}/sessions/${s.id}`} className="text-xs text-primary">
                        Điểm danh
                      </Link>
                    </td>
                  </tr>
                ))}
                {cls.sessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-ink-muted48">
                      Chưa có buổi học nào — dùng form phía trên để sinh buổi học.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <EnrollStudentForm classId={cls.id} />

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Danh sách ghi danh</h2>
            <div className="mt-3 space-y-2">
              {cls.enrollments.map((e) => (
                <div key={e.id} className="rounded-lg border border-hairline px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <Link href={`/students/${e.studentId}`} className="font-medium text-primary">
                      {e.student.fullName}
                    </Link>
                    <span className="badge bg-ink/5 text-ink-muted80">
                      {ENROLLMENT_STATUS_LABEL[e.status as keyof typeof ENROLLMENT_STATUS_LABEL] ?? e.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-ink-muted48">
                    <span>Từ {formatDate(e.enrollDate)}</span>
                    <EnrollmentRowActions enrollmentId={e.id} status={e.status} />
                  </div>
                </div>
              ))}
              {cls.enrollments.length === 0 && <p className="text-sm text-ink-muted48">Chưa có học viên ghi danh.</p>}
            </div>
          </div>

          <ClassTaskManager classId={cls.id} tasks={tasks} />
          <ClassRecurringTaskManager classId={cls.id} tasks={classTasks} />
        </div>
      </div>
    </div>
  );
}
