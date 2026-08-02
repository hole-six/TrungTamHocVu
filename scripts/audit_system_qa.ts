import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { getBatchInvoiceViewData } from "../lib/server/batch-invoice-view";
import { previewChargeGenerationExceptions } from "../lib/server/billing-generation";
import { PAYMENT_STATUS_LABEL } from "../lib/server/tuition-rules";

const prisma = new PrismaClient();
const AUDIT_DIR = join(process.cwd(), ".qa");
const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"] as const;

type Severity = "PASS" | "P0" | "P1" | "P2";
type Finding = {
  key: string;
  module: string;
  title: string;
  severity: Severity;
  passed: boolean;
  summary: string;
  details?: string[];
  sample?: unknown;
};

function vnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function addFinding(
  findings: Finding[],
  input: Omit<Finding, "severity"> & { severity?: Severity },
) {
  findings.push({
    ...input,
    severity: input.passed ? "PASS" : input.severity ?? "P1",
  });
}

function remainingAmount(totalAmount: number, paidAmount: number) {
  return Math.max(totalAmount - paidAmount, 0);
}

async function main() {
  mkdirSync(AUDIT_DIR, { recursive: true });

  const now = new Date("2026-08-02T00:00:00.000Z");
  const findings: Finding[] = [];

  const branch = await prisma.branch.findUnique({ where: { code: "CS1" } });
  if (!branch) {
    throw new Error("Không tìm thấy cơ sở CS1. Hãy chạy seed trước.");
  }

  const periods = await prisma.billingPeriod.findMany({
    where: { branchId: branch.id, periodName: { in: [...MONTHS] } },
    orderBy: { periodName: "asc" },
  });

  addFinding(findings, {
    key: "dataset.periods.coverage",
    module: "dataset",
    title: "Có đủ 4 kỳ học phí QA",
    passed: periods.length === MONTHS.length,
    severity: "P0",
    summary: `Tìm thấy ${periods.length}/${MONTHS.length} kỳ cần cho audit.`,
    sample: periods.map((item) => item.periodName),
  });

  const allStressCharges = await prisma.charge.findMany({
    where: {
      student: { branchId: branch.id },
      billingPeriod: { branchId: branch.id, periodName: { in: [...MONTHS] } },
    },
    include: {
      student: true,
      class: true,
      billingPeriod: true,
      allocations: {
        include: {
          payment: true,
        },
      },
    },
  });

  const chargeRows = allStressCharges.map((charge) => {
    const paidAmount = charge.allocations
      .filter((item) => item.payment.status !== "VOIDED" && item.payment.status !== "REFUNDED")
      .reduce((sum, item) => sum + item.amount, 0);
    const remaining = remainingAmount(charge.totalAmount, paidAmount);
    const paymentStatus =
      paidAmount <= 0 ? "UNPAID" : remaining > 0 ? "PARTIAL" : "PAID";

    return {
      id: charge.id,
      studentId: charge.studentId,
      studentCode: charge.student.studentCode,
      classCode: charge.class.classCode,
      periodName: charge.billingPeriod.periodName,
      billingModel: charge.billingModel,
      tuitionAmount: charge.tuitionAmount,
      totalAmount: charge.totalAmount,
      paidAmount,
      remainingAmount: remaining,
      paymentStatus,
      openingBalance: charge.openingBalance,
      materialsAmount: charge.materialsAmount,
    };
  });

  const monthlyCharges = chargeRows.filter((item) => item.billingModel === "PERIOD");
  const courseCharges = chargeRows.filter((item) => item.billingModel === "COURSE");
  const installmentCharges = chargeRows.filter((item) => item.billingModel === "INSTALLMENT");
  const fullPaidCharges = chargeRows.filter((item) => item.paymentStatus === "PAID");
  const partialCharges = chargeRows.filter((item) => item.paymentStatus === "PARTIAL");
  const unpaidCharges = chargeRows.filter((item) => item.paymentStatus === "UNPAID");
  const openingBalanceCharges = chargeRows.filter((item) => item.openingBalance !== 0);

  const invalidChargeArithmetic = chargeRows.filter(
    (item) =>
      item.totalAmount !== item.tuitionAmount + item.materialsAmount + item.openingBalance ||
      item.totalAmount < 0 ||
      item.tuitionAmount < 0 ||
      item.materialsAmount < 0 ||
      item.paidAmount < 0,
  );
  addFinding(findings, {
    key: "tuition.charge.arithmetic",
    module: "tuition",
    title: "Tổng phải thu khớp học phí + sách + nợ đầu kỳ",
    passed: invalidChargeArithmetic.length === 0,
    severity: "P0",
    summary: `Có ${invalidChargeArithmetic.length} charge sai cấu phần hoặc có số tiền không hợp lệ.`,
    sample: invalidChargeArithmetic.slice(0, 5),
  });

  const overAllocatedCharges = chargeRows.filter((item) => item.paidAmount > item.totalAmount);
  addFinding(findings, {
    key: "tuition.charge.overallocated",
    module: "tuition",
    title: "Không charge nào bị thu vượt số phải thu",
    passed: overAllocatedCharges.length === 0,
    severity: "P0",
    summary: `Có ${overAllocatedCharges.length} charge bị phân bổ vượt tổng phải thu.`,
    sample: overAllocatedCharges.slice(0, 5),
  });

  const canonicalFinancialLabels =
    PAYMENT_STATUS_LABEL.UNPAID === "Chưa thu" &&
    PAYMENT_STATUS_LABEL.PARTIAL === "Đã thu một phần" &&
    PAYMENT_STATUS_LABEL.PAID === "Đã thu hết";
  addFinding(findings, {
    key: "tuition.labels.canonical",
    module: "tuition",
    title: "Nhãn tài chính dùng đúng ngôn ngữ vận hành",
    passed: canonicalFinancialLabels,
    severity: "P1",
    summary: canonicalFinancialLabels
      ? "Ba trạng thái chuẩn: Chưa thu / Đã thu một phần / Đã thu hết."
      : "Nhãn tài chính đang lệch bộ trạng thái chuẩn.",
    sample: PAYMENT_STATUS_LABEL,
  });

  addFinding(findings, {
    key: "dataset.billing.models",
    module: "tuition",
    title: "Dataset có đủ 3 kiểu thu",
    passed: monthlyCharges.length > 0 && courseCharges.length > 0 && installmentCharges.length > 0,
    severity: "P0",
    summary: `Theo tháng: ${monthlyCharges.length}, theo khóa: ${courseCharges.length}, trả góp: ${installmentCharges.length}.`,
  });

  addFinding(findings, {
    key: "dataset.payment.states",
    module: "tuition",
    title: "Dataset có đủ chưa thu / thu một phần / thu đủ",
    passed: fullPaidCharges.length > 0 && partialCharges.length > 0 && unpaidCharges.length > 0,
    severity: "P0",
    summary: `Đã thu hết: ${fullPaidCharges.length}, thu một phần: ${partialCharges.length}, chưa thu: ${unpaidCharges.length}.`,
  });

  addFinding(findings, {
    key: "dataset.opening.balance",
    module: "tuition",
    title: "Có dữ liệu nợ đầu kỳ để test cộng dồn",
    passed: openingBalanceCharges.length > 0,
    severity: "P0",
    summary: `Có ${openingBalanceCharges.length} charge mang opening balance khác 0.`,
    sample: openingBalanceCharges.slice(0, 5),
  });

  const [scholarships, adjustments, studentBookRequirements, remedialClasses, sessionCredits, endedClasses] = await Promise.all([
    prisma.scholarship.findMany({ where: { student: { studentCode: { startsWith: "STRESS-HV" } } } }),
    prisma.adjustment.findMany({ where: { student: { studentCode: { startsWith: "STRESS-HV" } } } }),
    prisma.studentBookRequirement.findMany({
      where: { student: { studentCode: { startsWith: "STRESS-HV" } } },
      include: { student: true, book: true },
    }),
    prisma.class.findMany({ where: { branchId: branch.id, isRemedial: true } }),
    prisma.sessionCredit.findMany({
      where: { student: { studentCode: { startsWith: "STRESS-HV" } } },
      include: { student: true, consumedSession: true, sourceSession: true },
    }),
    prisma.class.findMany({
      where: {
        branchId: branch.id,
        expectedEndDate: { lt: now },
      },
      select: { id: true, classCode: true, className: true, expectedEndDate: true },
    }),
  ]);
  const invalidCreditApplications = chargeRows.filter(
    (charge) => charge.openingBalance < 0 && charge.totalAmount < 0,
  );
  addFinding(findings, {
    key: "tuition.credit.application",
    module: "tuition",
    title: "Tiền dư/ưu đãi áp dụng không làm tổng phải thu âm",
    passed: invalidCreditApplications.length === 0,
    severity: "P0",
    summary: `Có ${invalidCreditApplications.length} charge bị giảm xuống dưới 0đ.`,
    sample: invalidCreditApplications.slice(0, 5),
  });

  addFinding(findings, {
    key: "dataset.scholarships.adjustments",
    module: "students",
    title: "Có dữ liệu học bổng và điều chỉnh",
    passed: scholarships.length > 0 && adjustments.length > 0,
    severity: "P0",
    summary: `Học bổng: ${scholarships.length}, điều chỉnh: ${adjustments.length}.`,
  });

  const confirmedBooks = studentBookRequirements.filter((item) => item.status === "CONFIRMED");
  const declinedBooks = studentBookRequirements.filter((item) => item.status === "DECLINED");
  addFinding(findings, {
    key: "dataset.standard.books",
    module: "inventory",
    title: "Có case sách chuẩn xác nhận mua và từ chối mua",
    passed: confirmedBooks.length > 0 && declinedBooks.length > 0,
    severity: "P1",
    summary: `Đã xác nhận: ${confirmedBooks.length}, từ chối: ${declinedBooks.length}.`,
  });

  const availableCredits = sessionCredits.filter((item) => item.status === "AVAILABLE");
  const consumedCredits = sessionCredits.filter((item) => item.status === "CONSUMED");
  addFinding(findings, {
    key: "dataset.remedial.credits",
    module: "classes",
    title: "Có buổi bổ trợ còn khả dụng và đã dùng",
    passed: remedialClasses.length > 0 && availableCredits.length > 0 && consumedCredits.length > 0,
    severity: "P0",
    summary: `Lớp bổ trợ: ${remedialClasses.length}, credit còn: ${availableCredits.length}, credit đã dùng: ${consumedCredits.length}.`,
    sample: consumedCredits.slice(0, 3).map((item) => ({
      studentCode: item.student.studentCode,
      sourceSessionId: item.sourceSessionId,
      consumedSessionId: item.consumedSessionId,
    })),
  });

  const remedialCharges = await prisma.charge.findMany({
    where: { class: { isRemedial: true } },
  });
  addFinding(findings, {
    key: "tuition.remedial.free",
    module: "tuition",
    title: "Lớp bổ trợ không phát sinh học phí",
    passed: remedialCharges.length === 0,
    severity: "P0",
    summary: `Tìm thấy ${remedialCharges.length} charge ở lớp bổ trợ.`,
  });

  const endedCourseDebt = chargeRows.filter((item) => {
    const cls = endedClasses.find((c) => c.classCode === item.classCode);
    return item.billingModel === "COURSE" && item.remainingAmount > 0 && Boolean(cls);
  });
  addFinding(findings, {
    key: "tuition.ended-course.debt",
    module: "tuition",
    title: "Có case khóa đã kết thúc nhưng vẫn còn nợ cuối khóa",
    passed: endedCourseDebt.length > 0,
    severity: "P1",
    summary: `Tìm thấy ${endedCourseDebt.length} charge nợ cuối khóa.`,
    sample: endedCourseDebt.slice(0, 5),
  });

  const periodReports = [];
  let totalBatchFullyPaid = 0;
  let totalBatchMismatch = 0;
  let totalExceptions = 0;

  for (const period of periods) {
    const batch = await getBatchInvoiceViewData(period.id);
    const exceptionPreview = await previewChargeGenerationExceptions(period.id);
    const charges = batch?.charges ?? [];
    const fullyPaidInsideBatch = charges.filter((charge) => {
      const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
      return paid >= charge.totalAmount;
    });
    const mismatched = charges.filter(
      (charge) => Boolean(charge.currentEnrollmentBillingModel) && charge.currentEnrollmentBillingModel !== charge.billingModel,
    );

    totalBatchFullyPaid += fullyPaidInsideBatch.length;
    totalBatchMismatch += mismatched.length;
    const exceptionCount =
      "exceptionCount" in exceptionPreview && typeof exceptionPreview.exceptionCount === "number"
        ? exceptionPreview.exceptionCount
        : 0;

    totalExceptions += exceptionCount;

    periodReports.push({
      periodName: period.periodName,
      chargeCount: charges.length,
      fullyPaidInsideBatch: fullyPaidInsideBatch.length,
      billingModelMismatch: mismatched.length,
      exceptionCount,
    });
  }

  addFinding(findings, {
    key: "tuition.batch.only-owing",
    module: "tuition",
    title: "Batch invoice chỉ nên chứa người còn phải thu",
    passed: totalBatchFullyPaid === 0,
    severity: "P1",
    summary: `Có ${totalBatchFullyPaid} charge đã thu đủ vẫn đang hiện trong batch invoice.`,
    sample: periodReports,
  });

  addFinding(findings, {
    key: "tuition.batch.model-mismatch",
    module: "tuition",
    title: "Phiếu trong batch không bị lệch mode thu so với enrollment hiện tại",
    passed: totalBatchMismatch === 0,
    severity: "P1",
    summary: `Có ${totalBatchMismatch} charge đang lệch billingModel so với enrollment hiện tại.`,
    sample: periodReports,
  });

  addFinding(findings, {
    key: "tuition.generation.exceptions",
    module: "tuition",
    title: "Không còn exception queue khi sweep học phí",
    passed: totalExceptions === 0,
    severity: "P0",
    summary: `Có ${totalExceptions} exception từ preview charge generation.`,
    sample: periodReports,
  });

  const payments = await prisma.payment.findMany({
    where: { student: { branchId: branch.id } },
    include: {
      allocations: true,
      cashPosting: { include: { cashTransaction: true } },
      refunds: { include: { cashPosting: { include: { cashTransaction: true } } } },
      creditBalances: true,
      student: true,
    },
  });

  const paymentParityIssues = payments
    .map((payment) => {
      const allocated = payment.allocations.reduce((sum, item) => sum + item.amount, 0);
      const refunded = payment.refunds.reduce((sum, item) => sum + item.amount, 0);
      const netPayment = payment.status === "VOIDED" ? 0 : payment.amount - refunded;
      const cashCreditAmount = payment.creditBalances
        .filter((credit) => !credit.reason?.toLocaleLowerCase("vi").includes("chiết khấu"))
        .reduce((sum, credit) => sum + credit.amount, 0);
      const refundPostingMismatch = payment.refunds.some(
        (refund) =>
          refund.amount <= 0 ||
          refund.cashPosting?.amount !== refund.amount ||
          refund.cashPosting?.cashTransaction.amount !== refund.amount,
      );
      const expectedStatus =
        refunded <= 0 ? null : refunded >= payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";
      return {
        paymentNo: payment.paymentNo,
        studentCode: payment.student.studentCode,
        paymentAmount: payment.amount,
        refundedAmount: refunded,
        netPayment,
        allocatedAmount: allocated,
        cashCreditAmount,
        cashPostedAmount: payment.cashPosting?.amount ?? null,
        cashTxnAmount: payment.cashPosting?.cashTransaction.amount ?? null,
        cashTxnStatus: payment.cashPosting?.cashTransaction.status ?? null,
        paymentStatus: payment.status,
        expectedStatus,
        refundPostingMismatch,
      };
    })
    .filter(
      (item) =>
        item.paymentAmount <= 0 ||
        item.refundedAmount < 0 ||
        item.refundedAmount > item.paymentAmount ||
        item.allocatedAmount + item.cashCreditAmount !== item.netPayment ||
        item.cashPostedAmount !== item.paymentAmount ||
        item.cashTxnAmount !== item.paymentAmount ||
        (item.paymentStatus === "VOIDED" && item.cashTxnStatus !== "VOIDED") ||
        item.refundPostingMismatch ||
        (item.expectedStatus !== null && item.paymentStatus !== item.expectedStatus) ||
        (item.expectedStatus === null && ["REFUNDED", "PARTIALLY_REFUNDED"].includes(item.paymentStatus)),
    );

  addFinding(findings, {
    key: "cashbook.payment.parity",
    module: "cashbook",
    title: "Tiền thực thu - hoàn tiền = allocation, đồng thời khớp sổ quỹ",
    passed: paymentParityIssues.length === 0,
    severity: "P0",
    summary: `Có ${paymentParityIssues.length} phiếu thu bị lệch giữa payment/allocation/quỹ.`,
    sample: paymentParityIssues.slice(0, 5),
  });

  const stockTransactions = await prisma.stockTransaction.findMany({
    include: {
      cashPosting: { include: { cashTransaction: true } },
      book: true,
    },
  });

  const stockParityIssues = stockTransactions
    .filter((txn) => txn.cashPosting)
    .map((txn) => ({
      transactionId: txn.id,
      bookCode: txn.book.bookCode,
      totalAmount: txn.totalAmount,
      postingAmount: txn.cashPosting?.amount ?? null,
      cashTxnAmount: txn.cashPosting?.cashTransaction.amount ?? null,
    }))
    .filter(
      (item) => item.totalAmount !== item.postingAmount || item.totalAmount !== item.cashTxnAmount,
    );

  addFinding(findings, {
    key: "inventory.stock.parity",
    module: "inventory",
    title: "Nhập kho = hạch toán kho = phiếu chi",
    passed: stockParityIssues.length === 0,
    severity: "P0",
    summary: `Có ${stockParityIssues.length} giao dịch kho lệch tiền.`,
    sample: stockParityIssues.slice(0, 5),
  });

  const assetTransactions = await prisma.assetTransaction.findMany({
    where: { asset: { branchId: branch.id } },
    include: {
      asset: true,
      cashPosting: { include: { cashTransaction: true } },
    },
  });

  const assetMaintenanceParityIssues = assetTransactions
    .filter((txn) => txn.type === "MAINTENANCE")
    .map((txn) => ({
      transactionId: txn.id,
      assetName: txn.asset.name,
      maintenanceAmount: txn.amount,
      postingAmount: txn.cashPosting?.amount ?? null,
      cashTxnAmount: txn.cashPosting?.cashTransaction.amount ?? null,
    }))
    .filter(
      (item) =>
        item.maintenanceAmount <= 0 ||
        item.postingAmount !== item.maintenanceAmount ||
        item.cashTxnAmount !== item.maintenanceAmount,
    );

  addFinding(findings, {
    key: "assets.maintenance.parity",
    module: "assets",
    title: "Bảo dưỡng tài sản có tiền bảo dưỡng và bút toán quỹ khớp",
    passed: assetMaintenanceParityIssues.length === 0,
    severity: "P0",
    summary: `Có ${assetMaintenanceParityIssues.length} giao dịch bảo dưỡng lệch tiền/hạch toán.`,
    sample: assetMaintenanceParityIssues.slice(0, 5),
  });

  const julyRange = {
    start: new Date("2026-07-01T00:00:00.000Z"),
    end: new Date("2026-07-31T23:59:59.999Z"),
  };
  const payrollRuns = await prisma.payrollRun.findMany({
    where: { branchId: branch.id },
    include: {
      lines: {
        include: { employee: true },
      },
    },
  });
  const julyRun = payrollRuns.find((run) => run.periodName === "2026-07") ?? null;

  const julyAssignments = await prisma.sessionAssignment.findMany({
    where: {
      session: {
        class: { branchId: branch.id },
        sessionDate: { gte: julyRange.start, lte: julyRange.end },
        status: "COMPLETED",
      },
    },
  });

  const julyTimesheets = await prisma.timesheetEntry.findMany({
    where: {
      employee: { branchId: branch.id },
      workDate: { gte: julyRange.start, lte: julyRange.end },
    },
  });

  const payrollIssues =
    julyRun?.lines
      .map((line) => {
        const teachingAssignments = julyAssignments.filter(
          (item) => item.employeeId === line.employeeId && item.role === "TEACHER",
        );
        const assistantAssignments = julyAssignments.filter(
          (item) => item.employeeId === line.employeeId && item.role !== "TEACHER",
        );
        const timesheetEntries = julyTimesheets.filter((item) => item.employeeId === line.employeeId);

        const teachingAmount = teachingAssignments.reduce((sum, item) => sum + (item.amount ?? 0), 0);
        const assistantAmount = assistantAssignments.reduce((sum, item) => sum + (item.amount ?? 0), 0);
        const staffDays = timesheetEntries.reduce((sum, item) => sum + (item.days ?? 0), 0);
        const expectedTotal = teachingAmount + assistantAmount + line.baseSalaryAmount + line.bonus - line.penalty;

        return {
          employeeCode: line.employee.employeeCode,
          teachingAmount: line.teachingAmount,
          expectedTeachingAmount: teachingAmount,
          assistantAmount: line.assistantAmount,
          expectedAssistantAmount: assistantAmount,
          staffDays: line.staffDays,
          expectedStaffDays: staffDays,
          totalAmount: line.totalAmount,
          expectedTotal,
        };
      })
      .filter(
        (item) =>
          item.teachingAmount !== item.expectedTeachingAmount ||
          item.assistantAmount !== item.expectedAssistantAmount ||
          item.staffDays !== item.expectedStaffDays ||
          item.totalAmount !== item.expectedTotal,
      ) ?? [];

  addFinding(findings, {
    key: "payroll.assignment.parity",
    module: "payroll",
    title: "Payroll line khớp với session assignment và timesheet",
    passed: payrollIssues.length === 0 && Boolean(julyRun),
    severity: "P0",
    summary: julyRun
      ? `Có ${payrollIssues.length} dòng lương lệch dữ liệu nguồn.`
      : "Không tìm thấy payroll run tháng 2026-07 để kiểm tra.",
    sample: payrollIssues.slice(0, 5),
  });

  const [leadCount, studentCount, guardianCount, userCount, roleCount, inventoryCount] = await Promise.all([
    prisma.lead.count({ where: { branchId: branch.id } }),
    prisma.student.count({ where: { branchId: branch.id } }),
    prisma.guardian.count(),
    prisma.user.count(),
    prisma.role.count(),
    prisma.book.count({ where: { branchId: branch.id } }),
  ]);

  addFinding(findings, {
    key: "dataset.cross-module.coverage",
    module: "dataset",
    title: "Dataset phủ đủ CRM / học viên / phụ huynh / user / sách",
    passed: leadCount > 0 && studentCount > 0 && guardianCount > 0 && userCount > 0 && roleCount > 0 && inventoryCount > 0,
    severity: "P0",
    summary: `Leads: ${leadCount}, students: ${studentCount}, guardians: ${guardianCount}, users: ${userCount}, roles: ${roleCount}, books: ${inventoryCount}.`,
  });

  const severityCounts = findings.reduce(
    (acc, item) => {
      acc[item.severity] += 1;
      return acc;
    },
    { PASS: 0, P0: 0, P1: 0, P2: 0 } as Record<Severity, number>,
  );

  const finalResult = {
    ok: severityCounts.P0 === 0,
    generatedAt: new Date().toISOString(),
    branch: { id: branch.id, code: branch.code, name: branch.name },
    coverage: {
      periods: periods.map((item) => item.periodName),
      students: studentCount,
      leads: leadCount,
      guardians: guardianCount,
      roles: roleCount,
      users: userCount,
      books: inventoryCount,
    },
    stats: {
      charges: chargeRows.length,
      monthlyCharges: monthlyCharges.length,
      courseCharges: courseCharges.length,
      installmentCharges: installmentCharges.length,
      fullPaidCharges: fullPaidCharges.length,
      partialCharges: partialCharges.length,
      unpaidCharges: unpaidCharges.length,
      openingBalanceCharges: openingBalanceCharges.length,
      scholarships: scholarships.length,
      adjustments: adjustments.length,
      confirmedBooks: confirmedBooks.length,
      declinedBooks: declinedBooks.length,
      remedialClasses: remedialClasses.length,
      availableCredits: availableCredits.length,
      consumedCredits: consumedCredits.length,
    },
    severityCounts,
    findings,
    checklist: "QA_SYSTEM_AUDIT_CHECKLIST.md",
  };

  const markdown = [
    "# Báo cáo audit hệ thống QA",
    "",
    `- Thời gian: ${finalResult.generatedAt}`,
    `- Cơ sở: ${branch.code} - ${branch.name}`,
    `- Kết quả tổng: ${finalResult.ok ? "PASS (không còn P0)" : "FAIL (còn P0)"}`,
    `- Checklist thủ công: ${finalResult.checklist}`,
    "",
    "## Tóm tắt coverage",
    "",
    `- Kỳ học phí: ${finalResult.coverage.periods.join(", ")}`,
    `- Học viên: ${finalResult.coverage.students}`,
    `- Leads: ${finalResult.coverage.leads}`,
    `- Phụ huynh: ${finalResult.coverage.guardians}`,
    `- User: ${finalResult.coverage.users}`,
    `- Role: ${finalResult.coverage.roles}`,
    `- Sách: ${finalResult.coverage.books}`,
    "",
    "## Severity",
    "",
    `- PASS: ${severityCounts.PASS}`,
    `- P0: ${severityCounts.P0}`,
    `- P1: ${severityCounts.P1}`,
    `- P2: ${severityCounts.P2}`,
    "",
    "## Findings",
    "",
    "| Severity | Module | Check | Kết quả |",
    "| --- | --- | --- | --- |",
    ...findings.map(
      (item) =>
        `| ${item.severity} | ${item.module} | ${item.title} | ${item.summary.replace(/\|/g, "\\|")} |`,
    ),
    "",
  ].join("\n");

  writeFileSync(join(AUDIT_DIR, "last-system-audit.json"), JSON.stringify(finalResult, null, 2), "utf8");
  writeFileSync(join(AUDIT_DIR, "last-system-audit.md"), markdown, "utf8");

  console.log(JSON.stringify(finalResult, null, 2));
  console.log(`\nMarkdown report: ${join(AUDIT_DIR, "last-system-audit.md")}`);
  console.log(`JSON report: ${join(AUDIT_DIR, "last-system-audit.json")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
