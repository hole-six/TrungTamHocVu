import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { computeCareAlerts } from "@/lib/server/journal-alerts";
import { computeSessionTiming, getVietnamToday } from "@/lib/server/class-rules";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRole(currentUser.id);
    const canManageClass = canUpdate("schedule", role);
    const canTeachSession = canManageClass || role === "TEACHER" || role === "TEACHING_ASSISTANT";

    const session = await prisma.classSession.findUnique({
      where: { id: params.id },
      include: {
        class: {
          include: {
            branch: true,
            course: true,
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
        requirementCheck: { include: { employee: { select: { fullName: true } } } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get active enrollments
    const activeEnrollments = await prisma.enrollment.findMany({
      where: { classId: session.classId, status: "ACTIVE" },
      include: { student: true },
      orderBy: { student: { fullName: "asc" } },
    });

    // Get employees for assignment
    const employees = await prisma.employee.findMany({
      where: { branchId: session.class.branchId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, shortName: true },
    });

    const attendanceByStudent = Object.fromEntries(
      session.attendances.map((attendance) => [attendance.studentId, attendance.status])
    );

    const sessionNumber =
      session.class.sessions.findIndex((item) => item.id === session.id) >= 0
        ? session.class.sessions.findIndex((item) => item.id === session.id) + 1
        : null;

    const roadmapItem =
      sessionNumber != null
        ? session.class.roadmapItems.find((item) => item.sessionNumber === sessionNumber) ?? null
        : null;

    // Available credits for remedial classes
    const availableCreditsByStudent = session.class.isRemedial
      ? Object.fromEntries(
          (
            await prisma.sessionCredit.groupBy({
              by: ["studentId"],
              where: { studentId: { in: activeEnrollments.map((e) => e.studentId) }, status: "AVAILABLE" },
              _count: { _all: true },
            })
          ).map((row) => [row.studentId, row._count._all])
        )
      : null;

    // Locked credits
    const lockedCredits = await prisma.sessionCredit.findMany({
      where: {
        sourceSessionId: session.id,
        status: "CONSUMED",
        studentId: { in: activeEnrollments.map((e) => e.studentId) },
      },
      select: { studentId: true, notes: true },
    });
    const lockedByStudent = new Map(lockedCredits.map((c) => [c.studentId, c.notes]));

    const roster = activeEnrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      fullName: enrollment.student.fullName,
      studentCode: enrollment.student.studentCode,
      status: attendanceByStudent[enrollment.studentId] ?? "PRESENT",
      availableCredits: availableCreditsByStudent ? availableCreditsByStudent[enrollment.studentId] ?? 0 : null,
      locked: lockedByStudent.has(enrollment.studentId),
      lockedNote: lockedByStudent.get(enrollment.studentId) ?? null,
    }));

    const careAlertStudentIds = await computeCareAlerts(
      session.classId,
      roster.map((student) => student.studentId),
      session.sessionDate,
      session.id
    );

    const presentCount = roster.filter((student) => student.status === "PRESENT").length;
    const absentCount = roster.filter((student) => student.status === "ABSENT").length;

    const weekdayLabels = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
    const sessionDate = new Date(session.sessionDate);
    const weekdayLabel = weekdayLabels[sessionDate.getDay()] ?? "";
    const timing = computeSessionTiming(session.sessionDate, getVietnamToday());

    return NextResponse.json({
      session: {
        id: session.id,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        room: session.room,
        status: session.status,
        notes: session.notes,
        weekdayLabel,
        timing,
      },
      class: {
        id: session.class.id,
        className: session.class.className,
        classCode: session.class.classCode,
        courseName: session.class.course?.name,
        isRemedial: session.class.isRemedial,
        branchName: session.class.branch.name,
      },
      sessionNumber,
      totalSessions: session.class.sessions.length,
      roadmapItem: roadmapItem ? {
        title: roadmapItem.title,
        objective: roadmapItem.objective,
        materials: roadmapItem.materials,
        teacherGuide: roadmapItem.teacherGuide,
        homeworkGuide: roadmapItem.homeworkGuide,
      } : null,
      roster,
      presentCount,
      absentCount,
      enrollmentCount: activeEnrollments.length,
      assignments: session.assignments.map((a) => ({
        id: a.id,
        role: a.role,
        employeeId: a.employeeId,
        employeeName: a.employee.fullName,
        employeeShortName: a.employee.shortName,
        hours: a.hours,
        amount: a.amount,
        deductedHours: a.deductedHours ?? 0,
        addedHours: a.addedHours ?? 0,
        adjustmentNote: a.adjustmentNote,
        isSubstituteShift: a.isSubstituteShift ?? false,
        checkInAt: a.checkInAt,
        checkOutAt: a.checkOutAt,
        employee: { fullName: a.employee.fullName },
        substituteFor: a.substituteFor ? {
          id: a.substituteFor.id,
          employee: { fullName: a.substituteFor.employee.fullName }
        } : null,
        substitutedBy: a.substitutedBy ? {
          id: a.substitutedBy.id,
          employee: { fullName: a.substitutedBy.employee.fullName }
        } : null,
      })),
      journal: session.journal ? {
        id: session.journal.id,
        unitLesson: session.journal.unitLesson,
        teacherNote: session.journal.teacherNote,
        homeworkNote: session.journal.homeworkNote,
        publishedAt: session.journal.publishedAt,
        entries: session.journal.entries.map((e) => ({
          id: e.id,
          studentId: e.studentId,
          studentName: e.student.fullName,
          comment: e.comment,
          scores: e.scores,
        })),
      } : null,
      requirementCheck: session.requirementCheck,
      employees,
      careAlertStudentIds,
      permissions: {
        canManageClass,
        canTeachSession,
      },
    });
  } catch (error) {
    console.error("Session detail API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
