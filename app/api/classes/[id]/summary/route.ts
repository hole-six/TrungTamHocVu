import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView, canUpdate } from "@/lib/server/role-matrix";
import { getClassAssignmentRoleType } from "@/lib/server/class-default-assignments";
import { 
  estimateEndDate,
  estimateEndDateFromRules,
  generateSessionDates,
  getVietnamToday,
  isSameUtcDay,
  computeSessionTiming,
} from "@/lib/server/class-rules";
import { getHolidayDateSet } from "@/lib/server/holidays";
import { ensureClassRoadmapItems } from "@/lib/server/class-roadmap";
import { getEnrollmentLearningSnapshot } from "@/lib/server/enrollment-learning";
import { buildEnrollmentPipeline } from "@/lib/server/enrollment-pipeline";
import { isTaskDueOn, computeTaskLogStatus } from "@/lib/server/class-task-rules";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canView("schedule", role)) {
    return NextResponse.json({ error: "Không có quyền xem lớp học" }, { status: 403 });
  }

  const canManageClass = canUpdate("schedule", role);

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      nextClass: { include: { course: true } },
      scheduleRules: { orderBy: { weekday: "asc" } },
      defaultAssignments: { 
        where: { isActive: true }, 
        include: { employee: true }, 
        orderBy: { role: "asc" } 
      },
      sessions: {
        orderBy: { sessionDate: "desc" },
        include: {
          assignments: { 
            include: { employee: true }, 
            orderBy: [{ role: "asc" }, { employeeId: "asc" }] 
          },
          attendances: true,
          journal: true,
        },
      },
      enrollments: {
        where: { status: "ACTIVE" },
        include: {
          student: {
            include: {
              guardians: {
                include: { guardian: { include: { user: true } } },
                orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
              },
              charges: {
                where: { classId: params.id },
                include: {
                  allocations: {
                    where: {
                      payment: { status: { notIn: ["VOIDED", "REFUNDED"] } }
                    }
                  },
                  billingPeriod: true,
                },
                orderBy: { billingPeriod: { startDate: "desc" } },
              },
              attendances: {
                where: { session: { classId: params.id } },
                include: { session: true },
                orderBy: { session: { sessionDate: "desc" } },
                take: 1,
              },
              bookIssues: {
                where: { classId: params.id },
                include: { book: true },
                orderBy: { issueDate: "desc" },
                take: 1,
              },
              // Toàn bộ enrollment của học sinh (không chỉ lớp này) — để dựng chuỗi
              // Lớp A → B → C → D trong bộ nhớ, xem lib/server/enrollment-pipeline.ts.
              enrollments: {
                select: {
                  id: true,
                  classId: true,
                  class: { select: { className: true } },
                  transferredFromEnrollmentId: true,
                  status: true,
                  enrollDate: true,
                },
              },
            }
          },
          scholarships: {
            orderBy: { effectiveFrom: "desc" },
          },
        },
        orderBy: { enrollDate: "desc" },
      },
    }
  });

  if (!cls) {
    return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  }

  const vietnamToday = getVietnamToday();
  const holidayDates = await getHolidayDateSet(cls.branchId);
  const roadmapItems = await ensureClassRoadmapItems(cls.id, cls.totalSessions);

  // Calculate stats
  const activeEnrollments = cls.enrollments;
  const completedSessions = cls.sessions.filter(s => s.status === "COMPLETED").length;
  
  // Calculate total outstanding and overdue count
  let totalOutstanding = 0;
  let overdueEnrollments = 0;
  for (const enrollment of cls.enrollments) {
    const charges = enrollment.student.charges;
    const total = charges.reduce((s, c) => s + c.totalAmount, 0);
    const paid = charges.reduce((s, c) => 
      s + c.allocations.reduce((ss, a) => ss + a.amount, 0), 0
    );
    const debt = total - paid;
    totalOutstanding += debt;
    if (debt > 0) overdueEnrollments++;
  }

  // Find next and latest sessions
  const nextSession = cls.sessions.find(s => s.sessionDate >= vietnamToday) || null;
  const latestSession = cls.sessions[0] || null;
  const latestCompletedSession = cls.sessions.find(s => s.status === "COMPLETED") || latestSession;

  // Latest attendance stats
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

  // Get default teachers and assistants
  const defaultTeachers = cls.defaultAssignments
    .filter(a => getClassAssignmentRoleType(a.role) === "TEACHER")
    .map(a => a.employee.fullName)
    .join(", ");
    
  const defaultAssistants = cls.defaultAssignments
    .filter(a => getClassAssignmentRoleType(a.role) === "ASSISTANT")
    .map(a => a.employee.shortName || a.employee.fullName)
    .join(", ");

  // Calculate suggested end date
  const suggestedEnd =
    cls.expectedEndDate ??
    estimateEndDateFromRules(cls.startDate, cls.totalSessions, cls.scheduleRules, holidayDates) ??
    estimateEndDate(cls.startDate, cls.totalSessions, cls.sessionsPerWeek);

  // Generate projected schedule
  const projectedSlots =
    cls.startDate && suggestedEnd && cls.scheduleRules.length > 0
      ? generateSessionDates(cls.scheduleRules, cls.startDate, suggestedEnd, holidayDates)
      : [];
      
  const projectedSchedule = (cls.totalSessions ? projectedSlots.slice(0, cls.totalSessions) : projectedSlots).map((slot, index) => ({
    number: index + 1,
    sessionDate: slot.sessionDate.toISOString(),
    startTime: slot.startTime,
    endTime: slot.endTime,
    timing: computeSessionTiming(slot.sessionDate, vietnamToday),
    session: cls.sessions.find((s) => isSameUtcDay(s.sessionDate, slot.sessionDate)) ?? null,
    roadmapItem: roadmapItems.find((item) => item.sessionNumber === index + 1) ?? null,
  }));

  // Enrollment learning snapshots with FULL details
  const enrollmentsWithLearning = await Promise.all(
    cls.enrollments.map(async (enrollment) => {
      const snapshot = await getEnrollmentLearningSnapshot(prisma, {
        ...enrollment,
        class: {
          totalSessions: cls.totalSessions,
          tuitionPerSession: cls.tuitionPerSession,
          nextClassId: cls.nextClassId,
          course: cls.course,
          scheduleRules: cls.scheduleRules,
          branchId: cls.branchId,
        },
      });
      
      const classCharges = enrollment.student.charges;
      const total = classCharges.reduce((s, c) => s + c.totalAmount, 0);
      const paid = classCharges.reduce((s, c) => 
        s + c.allocations.reduce((ss, a) => ss + a.amount, 0), 0
      );
      const outstanding = total - paid;

      const primaryGuardian = enrollment.student.guardians.find((g) => g.isPrimary)?.guardian ?? enrollment.student.guardians[0]?.guardian ?? null;
      const latestCharge = classCharges[0] ?? null;
      const now = new Date();
      const activeScholarship = enrollment.scholarships.find((sc: any) => sc.effectiveFrom <= now && (!sc.effectiveTo || sc.effectiveTo >= now));
      const latestAttendance = enrollment.student.attendances?.[0] ?? null;
      const latestBookIssue = enrollment.student.bookIssues?.[0] ?? null;
      const chain = buildEnrollmentPipeline(
        enrollment.student.enrollments.map((e) => ({
          id: e.id,
          classId: e.classId,
          className: e.class?.className ?? "Gói học",
          transferredFromEnrollmentId: e.transferredFromEnrollmentId,
          status: e.status,
          enrollDate: e.enrollDate,
        })),
        enrollment.id,
      );

      return {
        id: enrollment.id,
        enrollDate: enrollment.enrollDate.toISOString(),
        status: enrollment.status,
        billingModel: enrollment.billingModel,
        student: {
          id: enrollment.student.id,
          studentCode: enrollment.student.studentCode,
          fullName: enrollment.student.fullName,
          phone: enrollment.student.phone,
        },
        primaryGuardian: primaryGuardian ? {
          fullName: primaryGuardian.fullName,
          phone: primaryGuardian.phone,
          email: primaryGuardian.user?.email,
        } : null,
        debt: outstanding,
        latestCharge: latestCharge ? {
          periodName: latestCharge.billingPeriod.periodName,
          outstanding,
        } : null,
        activeScholarship: activeScholarship ? {
          percentage: activeScholarship.percentage,
        } : null,
        latestAttendance: latestAttendance ? {
          status: latestAttendance.status,
          sessionDate: latestAttendance.session.sessionDate.toISOString(),
        } : null,
        latestBookIssue: latestBookIssue ? {
          bookName: latestBookIssue.book.name,
          quantity: latestBookIssue.quantity,
        } : null,
        learningSnapshot: snapshot,
        chain: chain.length > 1 ? chain.map((node) => ({ id: node.id, className: node.className, isCurrent: node.isCurrent })) : null,
      };
    })
  );

  // Attention items
  const attentionItems: { text: string; severity: "critical" | "warning" | "ok" }[] = [];
  if (!cls.scheduleRules.length) attentionItems.push({ text: "Chưa cấu hình lịch học chuẩn", severity: "critical" });
  if (!cls.sessions.length) attentionItems.push({ text: "Chưa sinh buổi học", severity: "critical" });
  if (latestSession && !latestSession.assignments.length) attentionItems.push({ text: "Buổi gần nhất chưa phân công GV/TG", severity: "critical" });
  if (latestSession && !latestSession.attendances.length) attentionItems.push({ text: "Buổi gần nhất chưa điểm danh", severity: "warning" });
  if (latestSession && !latestSession.journal) attentionItems.push({ text: "Buổi gần nhất chưa có journal", severity: "warning" });
  if (totalOutstanding > 0) attentionItems.push({ text: `Lớp còn tổng nợ`, severity: "warning" });
  // Cảnh báo TRƯỚC khi sweep tự động (2h sáng, lib/server/scheduling.ts) "cướp" mất cơ
  // hội xử lý thủ công — quên bấm "Kết thúc lớp" thì bị máy làm thay trong im lặng, và
  // làm dở hơn (không hỏi chuyển lớp/giữ học bổng, chỉ tất toán + cấp số dư). Cùng điều
  // kiện với app/(app)/classes/[id]/page.tsx — 2 nơi tính riêng vì chưa có chỗ dùng chung.
  const activeNeedTransferCount = enrollmentsWithLearning.filter(
    (item) => item.status === "ACTIVE" && item.learningSnapshot.remainingMainSessions > 0,
  ).length;
  const daysToExpectedEnd = cls.expectedEndDate ? (cls.expectedEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000) : null;
  if (cls.status === "ACTIVE" && daysToExpectedEnd !== null && daysToExpectedEnd >= 0 && daysToExpectedEnd <= 7 && activeNeedTransferCount > 0) {
    attentionItems.unshift({
      text: `Lớp sắp tự động kết thúc (còn ${activeNeedTransferCount} học viên chưa học đủ buổi) — bấm "Kết thúc lớp" ngay để tự chọn lớp chuyển tiếp, nếu không hệ thống sẽ tự tất toán mà không hỏi chuyển lớp`,
      severity: "critical",
    });
  }

  // Tasks data
  const tasks = await prisma.task.findMany({
    where: { relatedType: "Class", relatedId: cls.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    select: {
      id: true,
      createdAt: true,
      status: true,
      title: true,
      description: true,
      dueDate: true,
      relatedType: true,
      relatedId: true,
      assignedToId: true,
    },
  });

  const classTasksRaw = await prisma.classTask.findMany({
    where: { classId: cls.id },
    orderBy: { createdAt: "asc" },
    include: { logs: { orderBy: { dueDate: "desc" }, take: 5 } },
  });

  const classTasks = classTasksRaw.map((task) => {
    const dueToday = task.isActive && isTaskDueOn(task, vietnamToday);
    const todayLog = task.logs.find((log) =>
      log.dueDate.getFullYear() === vietnamToday.getFullYear() &&
      log.dueDate.getMonth() === vietnamToday.getMonth() &&
      log.dueDate.getDate() === vietnamToday.getDate()
    );
    return { 
      ...task, 
      dueToday, 
      todayStatus: dueToday ? computeTaskLogStatus(vietnamToday, todayLog?.completedAt ?? null, vietnamToday) : null,
      logs: task.logs.map(log => ({
        ...log,
        dueDate: log.dueDate.toISOString(),
        completedAt: log.completedAt?.toISOString() || null,
      })),
    };
  });

  const dueTodayTasks = classTasks.filter((t) => t.dueToday);

  // Get courses and employees for forms
  const courses = await prisma.course.findMany({ 
    where: { branchId: cls.branchId }, 
    orderBy: { name: "asc" } 
  });
  
  const employees = canManageClass
    ? await prisma.employee.findMany({ 
        where: { branchId: cls.branchId, workStatus: "ACTIVE" }, 
        orderBy: { fullName: "asc" } 
      })
    : [];

  // Continuation class options
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

  // Remedial bulk assign data
  let remedialCandidates: any[] = [];
  let remedialFutureSessions: any[] = [];
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

  // Completion stats for CompleteClassButton
  const activeLearningSnapshots = enrollmentsWithLearning.filter(e => e.status === "ACTIVE");
  const completionReadyCount = activeLearningSnapshots.filter((item) => item.learningSnapshot.remainingMainSessions <= 0).length;
  const completionNeedTransferStudents = activeLearningSnapshots
    .filter((item) => item.learningSnapshot.remainingMainSessions > 0)
    .map((item) => ({
      enrollmentId: item.id,
      studentName: item.student.fullName,
      paidRemainingSessions: item.learningSnapshot.paidRemainingSessions,
      manualExtraRemainingSessions: item.learningSnapshot.manualExtraRemainingSessions,
      oldUnitPrice: item.learningSnapshot.unitPrice,
      scholarshipPct: item.learningSnapshot.scholarshipPct,
    }));
  const completionNextClassUnitPrice = cls.nextClass?.tuitionPerSession ?? cls.nextClass?.course?.tuitionPerSession ?? 0;

  const estimatedClassTuition = cls.tuitionPerSession && cls.totalSessions ? cls.tuitionPerSession * cls.totalSessions : null;

  return NextResponse.json({
    id: cls.id,
    className: cls.className,
    classCode: cls.classCode,
    classGroup: cls.classGroup,
    status: cls.status,
    isRemedial: cls.isRemedial,
    totalSessions: cls.totalSessions,
    tuitionPerSession: cls.tuitionPerSession,
    sessionsPerWeek: cls.sessionsPerWeek,
    startDate: cls.startDate?.toISOString() || null,
    expectedEndDate: cls.expectedEndDate?.toISOString() || null,
    suggestedEnd: suggestedEnd?.toISOString() || null,
    notes: cls.notes,
    branchId: cls.branchId,
    courseId: cls.courseId,
    nextClassId: cls.nextClassId,
    course: cls.course,
    nextClass: cls.nextClass,
    scheduleRules: cls.scheduleRules,
    roadmapItems: roadmapItems.map((item) => ({
      sessionNumber: item.sessionNumber,
      title: item.title ?? `Buổi ${item.sessionNumber}`,
      objective: item.objective ?? "",
      materials: item.materials ?? "",
      teacherGuide: item.teacherGuide ?? "",
      homeworkGuide: item.homeworkGuide ?? "",
      teacherRequirement: item.teacherRequirement ?? "",
    })),
    activeEnrollments: activeEnrollments.length,
    completedSessions,
    totalOutstanding,
    overdueEnrollments,
    latestAttendanceStats,
    estimatedClassTuition,
    nextSession: nextSession ? {
      id: nextSession.id,
      sessionDate: nextSession.sessionDate.toISOString(),
      startTime: nextSession.startTime,
      endTime: nextSession.endTime,
    } : null,
    latestSession: latestSession ? {
      id: latestSession.id,
      sessionDate: latestSession.sessionDate.toISOString(),
      startTime: latestSession.startTime,
      endTime: latestSession.endTime,
      status: latestSession.status,
      hasJournal: !!latestSession.journal,
      journalPublished: !!latestSession.journal?.publishedAt,
      attendanceCount: latestSession.attendances.length,
      assignmentCount: latestSession.assignments.length,
      teachers: latestSession.assignments
        .filter(a => getClassAssignmentRoleType(a.role) === "TEACHER")
        .map(a => a.employee.fullName)
        .join(", "),
      assistants: latestSession.assignments
        .filter(a => getClassAssignmentRoleType(a.role) === "ASSISTANT")
        .map(a => a.employee.shortName || a.employee.fullName)
        .join(", "),
    } : null,
    defaultTeachers,
    defaultAssistants,
    defaultAssignments: cls.defaultAssignments.map(a => ({
      id: a.id,
      role: a.role,
      employeeId: a.employee.id,
      employeeName: a.employee.fullName,
      isActive: a.isActive,
    })),
    projectedSchedule,
    enrollments: enrollmentsWithLearning,
    attentionItems,
    dueTodayTasks,
    tasks: tasks.map(t => ({
      ...t,
      dueDate: t.dueDate?.toISOString() || null,
    })),
    classTasks,
    courses,
    employees,
    continuationClassOptions: continuationClassOptions.map(c => ({
      id: c.id,
      classCode: c.classCode,
      className: c.className,
      tuitionPerSession: c.tuitionPerSession,
      course: c.course,
    })),
    remedialCandidates,
    remedialFutureSessions,
    completionStats: {
      readyCount: completionReadyCount,
      needTransferStudents: completionNeedTransferStudents,
      nextClassUnitPrice: completionNextClassUnitPrice,
    },
    permissions: {
      canManageClass,
    },
  });
}
