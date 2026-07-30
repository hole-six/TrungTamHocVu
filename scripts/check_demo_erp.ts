import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CheckResult = {
  name: string;
  ok: boolean;
  expected?: number | string;
  actual?: number | string;
  detail?: string;
};

function addCheck(
  checks: CheckResult[],
  name: string,
  ok: boolean,
  expected?: number | string,
  actual?: number | string,
  detail?: string,
) {
  checks.push({ name, ok, expected, actual, detail });
}

async function main() {
  const branch = await prisma.branch.findUnique({
    where: { code: "CS1" },
  });

  if (!branch) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: "Không tìm thấy dữ liệu demo cho cơ sở CS1. Hãy chạy `npm run seed:demo` trước.",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const [
    employees,
    users,
    guardians,
    leads,
    students,
    enrollments,
    sessions,
    assignments,
    attendances,
    timesheetPeriods,
    timesheetEntries,
    billingPeriods,
    payments,
    paymentAllocations,
    cashTransactions,
    paymentCashPostings,
    stockTransactions,
    stockCashPostings,
    bookIssues,
    payrollRuns,
    payrollLines,
    assets,
    assetTransactions,
    classRoom,
    student,
    charge,
    payment,
    stockReceipt,
    payrollRun,
  ] = await Promise.all([
    prisma.employee.findMany({ where: { branchId: branch.id } }),
    prisma.user.findMany({ where: { branchId: branch.id } }),
    prisma.guardian.findMany(),
    prisma.lead.findMany({ where: { branchId: branch.id } }),
    prisma.student.findMany({ where: { branchId: branch.id } }),
    prisma.enrollment.findMany({
      include: { class: true, student: true },
    }),
    prisma.classSession.findMany({
      where: { class: { branchId: branch.id } },
    }),
    prisma.sessionAssignment.findMany({
      include: { employee: true, session: true },
    }),
    prisma.studentAttendance.findMany({
      include: { student: true, session: true },
    }),
    prisma.timesheetPeriod.findMany({ where: { branchId: branch.id } }),
    prisma.timesheetEntry.findMany({
      include: { employee: true, period: true },
    }),
    prisma.billingPeriod.findMany({ where: { branchId: branch.id } }),
    prisma.payment.findMany({ include: { student: true } }),
    prisma.paymentAllocation.findMany({ include: { charge: true, payment: true } }),
    prisma.cashTransaction.findMany({ where: { branchId: branch.id } }),
    prisma.paymentCashPosting.findMany({
      include: { payment: true, cashTransaction: true },
    }),
    prisma.stockTransaction.findMany({
      include: { book: true, cashPosting: { include: { cashTransaction: true } } },
    }),
    prisma.stockCashPosting.findMany({
      include: { stockTransaction: true, cashTransaction: true },
    }),
    prisma.bookIssue.findMany({
      include: { book: true, student: true, charge: true },
    }),
    prisma.payrollRun.findMany({ where: { branchId: branch.id } }),
    prisma.payrollLine.findMany({ include: { employee: true, payrollRun: true } }),
    prisma.asset.findMany({ where: { branchId: branch.id } }),
    prisma.assetTransaction.findMany({ include: { asset: true } }),
    prisma.class.findUnique({
      where: { classCode: "FF-A1" },
      include: {
        course: true,
        scheduleRules: true,
        sessions: true,
        enrollments: { include: { student: true } },
      },
    }),
    prisma.student.findUnique({
      where: { studentCode: "STU-0001" },
      include: {
        lead: true,
        guardians: { include: { guardian: true } },
        enrollments: { include: { class: true } },
        charges: true,
        payments: true,
        bookIssues: true,
      },
    }),
    prisma.charge.findFirst({
      where: {
        student: { studentCode: "STU-0001" },
      },
        include: {
          student: true,
          class: true,
          billingPeriod: true,
          invoice: true,
          bookIssues: true,
          allocations: { include: { payment: true } },
        },
      }),
    prisma.payment.findUnique({
      where: { paymentNo: "PAY-2026-07-0001" },
      include: {
        student: true,
        allocations: { include: { charge: true } },
        cashPosting: { include: { cashTransaction: true } },
      },
    }),
    prisma.stockTransaction.findFirst({
      where: {
        type: "RECEIPT",
        totalAmount: 1500000,
      },
      include: {
        book: true,
        cashPosting: { include: { cashTransaction: true } },
      },
    }),
    prisma.payrollRun.findFirst({
      where: { branchId: branch.id, periodName: "2026-07" },
      include: {
        lines: { include: { employee: true } },
      },
    }),
  ]);

  const checks: CheckResult[] = [];

  addCheck(checks, "Nhân sự demo", employees.length === 3, 3, employees.length);
  addCheck(checks, "Tài khoản demo", users.length === 3, 3, users.length);
  addCheck(checks, "Phụ huynh demo", guardians.length >= 1, ">= 1", guardians.length);
  addCheck(checks, "Lead demo", leads.length >= 1, ">= 1", leads.length);
  addCheck(checks, "Học viên demo", students.length >= 1, ">= 1", students.length);
  addCheck(checks, "Ghi danh demo", enrollments.length >= 1, ">= 1", enrollments.length);
  addCheck(checks, "Buổi học demo", sessions.length >= 1, ">= 1", sessions.length);
  addCheck(checks, "Phân công buổi học", assignments.length >= 2, ">= 2", assignments.length);
  addCheck(checks, "Điểm danh", attendances.length >= 1, ">= 1", attendances.length);
  addCheck(checks, "Kỳ công", timesheetPeriods.length >= 1, ">= 1", timesheetPeriods.length);
  addCheck(checks, "Chấm công", timesheetEntries.length >= 1, ">= 1", timesheetEntries.length);
  addCheck(checks, "Kỳ tính phí", billingPeriods.length >= 1, ">= 1", billingPeriods.length);
  addCheck(checks, "Thanh toán", payments.length >= 1, ">= 1", payments.length);
  addCheck(checks, "Phân bổ thanh toán", paymentAllocations.length >= 1, ">= 1", paymentAllocations.length);
  addCheck(checks, "Thu chi tiền mặt", cashTransactions.length >= 2, ">= 2", cashTransactions.length);
  addCheck(checks, "Hạch toán thu học phí", paymentCashPostings.length >= 1, ">= 1", paymentCashPostings.length);
  addCheck(checks, "Nhập kho", stockTransactions.length >= 1, ">= 1", stockTransactions.length);
  addCheck(checks, "Hạch toán nhập kho", stockCashPostings.length >= 1, ">= 1", stockCashPostings.length);
  addCheck(checks, "Xuất giáo trình", bookIssues.length >= 1, ">= 1", bookIssues.length);
  addCheck(checks, "Bảng lương", payrollRuns.length >= 1, ">= 1", payrollRuns.length);
  addCheck(checks, "Dòng lương", payrollLines.length >= 1, ">= 1", payrollLines.length);
  addCheck(checks, "Tài sản", assets.length >= 1, ">= 1", assets.length);
  addCheck(checks, "Giao dịch tài sản", assetTransactions.length >= 1, ">= 1", assetTransactions.length);

  addCheck(
    checks,
    "Lớp FF-A1 tồn tại",
    Boolean(classRoom),
    "FF-A1",
    classRoom?.classCode ?? "missing",
  );
  addCheck(
    checks,
    "Lớp có lịch học",
    (classRoom?.scheduleRules.length ?? 0) >= 1,
    ">= 1",
    classRoom?.scheduleRules.length ?? 0,
  );
  addCheck(
    checks,
    "Lớp có học viên",
    (classRoom?.enrollments.length ?? 0) >= 1,
    ">= 1",
    classRoom?.enrollments.length ?? 0,
  );

  addCheck(
    checks,
    "Học viên STU-0001 tồn tại",
    Boolean(student),
    "STU-0001",
    student?.studentCode ?? "missing",
  );
  addCheck(
    checks,
    "Học viên có phụ huynh chính",
    (student?.guardians.filter((item) => item.isPrimary).length ?? 0) >= 1,
    ">= 1",
    student?.guardians.filter((item) => item.isPrimary).length ?? 0,
  );
  addCheck(
    checks,
    "Học viên đã ghi danh",
    (student?.enrollments.length ?? 0) >= 1,
    ">= 1",
    student?.enrollments.length ?? 0,
  );

  const allocationTotal =
    payment?.allocations.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const chargeTotal = charge?.totalAmount ?? 0;
  const paymentAmount = payment?.amount ?? 0;
  const paymentPostingAmount = payment?.cashPosting?.amount ?? 0;

  addCheck(
    checks,
    "Tổng phí = tổng thu",
    chargeTotal === paymentAmount,
    chargeTotal,
    paymentAmount,
  );
  addCheck(
    checks,
    "Tổng thu = tổng phân bổ",
    paymentAmount === allocationTotal,
    paymentAmount,
    allocationTotal,
  );
  addCheck(
    checks,
    "Thu tiền = bút toán quỹ",
    paymentAmount === paymentPostingAmount,
    paymentAmount,
    paymentPostingAmount,
  );

  const stockPostingAmount = stockReceipt?.cashPosting?.amount ?? 0;
  const stockCashTxnAmount = stockReceipt?.cashPosting?.cashTransaction.amount ?? 0;
  const stockTotal = stockReceipt?.totalAmount ?? 0;

  addCheck(
    checks,
    "Nhập kho = hạch toán kho",
    stockTotal === stockPostingAmount,
    stockTotal,
    stockPostingAmount,
  );
  addCheck(
    checks,
    "Hạch toán kho = phiếu chi",
    stockPostingAmount === stockCashTxnAmount,
    stockPostingAmount,
    stockCashTxnAmount,
  );

  const payrollLine = payrollRun?.lines.find((line) => line.employee.employeeCode === "EMP-T001");
  addCheck(
    checks,
    "Lương giáo viên demo",
    Boolean(payrollLine && payrollLine.totalAmount === 4320000),
    4320000,
    payrollLine?.totalAmount ?? 0,
  );

  const teacherAssignment = assignments.find((item) => item.role === "TEACHER");
  const assistantAssignment = assignments.find((item) => item.role === "ASSISTANT");
  addCheck(
    checks,
    "Ca giáo viên đúng đơn giá",
    Boolean(teacherAssignment && teacherAssignment.amount === 270000),
    270000,
    teacherAssignment?.amount ?? 0,
  );
  addCheck(
    checks,
    "Ca trợ giảng đúng đơn giá",
    Boolean(assistantAssignment && assistantAssignment.amount === 135000),
    135000,
    assistantAssignment?.amount ?? 0,
  );

  const issuedBook = bookIssues.find((item) => item.student.studentCode === "STU-0001");
  addCheck(
    checks,
    "Giáo trình gắn vào công nợ",
    Boolean(issuedBook?.chargeId),
    "charge linked",
    issuedBook?.chargeId ? "charge linked" : "missing",
  );
  addCheck(
    checks,
    "Giáo trình đúng số tiền",
    Boolean(issuedBook && issuedBook.amount === 150000),
    150000,
    issuedBook?.amount ?? 0,
  );

  const failedChecks = checks.filter((item) => !item.ok);

  const summary = {
    ok: failedChecks.length === 0,
    branch: {
      code: branch.code,
      name: branch.name,
    },
    counts: {
      employees: employees.length,
      users: users.length,
      guardians: guardians.length,
      leads: leads.length,
      students: students.length,
      enrollments: enrollments.length,
      sessions: sessions.length,
      assignments: assignments.length,
      attendances: attendances.length,
      billingPeriods: billingPeriods.length,
      payments: payments.length,
      paymentAllocations: paymentAllocations.length,
      cashTransactions: cashTransactions.length,
      stockTransactions: stockTransactions.length,
      bookIssues: bookIssues.length,
      payrollRuns: payrollRuns.length,
      payrollLines: payrollLines.length,
      assets: assets.length,
      assetTransactions: assetTransactions.length,
    },
    flow: {
      studentCode: student?.studentCode ?? null,
      studentName: student?.fullName ?? null,
      classCode: classRoom?.classCode ?? null,
      className: classRoom?.className ?? null,
      chargeTotal,
      paymentAmount,
      allocationTotal,
      paymentPostingAmount,
      stockTotal,
      stockPostingAmount,
      stockCashTxnAmount,
      payrollTeacherAmount: payrollLine?.totalAmount ?? null,
      issuedBookAmount: issuedBook?.amount ?? null,
    },
    checks,
    failedChecks: failedChecks.map((item) => item.name),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failedChecks.length > 0) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
