import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AttendanceForm from "@/components/classes/AttendanceForm";
import SessionAssignmentForm from "@/components/classes/SessionAssignmentForm";
import ClassJournalForm from "@/components/classes/ClassJournalForm";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

export default async function SessionAttendancePage({ params }: { params: { id: string; sessionId: string } }) {
  const session = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: {
      class: true,
      attendances: true,
      assignments: { include: { employee: true } },
      journal: { include: { entries: { include: { scores: true, student: true } } } },
    },
  });
  if (!session || session.classId !== params.id) notFound();

  const currentUser = await getCurrentUser();
  const role = currentUser ? await getUserRole(currentUser.id) : null;
  const canManageClass = canUpdate("schedule", role);
  // Điểm danh + nhật ký lớp học vẫn cần mở cho GV/TG dù họ không có quyền quản lý lớp
  // (canManageClass=false với TEACHER/TEACHING_ASSISTANT) — đây là công việc dạy học
  // hàng ngày của họ, khác với việc quản lý lịch/ghi danh/phân công.
  const canTeachSession = canManageClass || role === "TEACHER" || role === "TEACHING_ASSISTANT";

  const [activeEnrollments, employees] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classId: session.classId, status: "ACTIVE" },
      include: { student: true },
      orderBy: { student: { fullName: "asc" } },
    }),
    prisma.employee.findMany({ where: { branchId: session.class.branchId }, orderBy: { fullName: "asc" } }),
  ]);

  const attendanceByStudent = Object.fromEntries(session.attendances.map((a) => [a.studentId, a.status]));
  const roster = activeEnrollments.map((e) => ({
    studentId: e.studentId,
    fullName: e.student.fullName,
    studentCode: e.student.studentCode,
    status: attendanceByStudent[e.studentId] ?? "PRESENT",
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/classes/${session.classId}`} className="text-sm text-primary">
          ← Quay lại {session.class.className}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Điểm danh — {new Date(session.sessionDate).toLocaleDateString("vi-VN")}
        </h1>
        <p className="mt-1 text-sm text-ink-muted48">
          {session.startTime}–{session.endTime} {session.room && `· ${session.room}`}
        </p>
      </div>

      {canTeachSession ? (
        <div className="card">
          <AttendanceForm sessionId={session.id} initialRoster={roster} />
        </div>
      ) : (
        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">Điểm danh</h2>
          <div className="mt-3 space-y-1 text-sm">
            {roster.map((r) => (
              <div key={r.studentId} className="flex items-center justify-between border-b border-hairline py-1.5 last:border-0">
                <span>{r.fullName}</span>
                <span className="text-ink-muted48">{r.status === "PRESENT" ? "Có mặt" : r.status === "ABSENT" ? "Vắng" : r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {canManageClass && <SessionAssignmentForm sessionId={session.id} employees={employees} assignments={session.assignments} />}

      {canTeachSession && (
        <ClassJournalForm
          sessionId={session.id}
          roster={activeEnrollments.map((e) => e.student)}
          journal={session.journal}
          publishedUrl={`/journal/${session.id}`}
        />
      )}
    </div>
  );
}
