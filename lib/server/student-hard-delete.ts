import type { Prisma, PrismaClient } from "@prisma/client";
import { syncBookQuantityOnHand } from "@/lib/server/database-sync";

type Db = PrismaClient | Prisma.TransactionClient;

export type StudentDeletePreview = {
  student: {
    id: string;
    studentCode: string;
    fullName: string;
    branchId: string;
    status: string;
    dob: Date | null;
  };
  confirmationText: string;
  summary: {
    enrollmentCount: number;
    chargeCount: number;
    paymentCount: number;
    attendanceCount: number;
    bookIssueCount: number;
    bookIssueQuantity: number;
    sessionCreditCount: number;
    journalEntryCount: number;
    totalCharged: number;
    totalPaid: number;
    totalRefunded: number;
    bookIssueAmount: number;
    chargedBookAmount: number;
  };
  warnings: string[];
};

export class StudentDeleteConfirmationError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = "StudentDeleteConfirmationError";
  }
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export async function buildStudentDeletePreview(db: Db, studentId: string): Promise<StudentDeletePreview | null> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, studentCode: true, fullName: true, branchId: true, status: true, dob: true },
  });
  if (!student) return null;

  const [
    enrollments,
    chargeAgg,
    chargeCount,
    paymentAgg,
    paymentCount,
    refundAgg,
    attendanceCount,
    bookIssueAgg,
    bookIssueCount,
    sessionCreditCount,
    journalEntryCount,
  ] = await Promise.all([
    db.enrollment.findMany({ where: { studentId }, select: { id: true } }),
    db.charge.aggregate({
      where: { studentId },
      _sum: { totalAmount: true, tuitionAmount: true, materialsAmount: true, openingBalance: true },
    }),
    db.charge.count({ where: { studentId } }),
    db.payment.aggregate({ where: { studentId }, _sum: { amount: true } }),
    db.payment.count({ where: { studentId } }),
    db.refund.aggregate({ where: { payment: { studentId } }, _sum: { amount: true } }),
    db.studentAttendance.count({ where: { studentId } }),
    db.bookIssue.aggregate({ where: { studentId }, _sum: { amount: true, quantity: true } }),
    db.bookIssue.count({ where: { studentId } }),
    db.sessionCredit.count({ where: { studentId } }),
    db.journalEntry.count({ where: { studentId } }),
  ]);

  const chargedBookAmount = chargeAgg._sum.materialsAmount ?? 0;
  const totalPaid = paymentAgg._sum.amount ?? 0;
  const totalRefunded = refundAgg._sum.amount ?? 0;
  const warnings = [
    totalPaid > 0
      ? `Đã ghi nhận ${totalPaid.toLocaleString("vi-VN")}đ tiền thu. Xóa hẳn sẽ làm báo cáo doanh thu/lịch sử thu tiền giảm theo số này.`
      : null,
    chargedBookAmount > 0 || (bookIssueAgg._sum.amount ?? 0) > 0
      ? "Có dữ liệu sách/giáo trình. Khi xóa, các dòng phát sách bị gỡ và tồn kho được tính lại."
      : null,
    attendanceCount > 0 ? "Có điểm danh/lịch sử học. Xóa xong không còn xem lại được từ hồ sơ học viên." : null,
  ].filter(Boolean) as string[];

  return {
    student,
    confirmationText: `XOA ${student.studentCode}`,
    summary: {
      enrollmentCount: enrollments.length,
      chargeCount,
      paymentCount,
      attendanceCount,
      bookIssueCount,
      bookIssueQuantity: bookIssueAgg._sum.quantity ?? 0,
      sessionCreditCount,
      journalEntryCount,
      totalCharged: chargeAgg._sum.totalAmount ?? 0,
      totalPaid,
      totalRefunded,
      bookIssueAmount: bookIssueAgg._sum.amount ?? 0,
      chargedBookAmount,
    },
    warnings,
  };
}

export async function hardDeleteStudent(params: {
  db: PrismaClient;
  studentId: string;
  confirmationText: string;
  userId: string;
}) {
  const preview = await buildStudentDeletePreview(params.db, params.studentId);
  if (!preview) return null;
  if (params.confirmationText !== preview.confirmationText) {
    throw new StudentDeleteConfirmationError(`Gõ đúng "${preview.confirmationText}" để xác nhận xóa hẳn học viên này.`);
  }

  const touchedBookIds = new Set<string>();
  const deleted = await params.db.$transaction(async (tx) => {
    const snapshot = await buildStudentDeleteSnapshot(tx, params.studentId);
    snapshot.bookIssues.forEach((issue) => touchedBookIds.add(issue.bookId));

    const paymentIds = snapshot.payments.map((item) => item.id);
    const chargeIds = snapshot.charges.map((item) => item.id);
    const enrollmentIds = snapshot.enrollments.map((item) => item.id);
    const cashTransactionIds = [
      ...snapshot.paymentCashPostings.map((item) => item.cashTransactionId),
      ...snapshot.refundCashPostings.map((item) => item.cashTransactionId),
    ];

    await tx.auditLog.create({
      data: {
        userId: params.userId,
        branchId: preview.student.branchId,
        action: "hard-delete",
        entityType: "Student",
        entityId: params.studentId,
        before: JSON.stringify(snapshot),
        reason: `Hard delete student ${preview.student.studentCode}`,
      },
    });

    if (cashTransactionIds.length) await tx.cashTransaction.deleteMany({ where: { id: { in: cashTransactionIds } } });
    if (snapshot.bookIssues.length) await tx.bookIssue.deleteMany({ where: { studentId: params.studentId } });
    if (chargeIds.length) await tx.charge.deleteMany({ where: { id: { in: chargeIds } } });
    if (paymentIds.length) await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
    await tx.creditBalance.deleteMany({ where: { studentId: params.studentId } });
    await tx.makeupRequest.deleteMany({ where: { studentId: params.studentId } });
    await tx.studentAttendance.deleteMany({ where: { studentId: params.studentId } });
    await tx.sessionCredit.deleteMany({ where: { studentId: params.studentId } });
    await tx.enrollmentStatusHistory.deleteMany({ where: { studentId: params.studentId } });
    await tx.studentBookRequirement.deleteMany({ where: { studentId: params.studentId } });
    await tx.scholarship.deleteMany({ where: { studentId: params.studentId } });
    await tx.adjustment.deleteMany({ where: { studentId: params.studentId } });
    if (enrollmentIds.length) await tx.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
    await tx.student.delete({ where: { id: params.studentId } });

    return snapshot;
  });

  for (const bookId of touchedBookIds) {
    await syncBookQuantityOnHand(bookId);
  }

  return { preview, deleted };
}

async function buildStudentDeleteSnapshot(db: Db, studentId: string) {
  const [
    student,
    enrollments,
    charges,
    payments,
    refunds,
    paymentCashPostings,
    refundCashPostings,
    bookIssues,
    studentBookRequirements,
    attendances,
    sessionCredits,
    makeupRequests,
    journalEntries,
    schoolExamScores,
    creditBalances,
    scholarships,
    adjustments,
    enrollmentStatusHistory,
  ] = await Promise.all([
    db.student.findUnique({ where: { id: studentId }, include: { guardians: { include: { guardian: true } }, lead: true } }),
    db.enrollment.findMany({ where: { studentId } }),
    db.charge.findMany({ where: { studentId }, include: { allocations: true, invoice: true } }),
    db.payment.findMany({ where: { studentId }, include: { allocations: true, refunds: true, creditBalances: true, cashPosting: true } }),
    db.refund.findMany({ where: { payment: { studentId } } }),
    db.paymentCashPosting.findMany({ where: { payment: { studentId } } }),
    db.refundCashPosting.findMany({ where: { refund: { payment: { studentId } } } }),
    db.bookIssue.findMany({ where: { studentId }, include: { book: true, class: true } }),
    db.studentBookRequirement.findMany({ where: { studentId }, include: { book: true, class: true } }),
    db.studentAttendance.findMany({ where: { studentId } }),
    db.sessionCredit.findMany({ where: { studentId } }),
    db.makeupRequest.findMany({ where: { studentId } }),
    db.journalEntry.findMany({ where: { studentId }, include: { scores: true } }),
    db.schoolExamScore.findMany({ where: { studentId } }),
    db.creditBalance.findMany({ where: { studentId } }),
    db.scholarship.findMany({ where: { studentId } }),
    db.adjustment.findMany({ where: { studentId } }),
    db.enrollmentStatusHistory.findMany({ where: { studentId } }),
  ]);

  return {
    student,
    previewSummary: {
      chargeCount: charges.length,
      paymentCount: payments.length,
      attendanceCount: attendances.length,
      bookIssueCount: bookIssues.length,
      totalCharged: sum(charges.map((item) => item.totalAmount)),
      totalPaid: sum(payments.map((item) => item.amount)),
      totalRefunded: sum(refunds.map((item) => item.amount)),
      bookIssueAmount: sum(bookIssues.map((item) => item.amount)),
    },
    enrollments,
    charges,
    payments,
    refunds,
    paymentCashPostings,
    refundCashPostings,
    bookIssues,
    studentBookRequirements,
    attendances,
    sessionCredits,
    makeupRequests,
    journalEntries,
    schoolExamScores,
    creditBalances,
    scholarships,
    adjustments,
    enrollmentStatusHistory,
  };
}
