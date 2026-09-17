// SÁCH THU THEO KỲ HỌC PHÍ — sổ xuất giáo trình phải tự chuyển sang "đã thanh toán"
// khi phụ huynh đóng học phí. Chạy: npm run test:bookpay
//
// Ca đã SAI trước đây (trung tâm báo): phát sách chọn "thu theo kỳ học phí", phụ huynh
// đóng đủ học phí rồi mà /inventory?tab=issues vẫn hiện "Chưa thanh toán" mãi mãi —
// vì phiếu xuất sách tạo ra với trạng thái UNPAID và không có chỗ nào cập nhật lại.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, summary, vnd } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { recordStudentPayment } = await import("@/lib/server/payment-recording");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const UNIT = 200_000;
  const TUITION = 1_000_000; // 5 buổi × 200.000đ
  const BOOK = 150_000;
  console.log("Chạy test thu tiền sách theo kỳ học phí (prisma/test.db):\n");

  async function seedCase(name: string) {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, name);
    const enrollment = await fx.seedEnrollment(db, {
      studentId: student.id,
      classId: cls.id,
      billingModel: "PERIOD",
      enrollDate: new Date("2026-09-01T00:00:00.000Z"),
    });
    const period = await fx.seedBillingPeriod(db, branch.id, "2026-09");
    const charge = await fx.seedCharge(db, {
      studentId: student.id,
      classId: cls.id,
      billingPeriodId: period.id,
      tuitionAmount: TUITION,
      unitPrice: UNIT,
    });
    await db.charge.update({
      where: { id: charge.id },
      data: {
        enrollmentId: enrollment.id,
        billingModel: "PERIOD",
        sessionCount: 5,
        mainTuitionAmount: TUITION,
        // Tiền sách nằm trong chính phiếu học phí này.
        materialsAmount: BOOK,
        totalAmount: TUITION + BOOK,
      },
    });
    const book = await db.book.create({
      data: { branchId: branch.id, name: `Giáo trình ${name}`, unitPrice: BOOK, purchasePrice: 100_000 },
    });
    const issue = await db.bookIssue.create({
      data: {
        bookId: book.id,
        classId: cls.id,
        studentId: student.id,
        chargeId: charge.id,
        quantity: 1,
        unitPrice: BOOK,
        amount: BOOK,
        issueDate: new Date("2026-09-05T00:00:00.000Z"),
        paymentStatus: "UNPAID",
      },
    });
    return { student, charge, issue };
  }

  const pay = (student: { id: string; branchId: string; fullName: string; studentCode: string }, amount: number) =>
    db.$transaction((tx) =>
      recordStudentPayment(tx, {
        studentId: student.id,
        amount,
        method: "Tiền mặt",
        discountPercent: 0,
        discountReason: "",
        paidDate: new Date("2026-09-16T00:00:00.000Z"),
        userId: "test-user",
        paymentNo: `PM${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        student: { branchId: student.branchId, fullName: student.fullName, studentCode: student.studentCode },
      }),
    );

  const statusOf = async (issueId: string) =>
    (await db.bookIssue.findUniqueOrThrow({ where: { id: issueId } })).paymentStatus;

  // ---------------------------------------------------------------- 1
  await test("Đóng đủ học phí: sách thu theo kỳ chuyển sang ĐÃ THANH TOÁN", async () => {
    const { student, issue } = await seedCase("Đóng đủ");
    expectEqual(await statusOf(issue.id), "UNPAID", "trước khi thu: chưa thanh toán");
    await pay(student, TUITION + BOOK);
    expectEqual(await statusOf(issue.id), "PAID", `đóng đủ ${vnd(TUITION + BOOK)} → sổ kho ghi đã thu`);
  });

  // ---------------------------------------------------------------- 2
  await test("Đóng thiếu: sách vẫn là CHƯA THANH TOÁN", async () => {
    const { student, issue } = await seedCase("Đóng thiếu");
    await pay(student, 500_000);
    expectEqual(await statusOf(issue.id), "UNPAID", "mới đóng 500.000đ/1.150.000đ");
  });

  // ---------------------------------------------------------------- 3
  await test("Đóng nốt phần còn lại: sách chuyển sang đã thanh toán", async () => {
    const { student, issue } = await seedCase("Đóng nốt");
    await pay(student, 500_000);
    expectEqual(await statusOf(issue.id), "UNPAID", "chưa đủ");
    await pay(student, TUITION + BOOK - 500_000);
    expectEqual(await statusOf(issue.id), "PAID", "đã đủ");
  });

  // ---------------------------------------------------------------- 4
  await test("Sách thu tiền mặt ngay (không gắn phiếu học phí) không bị đụng tới", async () => {
    const { student } = await seedCase("Thu tiền mặt");
    const book = await db.book.findFirstOrThrow({ where: { name: { contains: "Thu tiền mặt" } } });
    const cashIssue = await db.bookIssue.create({
      data: {
        bookId: book.id,
        studentId: student.id,
        quantity: 1,
        unitPrice: BOOK,
        amount: BOOK,
        issueDate: new Date("2026-09-05T00:00:00.000Z"),
        paymentStatus: "PAID",
      },
    });
    await pay(student, 300_000);
    expectEqual(await statusOf(cashIssue.id), "PAID", "vẫn đã thu, không bị hạ về chưa thu");
  });

  const failed = summary();
  await db.$disconnect();
  await shared.$disconnect();
  dropTestDatabase();
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  dropTestDatabase();
  process.exit(1);
});
