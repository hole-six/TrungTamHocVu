// Test THU TIỀN + CHIẾT KHẤU TIỀN MẶT chạy trên đúng hàm ghi nhận thật của hệ thống
// (lib/server/payment-recording.ts — route /api/payments chỉ gọi lại hàm này).
// Chạy: npm run test:payment
//
// Ca đã SAI trước đây (ảnh chụp màn hình của trung tâm): nợ 3.775.000đ, giảm 3% thì màn hình
// báo "công nợ giảm 3.888.250đ" — nhiều hơn cả số nợ — và bấm lưu thì API chặn.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, summary, vnd } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { recordStudentPayment } = await import("@/lib/server/payment-recording");
  const { computeOutstandingBalance } = await import("@/lib/server/balance");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const UNIT = 151_000;
  const DEBT = 3_775_000; // 25 buổi × 151.000đ
  console.log("Chạy test thu tiền + chiết khấu tiền mặt (prisma/test.db):\n");

  // Học viên nợ đúng 3.775.000đ của 1 phiếu học phí theo tháng.
  async function seedDebtor(name: string) {
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
      tuitionAmount: DEBT,
      unitPrice: UNIT,
    });
    await db.charge.update({
      where: { id: charge.id },
      data: { enrollmentId: enrollment.id, billingModel: "PERIOD", sessionCount: 25, mainTuitionAmount: DEBT },
    });
    return { branch, student, enrollment, charge };
  }

  const pay = (student: { id: string; branchId: string; fullName: string; studentCode: string }, params: { amount: number; percent?: number }) =>
    db.$transaction((tx) =>
      recordStudentPayment(tx, {
        studentId: student.id,
        amount: params.amount,
        method: "Tiền mặt",
        discountPercent: params.percent ?? 0,
        discountReason: params.percent ? "Ưu đãi thu tiền mặt tại quầy" : "",
        paidDate: new Date("2026-09-16T00:00:00.000Z"),
        userId: "test-user",
        paymentNo: `PM${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        student: { branchId: student.branchId, fullName: student.fullName, studentCode: student.studentCode },
      }),
    );

  // ---------------------------------------------------------------- 1
  await test("Nợ 3.775.000đ, giảm 3%: thu 3.661.750đ là HẾT NỢ, không còn dư nợ lẻ", async () => {
    const { student, charge, enrollment } = await seedDebtor("Giảm 3% trả đủ");
    const result = await pay(student, { amount: 3_661_750, percent: 3 });

    expectEqual(result.discountAmount, 113_250, "chiết khấu " + vnd(113_250));
    expectEqual(await computeOutstandingBalance(student.id, db), 0, "hết nợ");
    const after = await db.charge.findUniqueOrThrow({ where: { id: charge.id }, include: { allocations: true } });
    expectEqual(after.tuitionAmount, 3_661_750, "phiếu học phí giảm còn " + vnd(3_661_750));
    expectEqual(after.allocations.reduce((s, a) => s + a.amount, 0), 3_661_750, "tiền mặt phân bổ đủ phiếu");
    expectEqual(await db.creditBalance.count({ where: { studentId: student.id } }), 0, "không sinh tiền dư ảo");
    // Được giảm giá nhưng vẫn phải được học đủ 25 buổi đã mua.
    const wallet = await db.enrollmentWallet.findUniqueOrThrow({ where: { enrollmentId: enrollment.id } });
    expectEqual(wallet.balance, 25, "ví vẫn nạp đủ 25 buổi");
  });

  // ---------------------------------------------------------------- 2
  await test("Gõ đúng số nợ rồi bấm giảm 3%: không xóa nợ quá số nợ, phần thừa thành tiền đóng trước", async () => {
    const { student, charge } = await seedDebtor("Gõ nguyên số nợ");
    const result = await pay(student, { amount: DEBT, percent: 3 });

    expectEqual(result.discountAmount, 113_250, "vẫn giảm đúng 3% của khoản nợ");
    expectEqual(await computeOutstandingBalance(student.id, db), 0, "hết nợ, KHÔNG âm");
    expectEqual(result.unallocated, 113_250, "phần thu thừa giữ làm tiền đóng trước");
    expectEqual(result.advanceBalance, 113_250, "tiền đóng trước của học viên");
    const after = await db.charge.findUniqueOrThrow({ where: { id: charge.id }, include: { allocations: true } });
    expectEqual(after.allocations.reduce((s, a) => s + a.amount, 0), 3_661_750, "chỉ phân bổ phần cần trả nợ");
  });

  // ---------------------------------------------------------------- 3
  await test("Đóng một phần có chiết khấu: xóa đúng phần nợ tương ứng, phần còn lại vẫn nợ", async () => {
    const { student, charge } = await seedDebtor("Đóng một phần");
    const result = await pay(student, { amount: 1_940_000, percent: 3 });

    expectEqual(result.discountAmount, 60_000, "giảm 3% của 2.000.000đ");
    expectEqual(await computeOutstandingBalance(student.id, db), DEBT - 2_000_000, "còn nợ " + vnd(DEBT - 2_000_000));
    const after = await db.charge.findUniqueOrThrow({ where: { id: charge.id } });
    expectEqual(after.tuitionAmount, DEBT - 60_000, "phiếu giảm đúng phần chiết khấu");
  });

  // ---------------------------------------------------------------- 4
  await test("Thu không chiết khấu vẫn như cũ: phân bổ đủ, thu vượt thành tiền đóng trước", async () => {
    const { student } = await seedDebtor("Không chiết khấu");
    const result = await pay(student, { amount: 4_000_000 });
    expectEqual(result.discountAmount, 0, "không giảm");
    expectEqual(await computeOutstandingBalance(student.id, db), 0, "hết nợ");
    expectEqual(result.unallocated, 225_000, "thu vượt " + vnd(225_000));
  });

  // ---------------------------------------------------------------- 5
  await test("Học viên không còn nợ mà vẫn bấm chiết khấu: chặn, không ghi nhận", async () => {
    const { student } = await seedDebtor("Đã hết nợ");
    await pay(student, { amount: DEBT });
    expectEqual(await computeOutstandingBalance(student.id, db), 0, "đã hết nợ");
    let message = "";
    try {
      await pay(student, { amount: 500_000, percent: 5 });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expectEqual(message.includes("không còn công nợ"), true, "báo rõ lý do: " + message);
    expectEqual(await db.payment.count({ where: { studentId: student.id } }), 1, "không tạo phiếu thu thứ 2");
  });

  // ---------------------------------------------------------------- 6
  await test("Sổ quỹ ghi đúng TIỀN MẶT thật nhận, không cộng phần chiết khấu", async () => {
    const { student } = await seedDebtor("Đối soát sổ quỹ");
    await pay(student, { amount: 3_661_750, percent: 3 });
    const cash = await db.cashTransaction.findFirstOrThrow({ where: { type: "THU" } });
    expectEqual(cash.amount, 3_661_750, "sổ quỹ ghi đúng tiền mặt cầm về");
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
