import Link from "next/link";
import { notFound } from "next/navigation";
import AttendanceForm from "@/components/classes/AttendanceForm";
import ClassJournalForm from "@/components/classes/ClassJournalForm";
import SessionAssignmentForm from "@/components/classes/SessionAssignmentForm";
import { prisma } from "@/lib/prisma";
import { getUserRole } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/current-user";
import { canUpdate } from "@/lib/server/role-matrix";

function attendanceLabel(status: string) {
  switch (status) {
    case "PRESENT":
      return "Có mặt";
    case "ABSENT":
      return "Vắng";
    case "MAKEUP":
      return "Học bù";
    case "EXCUSED":
      return "Vắng có phép";
    default:
      return status;
  }
}

export default async function SessionAttendancePage({ params }: { params: { id: string; sessionId: string } }) {
  const session = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: {
      class: {
        include: {
          branch: true,
          roadmapItems: { orderBy: { sessionNumber: "asc" } },
          sessions: {
            where: { status: { not: "CANCELLED" } },
            orderBy: { sessionDate: "asc" },
            select: { id: true, sessionDate: true },
          },
        },
      },
      attendances: true,
      assignments: {
        include: {
          employee: true,
          substituteFor: { select: { id: true, employee: { select: { fullName: true } } } },
          substitutedBy: { select: { id: true, employee: { select: { fullName: true } } } },
        },
      },
      journal: { include: { entries: { include: { scores: true, student: true } } } },
    },
  });

  if (!session || session.classId !== params.id) notFound();

  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const canManageClass = canUpdate("schedule", role);
  const canTeachSession = canManageClass || role === "TEACHER" || role === "TEACHING_ASSISTANT";

  const [activeEnrollments, employees] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classId: session.classId, status: "ACTIVE" },
      include: { student: true },
      orderBy: { student: { fullName: "asc" } },
    }),
    prisma.employee.findMany({
      where: { branchId: session.class.branchId },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const attendanceByStudent = Object.fromEntries(session.attendances.map((attendance) => [attendance.studentId, attendance.status]));
  const sessionNumber =
    session.class.sessions.findIndex((item) => item.id === session.id) >= 0
      ? session.class.sessions.findIndex((item) => item.id === session.id) + 1
      : null;
  const roadmapItem =
    sessionNumber != null ? session.class.roadmapItems.find((item) => item.sessionNumber === sessionNumber) ?? null : null;
  const roster = activeEnrollments.map((enrollment) => ({
    studentId: enrollment.studentId,
    fullName: enrollment.student.fullName,
    studentCode: enrollment.student.studentCode,
    status: attendanceByStudent[enrollment.studentId] ?? "PRESENT",
  }));

  const presentCount = roster.filter((student) => student.status === "PRESENT").length;
  const absentCount = roster.filter((student) => student.status === "ABSENT").length;
  const makeupCount = roster.filter((student) => student.status === "MAKEUP").length;
  const excusedCount = roster.filter((student) => student.status === "EXCUSED").length;
  const weekdayLabels = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  const sessionDate = new Date(session.sessionDate);
  const weekdayLabel = weekdayLabels[sessionDate.getDay()] ?? "";
  const scheduleLabel = `${weekdayLabel} · ${session.startTime}-${session.endTime}${session.room ? ` · ${session.room}` : ""}`;

  return (
    <div className="page-shell">
      <div className="space-y-4">
        <Link href={`/classes/${session.classId}`} className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại {session.class.className}
        </Link>

        <div className="overflow-hidden rounded-[32px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f8fcff_0%,#eef7ff_48%,#ffffff_100%)] p-6 shadow-[0_24px_70px_-42px_rgba(14,116,144,0.35)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                Buổi học thực tế
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  Mở buổi học · {new Date(session.sessionDate).toLocaleDateString("vi-VN")}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted80 sm:text-base">
                  Chốt 3 việc của buổi học này: dạy đúng nội dung, điểm danh đúng người học và ghi đúng nhật ký gửi phụ huynh sau buổi học.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Thời gian</p>
                <p className="mt-2 text-lg font-semibold text-ink">{session.startTime} - {session.endTime}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Phòng học</p>
                <p className="mt-2 text-lg font-semibold text-ink">{session.room || "Chưa gán phòng"}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Học viên</p>
                <p className="mt-2 text-lg font-semibold text-ink">{roster.length} bạn</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Nhân sự</p>
                <p className="mt-2 text-lg font-semibold text-ink">{session.assignments.length} người</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-[#d7ecff] bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Có mặt</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">{presentCount}</p>
            </div>
            <div className="rounded-2xl border border-[#d7ecff] bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Vắng</p>
              <p className="mt-2 text-2xl font-semibold text-rose-500">{absentCount}</p>
            </div>
            <div className="rounded-2xl border border-[#d7ecff] bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Học bù</p>
              <p className="mt-2 text-2xl font-semibold text-sky-600">{makeupCount}</p>
            </div>
            <div className="rounded-2xl border border-[#d7ecff] bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Vắng có phép</p>
              <p className="mt-2 text-2xl font-semibold text-amber-600">{excusedCount}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-[24px] border border-[#d7ecff] bg-white/85 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Buổi trong lộ trình</p>
              <p className="mt-2 text-2xl font-semibold text-ink">
                {sessionNumber ? `Buổi ${sessionNumber}${session.class.totalSessions ? ` / ${session.class.totalSessions}` : ""}` : "Chưa xác định"}
              </p>
              <p className="mt-1 text-sm text-ink-muted48">
                {roadmapItem?.title?.trim() || "Chưa khai báo tên bài cho buổi này."}
              </p>
            </div>
            <div className="rounded-[24px] border border-[#d7ecff] bg-white/90 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Kim chỉ nam buổi học hôm nay</p>
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted48">Mục tiêu</p>
                  <p className="mt-1 text-sm leading-6 text-ink">{roadmapItem?.objective?.trim() || "Chưa có mục tiêu buổi học."}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted48">Tài liệu</p>
                  <p className="mt-1 text-sm leading-6 text-ink">{roadmapItem?.materials?.trim() || "Chưa khai báo tài liệu / học cụ."}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted48">Gợi ý dạy & dặn dò</p>
                  <p className="mt-1 text-sm leading-6 text-ink">
                    {roadmapItem?.teacherGuide?.trim() || roadmapItem?.homeworkGuide?.trim() || "Chưa có ghi chú hướng dẫn cho giáo viên."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`grid gap-6 ${canManageClass ? "xl:grid-cols-[minmax(0,1.6fr)_minmax(380px,0.9fr)]" : ""}`}>
        {canTeachSession ? (
          <div className="card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Bước 1</p>
                <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">Điểm danh học viên</h2>
                <p className="mt-1 text-sm text-ink-muted48">
                  Chọn trạng thái cho từng học viên. Mỗi dòng trả lời câu hỏi: hôm nay bạn này học thế nào?
                </p>
              </div>
              <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
                <p className="font-semibold text-ink">Trạng thái hiện có</p>
                <p className="mt-1">Có mặt · Vắng · Học bù · Vắng có phép</p>
              </div>
            </div>

            <AttendanceForm sessionId={session.id} initialRoster={roster} />
          </div>
        ) : (
          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Điểm danh</h2>
            <div className="mt-4 space-y-2 text-sm">
              {roster.map((row) => (
                <div key={row.studentId} className="flex items-center justify-between rounded-2xl border border-hairline px-4 py-3">
                  <div>
                    <p className="font-medium text-ink">{row.fullName}</p>
                    <p className="text-xs text-ink-muted48">{row.studentCode}</p>
                  </div>
                  <span className="text-ink-muted48">{attendanceLabel(row.status)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {canManageClass ? (
          <SessionAssignmentForm
            sessionId={session.id}
            employees={employees}
            assignments={session.assignments}
            currentEmployeeId={currentUser?.employeeId ?? null}
          />
        ) : null}
      </div>

      {canTeachSession ? (
        <ClassJournalForm
          sessionId={session.id}
          roster={activeEnrollments.map((enrollment) => enrollment.student)}
          journal={session.journal}
          publishedUrl={`/journal/${session.id}`}
          printMeta={{
            branchName: session.class.branch?.name ?? "Trung tâm",
            className: session.class.className,
            sessionDateLabel: sessionDate.toLocaleDateString("vi-VN"),
            weekdayLabel,
            scheduleLabel,
            totalStudents: roster.length,
          }}
          plannedRoadmap={
            roadmapItem
              ? {
                  sessionNumber: roadmapItem.sessionNumber,
                  title: roadmapItem.title,
                  objective: roadmapItem.objective,
                  materials: roadmapItem.materials,
                  teacherGuide: roadmapItem.teacherGuide,
                  homeworkGuide: roadmapItem.homeworkGuide,
                }
              : null
          }
        />
      ) : null}
    </div>
  );
}
