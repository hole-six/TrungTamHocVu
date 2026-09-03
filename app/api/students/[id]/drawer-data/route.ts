import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdate, canView, canViewFullWithOverride, canViewWithOverride } from "@/lib/server/role-matrix";
import { computeOutstandingBalance } from "@/lib/server/balance";
import { chargeOwnDueAmount } from "@/lib/server/tuition-rules";
import { getEnrollmentLearningSnapshot } from "@/lib/server/enrollment-learning";
import { getVietnamToday } from "@/lib/server/class-rules";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getUserRoleAndOverride(currentUser.id, "students");
    if (!canViewWithOverride("students", access.role, access.override)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limitedToAssignedStudents = !canViewFullWithOverride(
      "students",
      access.role,
      access.override
    );
    if (limitedToAssignedStudents && !currentUser.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch student with all related data
    const student = await prisma.student.findFirst({
      where: {
        id: params.id,
        ...(limitedToAssignedStudents
          ? {
              enrollments: {
                some: {
                  status: "ACTIVE",
                  class: {
                    OR: [
                      {
                        defaultAssignments: {
                          some: { employeeId: currentUser.employeeId!, isActive: true },
                        },
                      },
                      {
                        sessions: {
                          some: {
                            assignments: { some: { employeeId: currentUser.employeeId! } },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            }
          : {}),
      },
      include: {
        lead: true,
        guardians: {
          include: { guardian: { include: { user: true } } },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        enrollments: {
          include: {
            class: {
              include: {
                course: true,
                nextClass: true,
                scheduleRules: { where: { isActive: true }, orderBy: { weekday: "asc" } },
              },
            },
            transferredFrom: { include: { class: true } },
            transferredTo: { include: { class: true }, orderBy: { enrollDate: "asc" } },
          },
          orderBy: [{ enrollDate: "desc" }, { createdAt: "desc" }],
        },
        charges: {
          include: {
            billingPeriod: true,
            class: true,
            invoice: true,
            allocations: {
              where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
              include: { payment: { include: { cashPosting: { include: { cashTransaction: true } } } } },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        payments: {
          orderBy: { paidDate: "desc" },
          include: {
            creditBalances: true,
            refunds: true,
            cashPosting: { include: { cashTransaction: true } },
            allocations: {
              include: {
                charge: { include: { billingPeriod: true, class: true } },
              },
            },
          },
        },
        scholarships: {
          include: { enrollment: { include: { class: true } } },
          orderBy: { effectiveFrom: "desc" },
        },
        adjustments: {
          include: { enrollment: { include: { class: true } } },
          orderBy: { effectiveFrom: "desc" },
        },
        creditBalances: { where: { usedAt: null }, orderBy: { createdAt: "asc" } },
        schoolExamScores: { orderBy: { schoolYear: "desc" } },
        bookIssues: {
          include: { book: true, class: true, charge: { include: { billingPeriod: true } } },
          orderBy: { issueDate: "desc" },
          take: 8,
        },
        bookRequirements: {
          include: { book: true, class: true },
          orderBy: { createdAt: "desc" },
        },
        attendances: {
          include: {
            session: {
              include: {
                class: true,
                assignments: {
                  include: { employee: true },
                  orderBy: [{ role: "asc" }, { employeeId: "asc" }],
                },
                journal: true,
              },
            },
          },
          orderBy: { session: { sessionDate: "desc" } },
          take: 20,
        },
        journalEntries: {
          include: {
            scores: true,
            journal: {
              include: {
                session: {
                  include: { class: true },
                },
              },
            },
          },
          orderBy: { journal: { createdAt: "desc" } },
          take: 6,
        },
        statusHistory: { orderBy: { changedAt: "desc" }, take: 8 },
        sessionCredits: {
          include: {
            sourceSession: { select: { sessionDate: true, class: { select: { className: true } } } },
            consumedSession: { select: { sessionDate: true, class: { select: { className: true } } } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const role = access.role;
    const canEditStudent = canUpdate("students", role);
    const canManageFinance = canUpdate("tuition", role);
    const canSeeFinance = canView("tuition", role);
    const canManageGuardianAccount = canUpdate("students", role);
    const canManageSchedule = canUpdate("schedule", role);
    const canManageInventory = canUpdate("inventory", role);

    // Calculate KPIs
    const outstanding = canSeeFinance ? await computeOutstandingBalance(student.id) : 0;
    const activeEnrollments = student.enrollments.filter((e) => e.status === "ACTIVE");
    const currentEnrollment = activeEnrollments[0] ?? student.enrollments[0] ?? null;

    const totalCharged = student.charges.reduce((sum, charge) => sum + charge.totalAmount, 0);
    const totalPaid = student.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const unpaidBookAmount = student.bookIssues
      .filter((issue) => issue.paymentStatus !== "PAID")
      .reduce((sum, issue) => sum + issue.amount, 0);

    const attendanceStats = student.attendances.reduce(
      (acc, attendance) => {
        if (attendance.status === "PRESENT") acc.present += 1;
        if (attendance.status === "ABSENT") acc.absent += 1;
        if (attendance.status === "MAKEUP") acc.makeup += 1;
        return acc;
      },
      { present: 0, absent: 0, makeup: 0 }
    );

    // Calculate charges summaries
    const unusedCreditAmount = student.creditBalances.reduce((sum, credit) => sum + credit.amount, 0);
    const chargeRemainingMap = new Map<string, { paidAmount: number; remainingAmount: number }>();
    let creditLeft = unusedCreditAmount;

    [...student.charges]
      .sort((a, b) => a.billingPeriod.startDate.getTime() - b.billingPeriod.startDate.getTime())
      .forEach((charge) => {
        const paidAmount = charge.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
        const rawRemaining = Math.max(0, chargeOwnDueAmount(charge) - paidAmount);
        const creditApplied = Math.min(rawRemaining, creditLeft);
        creditLeft -= creditApplied;
        chargeRemainingMap.set(charge.id, {
          paidAmount,
          remainingAmount: rawRemaining - creditApplied,
        });
      });

    const chargeSummaries = student.charges.map((charge) => {
      const paymentState = chargeRemainingMap.get(charge.id) ?? {
        paidAmount: charge.allocations.reduce((sum, alloc) => sum + alloc.amount, 0),
        remainingAmount: Math.max(
          0,
          chargeOwnDueAmount(charge) -
            charge.allocations.reduce((sum, alloc) => sum + alloc.amount, 0)
        ),
      };
      return {
        id: charge.id,
        classId: charge.classId,
        billingPeriodId: charge.billingPeriodId,
        periodName: charge.billingPeriod.periodName,
        startDate: charge.billingPeriod.startDate,
        className: charge.class.className,
        tuitionAmount: charge.tuitionAmount,
        materialsAmount: charge.materialsAmount,
        openingBalance: charge.openingBalance,
        totalAmount: charge.totalAmount,
        paidAmount: paymentState.paidAmount,
        remainingAmount: paymentState.remainingAmount,
      };
    });

    const todayStart = getVietnamToday();
    const dueChargeSummaries = chargeSummaries.filter(
      (charge) =>
        charge.remainingAmount > 0 && charge.startDate.getTime() <= todayStart.getTime()
    );
    const nextDueCharge =
      [...dueChargeSummaries].sort((a, b) => a.periodName.localeCompare(b.periodName))[0] ?? null;
    const dueNowAmount = dueChargeSummaries.reduce((sum, charge) => sum + charge.remainingAmount, 0);

    const { tuitionPaid, materialsPaid } = chargeSummaries.reduce(
      (acc, charge) => {
        const ownDue = chargeOwnDueAmount(charge);
        if (ownDue > 0) {
          acc.tuitionPaid += charge.paidAmount * (charge.tuitionAmount / ownDue);
          acc.materialsPaid += charge.paidAmount * (charge.materialsAmount / ownDue);
        }
        return acc;
      },
      { tuitionPaid: 0, materialsPaid: 0 }
    );

    // Get learning snapshot
    let learningSnapshot = null;
    if (currentEnrollment) {
      learningSnapshot = await getEnrollmentLearningSnapshot(prisma, currentEnrollment);
    }

    // Lớp có thể chuyển tiếp — KHÔNG lọc cứng theo courseId vì "chuyển lớp" còn bao
    // gồm cả chuyển LÊN khóa nâng cao (courseId khác hẳn). Ưu tiên hiện lớp CÙNG khóa
    // học lên đầu (trường hợp phổ biến nhất), các khóa khác vẫn hiện phía sau để chọn
    // khi nâng cấp (xem cùng logic ở app/(app)/classes/[id]/page.tsx continuationClassOptions).
    const continuationClassOptionsRaw =
      currentEnrollment && canManageSchedule
        ? await prisma.class.findMany({
            where: {
              branchId: student.branchId,
              id: { not: currentEnrollment.classId },
              status: "ACTIVE",
              isRemedial: false,
            },
            select: {
              id: true,
              classCode: true,
              className: true,
              courseId: true,
              tuitionPerSession: true,
              course: { select: { name: true, tuitionPerSession: true } },
            },
            orderBy: [{ className: "asc" }, { classCode: "asc" }],
            take: 200,
          })
        : [];
    const continuationClassOptions = currentEnrollment
      ? [...continuationClassOptionsRaw].sort(
          (a, b) => Number(b.courseId === currentEnrollment.class.courseId) - Number(a.courseId === currentEnrollment.class.courseId),
        )
      : [];

    // Enrollment finance
    const enrollmentCharges = currentEnrollment
      ? student.charges.filter((c) => c.enrollmentId === currentEnrollment.id)
      : [];
    const enrollmentFinance = enrollmentCharges.reduce(
      (acc, c) => {
        acc.mainTuition += c.mainTuitionAmount || c.tuitionAmount || 0;
        acc.paidCatchup += c.paidCatchupAmount || 0;
        acc.materials += c.materialsAmount || 0;
        acc.transferCredit += c.transferCreditAmount || 0;
        acc.total += c.totalAmount || 0;
        acc.paid += c.allocations.reduce((s, a) => s + a.amount, 0);
        return acc;
      },
      { mainTuition: 0, paidCatchup: 0, materials: 0, transferCredit: 0, total: 0, paid: 0 }
    );
    const enrollmentOutstanding = Math.max(0, enrollmentFinance.total - enrollmentFinance.paid);

    // Transfer history
    const transferHistory = currentEnrollment
      ? [
          ...(currentEnrollment.transferredFrom
            ? [
                {
                  direction: "from" as const,
                  other: currentEnrollment.transferredFrom,
                  self: currentEnrollment,
                },
              ]
            : []),
          ...currentEnrollment.transferredTo.map((next) => ({
            direction: "to" as const,
            other: next,
            self: currentEnrollment,
          })),
        ]
      : [];

    // Operational warnings
    const operationalWarnings: { text: string; severity: "critical" | "warning" | "info" }[] = [];
    if (!currentEnrollment) {
      operationalWarnings.push({
        text: "Chưa có lớp đang học — cần gán lớp cho học viên.",
        severity: "critical",
      });
    }
    if (canSeeFinance && outstanding > 0) {
      operationalWarnings.push({
        text: `Còn nợ học phí ${(outstanding / 1000).toFixed(0)}K.`,
        severity: "critical",
      });
    }
    if (learningSnapshot?.continuationStatus === "NEED_TRANSFER") {
      operationalWarnings.push({
        text: currentEnrollment?.class.nextClass
          ? `Cần chuyển sang lớp ${currentEnrollment.class.nextClass.className} — còn thiếu ${learningSnapshot.shortageAfterCurrentClass} buổi sau khi lớp hiện tại kết thúc.`
          : `Lớp hiện tại chưa cấu hình lớp tiếp theo — còn thiếu ${learningSnapshot.shortageAfterCurrentClass} buổi sau khi lớp kết thúc.`,
        severity: "warning",
      });
    }
    const primaryGuardianLink =
      student.guardians.find((item) => item.isPrimary) ?? student.guardians[0] ?? null;
    const primaryGuardian = primaryGuardianLink?.guardian ?? null;
    if (!primaryGuardian) {
      operationalWarnings.push({ text: "Chưa gắn phụ huynh chính.", severity: "warning" });
    } else if (!primaryGuardian.user) {
      operationalWarnings.push({ text: "Phụ huynh chưa có tài khoản portal.", severity: "warning" });
    }
    if (student.bookIssues.some((issue) => issue.paymentStatus !== "PAID")) {
      operationalWarnings.push({
        text: "Có sách/giáo trình chưa thu đủ tiền.",
        severity: "warning",
      });
    }
    const availableCredits = student.sessionCredits.filter((c) => c.status === "AVAILABLE");
    if (availableCredits.length > 0) {
      operationalWarnings.push({
        text: `Còn ${availableCredits.length} buổi bổ trợ chưa dùng.`,
        severity: "info",
      });
    }
    if (
      learningSnapshot &&
      learningSnapshot.remainingMainSessions > 0 &&
      learningSnapshot.remainingMainSessions <= 3
    ) {
      operationalWarnings.push({
        text: `Sắp học xong khóa chính — còn ${learningSnapshot.remainingMainSessions} buổi.`,
        severity: "info",
      });
    }

    // Recent sessions
    const recentAttendanceClassIds = [
      ...new Set(student.attendances.map((attendance) => attendance.session.classId)),
    ];
    const classLearningPlans =
      recentAttendanceClassIds.length > 0
        ? await prisma.class.findMany({
            where: { id: { in: recentAttendanceClassIds } },
            select: {
              id: true,
              sessions: {
                where: { status: { not: "CANCELLED" } },
                orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
                select: { id: true },
              },
              roadmapItems: {
                orderBy: { sessionNumber: "asc" },
                select: { sessionNumber: true, title: true, objective: true },
              },
            },
          })
        : [];
    const classLearningPlanMap = new Map(
      classLearningPlans.map((classPlan) => [
        classPlan.id,
        {
          sessionNumberById: new Map(
            classPlan.sessions.map((session, index) => [session.id, index + 1])
          ),
          roadmapBySessionNumber: new Map(
            classPlan.roadmapItems.map((item) => [item.sessionNumber, item])
          ),
        },
      ])
    );

    const recentSessions = student.attendances.map((attendance) => {
      const teachers = attendance.session.assignments
        .filter((assignment) => assignment.role === "TEACHER")
        .map((assignment) => assignment.employee.fullName)
        .join(", ");
      const assistants = attendance.session.assignments
        .filter((assignment) => assignment.role !== "TEACHER")
        .map((assignment) => assignment.employee.shortName || assignment.employee.fullName)
        .join(", ");
      const learningPlan = classLearningPlanMap.get(attendance.session.classId);
      const sessionNumber = learningPlan?.sessionNumberById.get(attendance.session.id) ?? null;
      const roadmapItem = sessionNumber
        ? learningPlan?.roadmapBySessionNumber.get(sessionNumber) ?? null
        : null;

      return {
        attendance,
        teachers,
        assistants,
        sessionNumber,
        roadmapItem,
      };
    });

    // Makeup session options
    const makeupSessionOptions =
      availableCredits.length > 0
        ? await prisma.classSession.findMany({
            where: {
              status: { not: "CANCELLED" },
              sessionDate: {
                gte: new Date(),
                lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
              },
              class: { branchId: student.branchId },
            },
            select: {
              id: true,
              sessionDate: true,
              startTime: true,
              endTime: true,
              class: { select: { className: true } },
            },
            orderBy: { sessionDate: "asc" },
            take: 100,
          })
        : [];

    // Build response
    const response = {
      id: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      status: student.status,
      phone: student.phone,
      dob: student.dob,
      address: student.address,
      gender: student.gender,
      referredBy: student.referredBy,
      enrollDate: student.enrollDate,
      notes: student.notes,
      evaluation: student.evaluation,
      leaveReason: student.leaveReason,
      lead: student.lead,
      kpis: {
        dueNowAmount,
        nextDueChargePeriod: nextDueCharge?.periodName ?? null,
        totalPaid,
        tuitionPaid,
        outstanding,
        totalCharged,
        chargesCount: student.charges.length,
        unpaidBookAmount,
        attendanceStats,
      },
      learningSnapshot,
      currentEnrollment: currentEnrollment
        ? {
            id: currentEnrollment.id,
            classId: currentEnrollment.classId,
            className: currentEnrollment.class.className,
            courseId: currentEnrollment.class.courseId,
            courseName: currentEnrollment.class.course?.name,
            enrollDate: currentEnrollment.enrollDate,
            learningStartDate: currentEnrollment.learningStartDate,
            billingModel: currentEnrollment.billingModel,
            paidCatchupSessionCount: currentEnrollment.paidCatchupSessionCount,
            paidCatchupAmount: enrollmentFinance.paidCatchup,
            nextClassName: currentEnrollment.class.nextClass?.className,
            nextClassId: currentEnrollment.class.nextClass?.id ?? null,
            scheduleRules: currentEnrollment.class.scheduleRules,
          }
        : null,
      continuationClassOptions,
      activeEnrollments: activeEnrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        classId: enrollment.classId,
        className: enrollment.class?.className ?? "Lớp chưa rõ tên",
        billingModel: enrollment.billingModel,
      })),
      primaryGuardian,
      allGuardians: student.guardians,
      charges: chargeSummaries,
      nextDueCharge,
      bookIssues: student.bookIssues.map((issue) => ({
        id: issue.id,
        bookId: issue.bookId,
        bookName: issue.book.name,
        quantity: issue.quantity,
        amount: issue.amount,
        issueDate: issue.issueDate.toISOString(),
        paymentStatus: issue.paymentStatus,
        className: issue.class?.className ?? null,
        notes: issue.notes,
      })),
      bookRequirements: student.bookRequirements.map((item) => ({
        id: item.id,
        className: item.class.className,
        bookName: item.book.name,
        quantity: item.quantity,
        totalAmount: item.totalAmount,
        status: item.status,
      })),
      scholarships: student.scholarships.map((item) => ({
        id: item.id,
        percentage: item.percentage,
        reason: item.reason,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo,
        enrollment: item.enrollment ? { id: item.enrollment.id, class: { className: item.enrollment.class.className } } : null,
      })),
      adjustments: student.adjustments.map((item) => ({
        id: item.id,
        percentage: item.percentage,
        reason: item.reason,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo,
        enrollment: item.enrollment ? { id: item.enrollment.id, class: { className: item.enrollment.class.className } } : null,
      })),
      enrollments: student.enrollments.map((e) => ({ id: e.id, className: e.class.className, status: e.status })),
      recentSessions,
      sessionCredits: student.sessionCredits.map((c) => ({
        id: c.id,
        status: c.status,
        origin: c.origin,
        notes: c.notes,
        paidAmount: c.paidAmount,
        sourceSession: c.sourceSession
          ? { sessionDate: c.sourceSession.sessionDate, class: c.sourceSession.class }
          : null,
        consumedSession: c.consumedSession
          ? { sessionDate: c.consumedSession.sessionDate, class: c.consumedSession.class }
          : null,
        className:
          c.sourceSession?.class.className ??
          c.consumedSession?.class.className ??
          currentEnrollment?.class?.className ??
          "Chưa rõ lớp",
      })),
      makeupSessionOptions: makeupSessionOptions.map((s) => ({
        id: s.id,
        sessionDate: s.sessionDate,
        startTime: s.startTime,
        endTime: s.endTime,
        class: s.class,
      })),
      operationalWarnings,
      statusHistory: student.statusHistory,
      transferHistory,
      enrollmentFinance: {
        ...enrollmentFinance,
        outstanding: enrollmentOutstanding,
      },
      permissions: {
        canEditStudent,
        canManageFinance,
        canSeeFinance,
        canManageInventory,
        canManageSchedule,
        canManageGuardianAccount,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching student drawer data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
