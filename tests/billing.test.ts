// Test tự động cho PHIẾU BÁO HỌC PHÍ — con số in ra phụ huynh phải tự cộng trừ được.
// Chạy: npm run test:billing
//
// Mẫu giấy trung tâm đang phát:
//     Số buổi nghỉ tháng 6      1
//     Tổng số buổi tháng 7      9
//     Học phí tháng 7      1.120.000     (= (9 - 1) x 140.000)
//
// Tức phiếu phải nói đủ BA số thì phụ huynh mới kiểm lại được. Trước đây hệ thống chỉ
// lưu số buổi THU (8), nên phiếu in ra "Tổng số buổi tháng 8 = 1" trong khi lớp dạy 4
// buổi — không ai đối chiếu nổi, và phần dư đã trừ thì không thấy đâu.
//
// generateChargesForPeriod dùng prisma singleton nên phải trỏ DATABASE_URL trước rồi
// mới await import() — xem prepareTestDatabase trong harness.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, summary, vnd } from "./harness";

const UNIT = 140_000;

async function main() {
  prepareTestDatabase();

  const { PrismaClient } = await import("@prisma/client");
  const { generateChargesForPeriod } = await import("@/lib/server/billing-generation");
  const { topUpWalletFromPayment, debitWalletsForCompletedSession } = await import("@/lib/server/enrollment-wallet");
  const { prisma: sharedClient } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  console.log("Chạy test phiếu báo học phí trên CSDL riêng (prisma/test.db):\n");

  // ---------------------------------------------------------------- 1
  // Đúng kịch bản trên phiếu giấy: tháng 6 trung tâm cho nghỉ 1 buổi nên ví còn dư 1,
  // tháng 7 lớp dạy 9 buổi → chỉ thu 8 buổi.
  await test("Phiếu học phí: tổng buổi tháng này trừ buổi dư tháng trước ra đúng tiền", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, "Cao Thủy Tiên");
    const enrollment = await fx.seedEnrollment(db, {
      studentId: student.id,
      classId: cls.id,
      billingModel: "PERIOD",
      enrollDate: day("2026-06-01"),
    });

    // Tháng 6: đóng đủ 10 buổi, lớp chỉ dạy thật 9 (1 buổi trung tâm cho nghỉ).
    const payment = await fx.seedPayment(db, { studentId: student.id, amount: 10 * UNIT, paidDate: day("2026-06-01") });
    await db.$transaction(async (tx) => {
      await topUpWalletFromPayment(tx, {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
        amountVnd: 10 * UNIT,
        unitPrice: UNIT,
      });
    });
    for (let i = 0; i < 9; i += 1) {
      const s = await fx.seedSession(db, cls.id, day(`2026-06-${String(i + 1).padStart(2, "0")}`), "COMPLETED");
      await db.$transaction(async (tx) => debitWalletsForCompletedSession(tx, s.id));
    }
    const walletAfterJune = await db.enrollmentWallet.findUnique({ where: { enrollmentId: enrollment.id } });
    expectEqual(walletAfterJune?.balance, 1, "ví cuối tháng 6 (đóng 10, dạy thật 9)");

    // Tháng 7: lớp lên lịch 9 buổi.
    for (let i = 0; i < 9; i += 1) {
      await fx.seedSession(db, cls.id, day(`2026-07-${String(i + 1).padStart(2, "0")}`), "PLANNED");
    }
    const july = await fx.seedBillingPeriod(db, branch.id, "2026-07");
    await generateChargesForPeriod(july.id);

    const charge = await db.charge.findFirst({ where: { billingPeriodId: july.id, studentId: student.id } });
    expectEqual(charge?.scheduledSessionCount, 9, "Tổng số buổi tháng 7 in trên phiếu");
    expectEqual(charge?.carriedSessionCount, 1, "Số buổi nghỉ tháng 6 in trên phiếu");
    expectEqual(charge?.sessionCount, 8, "số buổi thực thu");
    expectEqual(charge?.tuitionAmount, 1_120_000, "học phí tháng 7 " + vnd(1_120_000));

    // Điều quan trọng nhất: ba con số in ra phải tự cộng trừ khớp với số tiền.
    const reconciles =
      ((charge?.scheduledSessionCount ?? 0) - (charge?.carriedSessionCount ?? 0)) * (charge?.unitPrice ?? 0) ===
      (charge?.tuitionAmount ?? 0);
    expectEqual(reconciles, true, "(tổng - dư) x đơn giá = học phí");
  });

  // ---------------------------------------------------------------- 2
  // Học viên vào giữa tháng: chỉ thu từ ngày vào lớp trở đi, và "tổng số buổi" in trên
  // phiếu cũng phải là số buổi TỪ NGÀY ĐÓ, không phải cả tháng — nếu không phụ huynh
  // nhìn phiếu thấy tổng 9 buổi mà chỉ bị thu 4, lại không tự kiểm được.
  await test("Vào lớp giữa tháng: phiếu chỉ tính từ ngày vào lớp", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, "Vào giữa tháng");
    await fx.seedEnrollment(db, {
      studentId: student.id,
      classId: cls.id,
      billingModel: "PERIOD",
      enrollDate: day("2026-08-20"),
    });
    for (const d of ["05", "10", "15", "22", "26", "29"]) {
      await fx.seedSession(db, cls.id, day(`2026-08-${d}`), "PLANNED");
    }

    const august = await fx.seedBillingPeriod(db, branch.id, "2026-08");
    await generateChargesForPeriod(august.id);

    const charge = await db.charge.findFirst({ where: { billingPeriodId: august.id, studentId: student.id } });
    expectEqual(charge?.scheduledSessionCount, 3, "chỉ 3 buổi từ ngày 20/8 trở đi");
    expectEqual(charge?.carriedSessionCount, 0, "chưa có buổi dư nào");
    expectEqual(charge?.tuitionAmount, 3 * UNIT, "học phí " + vnd(3 * UNIT));
  });

  const failed = summary();
  await db.$disconnect();
  await sharedClient.$disconnect();
  dropTestDatabase();
  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  dropTestDatabase();
  process.exit(1);
});
