import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AttendanceForm from "@/components/classes/AttendanceForm";
import SessionAssignmentForm from "@/components/classes/SessionAssignmentForm";

export default async function SessionAttendancePage({ params }: { params: { id: string; sessionId: string } }) {
  const session = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: { class: true, attendances: true, assignments: { include: { employee: true } } },
  });
  if (!session || session.classId !== params.id) notFound();

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

      <div className="card">
        <AttendanceForm sessionId={session.id} initialRoster={roster} />
      </div>

      <SessionAssignmentForm sessionId={session.id} employees={employees} assignments={session.assignments} />
    </div>
  );
}
