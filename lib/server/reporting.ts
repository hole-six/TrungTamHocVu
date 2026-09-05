import { prisma } from "../prisma";
import { LEAD_STATUSES } from "./lead-rules";
import { chargeOwnDueAmount } from "./tuition-rules";

export type BranchScope = string | null;

type TuitionByClassRow = {
  className: string;
  sessionCount: number;
  tuitionTotal: number;
  materialsTotal: number;
  billed: number;
  collected: number;
};

// month: "YYYY-MM" — khi có, lọc "theo tháng" đúng ý xlsx feedback (data tuyển sinh,
// doanh thu, dòng tiền, học viên mới/nghỉ của ĐÚNG tháng đó); khi không truyền (undefined),
// giữ nguyên hành vi tổng hợp/snapshot hiện tại (spec: "không click thì tự tổng hợp").
export async function getReportsDashboardData(branchId: BranchScope, month?: string) {
  const branchWhere = branchId ? { branchId } : {};
  const currentMonth = new Date().getMonth() + 1;
  const bookIssueWhere = branchId ? { student: { branchId } } : {};

  let monthRange: { gte: Date; lte: Date } | null = null;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    monthRange = { gte: new Date(y, m - 1, 1, 0, 0, 0, 0), lte: new Date(y, m, 0, 23, 59, 59, 999) };
  }

  const [
    studentActive,
    studentLeft,
    byLeadStatus,
    recentPeriods,
    activeStudents,
    bookIssueSum,
    stockReceiptSum,
    topBooks,
    payrollRuns,
    cashByType,
    birthdayStudents,
    latestPeriodWithCharges,
    latestPayrollRun,
    qualifiedLeadsWithoutClass,
    newEnrollmentsInMonth,
    leftInMonth,
    waitingForClass,
  ] = await Promise.all([
    prisma.student.count({ where: { ...branchWhere, status: "ACTIVE" } }),
    prisma.student.count({ where: { ...branchWhere, status: "LEFT" } }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { ...branchWhere, ...(monthRange ? { createdAt: monthRange } : {}) },
      _count: { _all: true },
    }),
    month
      ? prisma.billingPeriod.findMany({
          where: { ...branchWhere, periodName: month },
          orderBy: { periodName: "desc" },
          include: {
            charges: {
              include: {
                allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } },
              },
            },
          },
        })
      : prisma.billingPeriod.findMany({
          where: branchWhere,
          orderBy: { periodName: "desc" },
          take: 6,
          include: {
            charges: {
              include: {
                allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } },
              },
            },
          },
        }),
    prisma.student.findMany({
      where: { ...branchWhere, status: "ACTIVE" },
      include: {
        lead: true,
        guardians: {
          include: { guardian: { include: { user: true } } },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: { class: true },
          orderBy: { enrollDate: "desc" },
          take: 1,
        },
      },
    }),
    prisma.bookIssue.aggregate({ where: bookIssueWhere, _sum: { amount: true } }),
    prisma.stockTransaction.aggregate({
      where: { type: "RECEIPT", book: branchWhere },
      _sum: { totalAmount: true },
    }),
    prisma.book.findMany({
      where: branchWhere,
      include: { bookIssues: { select: { amount: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.payrollRun.findMany({
      where: branchWhere,
      orderBy: { periodName: "desc" },
      take: 6,
      include: { lines: { select: { totalAmount: true } } },
    }),
    prisma.cashTransaction.groupBy({
      by: ["type"],
      where: { ...branchWhere, status: { not: "VOIDED" }, ...(monthRange ? { txnDate: monthRange } : {}) },
      _sum: { amount: true },
    }),
    prisma.student.findMany({
      where: { ...branchWhere, status: "ACTIVE" },
      select: { id: true, fullName: true, dob: true, studentCode: true },
    }),
    prisma.billingPeriod.findFirst({
      where: branchWhere,
      orderBy: { periodName: "desc" },
      include: {
        charges: {
          include: {
            class: true,
            allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } },
          },
        },
      },
    }),
    prisma.payrollRun.findFirst({
      where: branchWhere,
      orderBy: { periodName: "desc" },
      include: { lines: { include: { employee: true } } },
    }),
    prisma.lead.count({
      where: {
        ...branchWhere,
        status: "QUALIFIED",
        interestedClassId: null,
        student: null,
      },
    }),
    // "Học sinh mới nhập học" theo đúng tháng đang xem — khi không chọn tháng
    // (monthRange null) đếm luôn cả năm hiện tại để KPI này không hiện "0" vô nghĩa.
    prisma.student.count({
      where: { ...branchWhere, enrollDate: monthRange ?? { gte: new Date(new Date().getFullYear(), 0, 1) } },
    }),
    prisma.student.count({
      where: { ...branchWhere, leaveDate: monthRange ?? { gte: new Date(new Date().getFullYear(), 0, 1) } },
    }),
    // "Học sinh chờ lớp mới" — ACTIVE nhưng không còn enrollment nào đang ACTIVE; đây
    // luôn là 1 snapshot hiện tại (không có ý nghĩa "chờ lớp của tháng X" trong quá khứ).
    prisma.student.count({
      where: { ...branchWhere, status: "ACTIVE", enrollments: { none: { status: "ACTIVE" } } },
    }),
  ]);

  const activeStudentIds = activeStudents.map((student) => student.id);
  const charges = activeStudentIds.length
    ? await prisma.charge.findMany({
        where: { studentId: { in: activeStudentIds } },
        select: { id: true, studentId: true, tuitionAmount: true, materialsAmount: true },
      })
    : [];
  const allocations = charges.length
    ? await prisma.paymentAllocation.findMany({
        where: {
          chargeId: { in: charges.map((charge) => charge.id) },
          payment: { status: { notIn: ["VOIDED", "REFUNDED"] } },
        },
        select: { chargeId: true, amount: true },
      })
    : [];

  const chargeOwner = new Map(charges.map((charge) => [charge.id, charge.studentId]));
  // chargeOwnDueAmount (không dùng totalAmount) — cộng dồn qua NHIỀU charge của cùng 1
  // học viên, nếu dùng totalAmount trực tiếp sẽ đếm trùng nợ cũ (openingBalance) vốn đã
  // được tính ở chính charge kỳ trước.
  const chargeByStudent = new Map<string, number>();
  for (const charge of charges) {
    chargeByStudent.set(charge.studentId, (chargeByStudent.get(charge.studentId) ?? 0) + chargeOwnDueAmount(charge));
  }
  const paidByStudent = new Map<string, number>();
  for (const allocation of allocations) {
    const studentId = chargeOwner.get(allocation.chargeId);
    if (!studentId) continue;
    paidByStudent.set(studentId, (paidByStudent.get(studentId) ?? 0) + allocation.amount);
  }

  const birthdayThisMonth = birthdayStudents
    .filter((student) => student.dob && new Date(student.dob).getMonth() + 1 === currentMonth)
    .sort((left, right) => new Date(left.dob!).getDate() - new Date(right.dob!).getDate());

  const tuitionByClass: TuitionByClassRow[] = latestPeriodWithCharges
    ? Object.values(
        latestPeriodWithCharges.charges.reduce(
          (accumulator, charge) => {
            const key = charge.classId;
            if (!accumulator[key]) {
              accumulator[key] = {
                className: charge.class.className,
                sessionCount: 0,
                tuitionTotal: 0,
                materialsTotal: 0,
                billed: 0,
                collected: 0,
              };
            }
            accumulator[key].sessionCount += charge.sessionCount;
            accumulator[key].tuitionTotal += charge.tuitionAmount;
            accumulator[key].materialsTotal += charge.materialsAmount;
            accumulator[key].billed += charge.totalAmount;
            accumulator[key].collected += charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
            return accumulator;
          },
          {} as Record<string, TuitionByClassRow>
        )
      )
    : [];

  const payrollBreakdown = latestPayrollRun
    ? {
        periodName: latestPayrollRun.periodName,
        teachers: latestPayrollRun.lines
          .filter((line) => line.teachingHours > 0)
          .map((line) => ({
            name: line.employee.fullName,
            hours: line.teachingHours,
            amount: line.teachingAmount,
          }))
          .sort((left, right) => right.amount - left.amount),
        assistants: latestPayrollRun.lines
          .filter((line) => line.assistantHours > 0)
          .map((line) => ({
            name: line.employee.fullName,
            hours: line.assistantHours,
            amount: line.assistantAmount,
          }))
          .sort((left, right) => right.amount - left.amount),
      }
    : null;

  const leadPipeline = Object.fromEntries(LEAD_STATUSES.map((status) => [status, 0])) as Record<string, number>;
  for (const row of byLeadStatus) {
    leadPipeline[row.status] = row._count._all;
  }

  const totalLeads = Object.values(leadPipeline).reduce((sum, count) => sum + count, 0);
  const enrolledLeads = leadPipeline.ENROLLED ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((enrolledLeads / totalLeads) * 100) : 0;

  const revenueByPeriod = recentPeriods
    .map((period) => ({
      period: period.periodName,
      billed: period.charges.reduce((sum, charge) => sum + charge.totalAmount, 0),
      collected: period.charges.reduce(
        (sum, charge) => sum + charge.allocations.reduce((allocationSum, allocation) => allocationSum + allocation.amount, 0),
        0
      ),
    }))
    .reverse();

  const debtors = activeStudents
    .map((student) => {
      const primaryGuardian = student.guardians.find((item) => item.isPrimary)?.guardian ?? student.guardians[0]?.guardian ?? null;
      const currentEnrollment = student.enrollments[0] ?? null;
      const outstanding = (chargeByStudent.get(student.id) ?? 0) - (paidByStudent.get(student.id) ?? 0);
      return {
        id: student.id,
        fullName: student.fullName,
        studentCode: student.studentCode,
        outstanding,
        guardianName: primaryGuardian?.fullName ?? null,
        guardianPhone: primaryGuardian?.phone ?? null,
        guardianPortalEmail: primaryGuardian?.user?.email ?? null,
        guardianPortalActive: primaryGuardian?.user?.isActive ?? false,
        leadCode: student.lead?.leadCode ?? null,
        className: currentEnrollment?.class?.className ?? currentEnrollment?.packageLabel ?? null,
      };
    })
    .filter((student) => student.outstanding > 0)
    .sort((left, right) => right.outstanding - left.outstanding)
    .slice(0, 10);

  const activePortalStudents = activeStudents.filter((student) => {
    const primaryGuardian = student.guardians.find((item) => item.isPrimary)?.guardian ?? student.guardians[0]?.guardian ?? null;
    return Boolean(primaryGuardian?.user?.isActive);
  }).length;

  const convertedStudentsWithoutPortal = activeStudents.filter((student) => {
    const primaryGuardian = student.guardians.find((item) => item.isPrimary)?.guardian ?? student.guardians[0]?.guardian ?? null;
    return Boolean(student.leadId) && !primaryGuardian?.user?.isActive;
  }).length;

  const bookRanking = topBooks
    .map((book) => ({
      name: book.name,
      total: book.bookIssues.reduce((sum, issue) => sum + issue.amount, 0),
    }))
    .filter((book) => book.total > 0)
    .sort((left, right) => right.total - left.total)
    .slice(0, 5);

  const payrollByPeriod = payrollRuns
    .map((run) => ({
      period: run.periodName,
      total: run.lines.reduce((sum, line) => sum + line.totalAmount, 0),
    }))
    .reverse();

  const totalThu = cashByType.find((item) => item.type === "THU")?._sum.amount ?? 0;
  const totalChi = cashByType.find((item) => item.type === "CHI")?._sum.amount ?? 0;

  return {
    studentActive,
    studentLeft,
    newEnrollmentsInMonth,
    leftInMonth,
    waitingForClass,
    activeMonth: month ?? null,
    leadPipeline,
    totalLeads,
    conversionRate,
    revenueByPeriod,
    debtors,
    portalCoverageCount: activePortalStudents,
    studentsWithoutPortal: studentActive - activePortalStudents,
    convertedStudentsWithoutPortal,
    qualifiedLeadsWithoutClass,
    materialsTotal: bookIssueSum._sum.amount ?? 0,
    materialsCost: stockReceiptSum._sum.totalAmount ?? 0,
    materialsProfit: (bookIssueSum._sum.amount ?? 0) - (stockReceiptSum._sum.totalAmount ?? 0),
    bookRanking,
    payrollByPeriod,
    totalThu,
    totalChi,
    birthdayThisMonth,
    tuitionByClass,
    payrollBreakdown,
  };
}

export async function getReportHsSummary(branchId: BranchScope) {
  const branchWhere = branchId ? { branchId } : {};

  const [activeStudents, leftStudents, newEnrollments, studentsByClass] = await Promise.all([
    prisma.student.count({ where: { ...branchWhere, status: "ACTIVE" } }),
    prisma.student.count({ where: { ...branchWhere, status: "LEFT" } }),
    prisma.student.count({ where: { ...branchWhere, enrollDate: { not: null } } }),
    prisma.class.findMany({
      where: branchWhere,
      orderBy: { className: "asc" },
      include: {
        enrollments: {
          include: { student: true },
        },
      },
    }),
  ]);

  return {
    activeStudents,
    leftStudents,
    newEnrollments,
    totalStudents: activeStudents + leftStudents,
    classes: studentsByClass.map((classRoom) => {
      const activeCount = classRoom.enrollments.filter(
        (enrollment) => enrollment.status === "ACTIVE" && enrollment.student.status === "ACTIVE"
      ).length;
      const leftCount = classRoom.enrollments.filter(
        (enrollment) => enrollment.student.status === "LEFT" || enrollment.status !== "ACTIVE"
      ).length;
      return {
        classCode: classRoom.classCode,
        className: classRoom.className,
        activeCount,
        leftCount,
        totalCount: activeCount + leftCount,
      };
    }),
  };
}

export async function getReportHpSummary(branchId: BranchScope) {
  const branchWhere = branchId ? { branchId } : {};

  const latestPeriod = await prisma.billingPeriod.findFirst({
    where: branchWhere,
    orderBy: { periodName: "desc" },
    include: {
      charges: {
        include: {
          class: true,
          student: true,
          allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } } },
        },
      },
    },
  });

  if (!latestPeriod) {
    return {
      periodName: null,
      totals: {
        sessionCount: 0,
        materialsAmount: 0,
        openingBalance: 0,
        tuitionAmount: 0,
        billedAmount: 0,
        collectedAmount: 0,
        remainingAmount: 0,
      },
      classes: [],
    };
  }

  const classes = Object.values(
    latestPeriod.charges.reduce(
      (accumulator, charge) => {
        const key = charge.classId;
        if (!accumulator[key]) {
          accumulator[key] = {
            classCode: charge.class.classCode,
            className: charge.class.className,
            sessionCount: 0,
            materialsAmount: 0,
            openingBalance: 0,
            tuitionAmount: 0,
            billedAmount: 0,
            collectedAmount: 0,
            remainingAmount: 0,
            studentCount: 0,
          };
        }

        const collectedAmount = charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
        accumulator[key].sessionCount += charge.sessionCount;
        accumulator[key].materialsAmount += charge.materialsAmount;
        accumulator[key].openingBalance += charge.openingBalance;
        accumulator[key].tuitionAmount += charge.tuitionAmount;
        accumulator[key].billedAmount += charge.totalAmount;
        accumulator[key].collectedAmount += collectedAmount;
        // chargeOwnDueAmount cho remainingAmount (billedAmount vẫn giữ totalAmount để
        // hiển thị đúng số đã lập hóa đơn gồm cả nợ cũ mang sang).
        accumulator[key].remainingAmount += Math.max(chargeOwnDueAmount(charge) - collectedAmount, 0);
        accumulator[key].studentCount += 1;
        return accumulator;
      },
      {} as Record<
        string,
        {
          classCode: string;
          className: string;
          sessionCount: number;
          materialsAmount: number;
          openingBalance: number;
          tuitionAmount: number;
          billedAmount: number;
          collectedAmount: number;
          remainingAmount: number;
          studentCount: number;
        }
      >
    )
  ).sort((left, right) => left.className.localeCompare(right.className, "vi"));

  const totals = classes.reduce(
    (sum, classRow) => ({
      sessionCount: sum.sessionCount + classRow.sessionCount,
      materialsAmount: sum.materialsAmount + classRow.materialsAmount,
      openingBalance: sum.openingBalance + classRow.openingBalance,
      tuitionAmount: sum.tuitionAmount + classRow.tuitionAmount,
      billedAmount: sum.billedAmount + classRow.billedAmount,
      collectedAmount: sum.collectedAmount + classRow.collectedAmount,
      remainingAmount: sum.remainingAmount + classRow.remainingAmount,
    }),
    {
      sessionCount: 0,
      materialsAmount: 0,
      openingBalance: 0,
      tuitionAmount: 0,
      billedAmount: 0,
      collectedAmount: 0,
      remainingAmount: 0,
    }
  );

  return {
    periodName: latestPeriod.periodName,
    totals,
    classes,
  };
}
