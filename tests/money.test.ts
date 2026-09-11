// Test tự động mảng TIỀN. Chạy: npm run test:money
//
// Mỗi phép thử dưới đây khóa lại MỘT quy tắc nghiệp vụ đã chốt, và gọi ĐÚNG hàm mà
// API thật gọi — không viết lại logic, vì test viết lại logic thì chỉ chứng minh được
// bản chép giống bản gốc, không chứng minh được bản gốc đúng.
import {
  createTestDatabase,
  dropTestDatabase,
  test,
  expectEqual,
  expectTrue,
  summary,
  vnd,
} from "./harness";
import {
  seedBranch,
  seedClass,
  seedStudent,
  seedEnrollment,
  seedSession,
  seedBillingPeriod,
  seedCharge,
  seedPayment,
} from "./fixtures";
import {
  topUpWalletFromPayment,
  debitWalletsForCompletedSession,
  reverseWalletDebitsForSession,
  getWalletBalance,
  transferWalletToNewEnrollment,
} from "@/lib/server/enrollment-wallet";
import { settleChargesFromAdvancePayments, computeAdvanceBalance } from "@/lib/server/advance-payment";
import { getEnrollmentsForSession } from "@/lib/server/class-roster";
import {
  computeLearningSnapshot,
  computeTransferConversionFromValue,
  enrollmentNeedsTransferOnComplete,
} from "@/lib/server/enrollment-learning";

const UNIT = 170_000;
const day = (iso: string) => new Date(iso + "T00:00:00.000Z");

async function main() {
  const db = createTestDatabase();
  console.log("Chạy test mảng tiền trên CSDL riêng (prisma/test.db):\n");

  // ---------------------------------------------------------------- 1
  await test("Đóng tiền bao nhiêu thì nạp ví bấy nhiêu buổi", async () => {
    const branch = await seedBranch(db);
    const cls = await seedClass(db, branch.id);
    const student = await seedStudent(db, branch.id, "A");
    const enrollment = await seedEnrollment(db, {
      studentId: student.id,
      classId: cls.id,
      billingModel: "PERIOD",
      enrollDate: day("2026-01-05"),
    });
    const payment = await seedPayment(db, { studentId: student.id, amount: 8 * UNIT });

    await db.$transaction(async (tx) => {
      await topUpWalletFromPayment(tx, {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
        amountVnd: 8 * UNIT,
        unitPrice: UNIT,
      });
      expectEqual(await getWalletBalance(tx, enrollment.id), 8, "số buổi trong ví");
    });
  });

  // ---------------------------------------------------------------- 2
  // Thu tiền mặt 8 buổi kèm chiết khấu 10%: công nợ giảm bằng tiền mặt CỘNG phần chiết
  // khấu, nên ví phải nạp theo giá trị đã giảm nợ. Nạp theo mỗi tiền mặt là học viên
  // trả đủ tiền 8 buổi nhưng chỉ được học 7.
  await test("Chiết khấu tiền mặt KHÔNG làm học viên mất buổi", async () => {
    const branch = await seedBranch(db);
    const cls = await seedClass(db, branch.id);
    const student = await seedStudent(db, branch.id, "B");
    const enrollment = await seedEnrollment(db, {
      studentId: student.id,
      classId: cls.id,
      billingModel: "PERIOD",
      enrollDate: day("2026-01-05"),
    });
    const cash = 8 * UNIT;
    const discount = Math.round((cash * 10) / 100);
    const payment = await seedPayment(db, { studentId: student.id, amount: cash });
    const multiplier = (cash + discount) / cash;

    await db.$transaction(async (tx) => {
      await topUpWalletFromPayment(tx, {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
        amountVnd: Math.round(cash * multiplier),
        unitPrice: UNIT,
      });
      const balance = await getWalletBalance(tx, enrollment.id);
      expectTrue(balance >= 8, "ví " + balance + " buổi, nhưng học viên đã trả đủ tiền 8 buổi");
    });
  });

  // ---------------------------------------------------------------- 3
  // Đây chính là cột "Số buổi nghỉ trừ ngoại lệ" trong file quản lý: buổi trung tâm
  // cho nghỉ thì học viên không mất buổi nào.
  await test("Buổi TRUNG TÂM CHO NGHỈ không trừ ví của ai", async () => {
    const branch = await seedBranch(db);
    const cls = await seedClass(db, branch.id);
    const student = await seedStudent(db, branch.id, "C");
    const enrollment = await seedEnrollment(db, {
      studentId: student.id,
      classId: cls.id,
      billingModel: "PERIOD",
      enrollDate: day("2026-01-05"),
    });
    const payment = await seedPayment(db, { studentId: student.id, amount: 10 * UNIT });
    const taught = await seedSession(db, cls.id, day("2026-01-07"), "COMPLETED");
    const cancelled = await seedSession(db, cls.id, day("2026-01-09"), "CANCELLED");

    await db.$transaction(async (tx) => {
      await topUpWalletFromPayment(tx, {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
        amountVnd: 10 * UNIT,
        unitPrice: UNIT,
      });
      await debitWalletsForCompletedSession(tx, taught.id);
      await debitWalletsForCompletedSession(tx, cancelled.id);
      expectEqual(
        await getWalletBalance(tx, enrollment.id),
        9,
        "ví sau 1 buổi dạy thật + 1 buổi trung tâm cho nghỉ",
      );
    });
  });

  // ---------------------------------------------------------------- 4
  await test("Chạy lại việc trừ ví cho cùng 1 buổi không trừ 2 lần", async () => {
    const branch = await seedBranch(db);
    const cls = await seedClass(db, branch.id);
    const student = await seedStudent(db, branch.id, "D");
    const enrollment = await seedEnrollment(db, {
      studentId: student.id,
      classId: cls.id,
      billingModel: "PERIOD",
      enrollDate: day("2026-01-05"),
    });
    const payment = await seedPayment(db, { studentId: student.id, amount: 5 * UNIT });
    const session = await seedSession(db, cls.id, day("2026-01-07"), "COMPLETED");

    await db.$transaction(async (tx) => {
      await topUpWalletFromPayment(tx, {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
        amountVnd: 5 * UNIT,
        unitPrice: UNIT,
      });
      await debitWalletsForCompletedSession(tx, session.id);
      await debitWalletsForCompletedSession(tx, session.id);
      await debitWalletsForCompletedSession(tx, session.id);
      expectEqual(await getWalletBalance(tx, enrollment.id), 4, "ví sau khi gọi trừ 3 lần cho cùng 1 buổi");
    });
  });

  // ---------------------------------------------------------------- 5
  await test("Hủy buổi đã dạy thì hoàn lại đúng buổi đã trừ", async () => {
    const branch = await seedBranch(db);
    const cls = await seedClass(db, branch.id);
    const student = await seedStudent(db, branch.id, "E");
    const enrollment = await seedEnrollment(db, {
      studentId: student.id,
      classId: cls.id,
      billingModel: "PERIOD",
      enrollDate: day("2026-01-05"),
    });
    const payment = await seedPayment(db, { studentId: student.id, amount: 6 * UNIT });
    const session = await seedSession(db, cls.id, day("2026-01-07"), "COMPLETED");

    await db.$transaction(async (tx) => {
      await topUpWalletFromPayment(tx, {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
        amountVnd: 6 * UNIT,
        unitPrice: UNIT,
      });
      await debitWalletsForCompletedSession(tx, session.id);
      expectEqual(await getWalletBalance(tx, enrollment.id), 5, "ví sau khi dạy");
      await reverseWalletDebitsForSession(tx, session.id);
      expectEqual(await getWalletBalance(tx, enrollment.id), 6, "ví sau khi hủy buổi đó");
    });
  });

  // ---------------------------------------------------------------- 6
  // Lớp chỉ là cái mác: người vào sau ngày buổi học, và người đã kết thúc trước đó,
  // đều không thuộc về buổi này.
  await test("Chỉ học viên THUỘC VỀ buổi đó mới bị trừ ví", async () => {
    const branch = await seedBranch(db);
    const cls = await seedClass(db, branch.id);
    const sessionDate = day("2026-02-10");
    await seedSession(db, cls.id, sessionDate, "COMPLETED");

    const inClass = await seedStudent(db, branch.id, "Đang học");
    const joinsLater = await seedStudent(db, branch.id, "Vào sau");
    const alreadyLeft = await seedStudent(db, branch.id, "Đã nghỉ");

    await seedEnrollment(db, {
      studentId: inClass.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-01-05"),
    });
    await seedEnrollment(db, {
      studentId: joinsLater.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-03-01"),
    });
    await seedEnrollment(db, {
      studentId: alreadyLeft.id, classId: cls.id, billingModel: "PERIOD",
      enrollDate: day("2026-01-05"), endDate: day("2026-01-31"),
    });

    await db.$transaction(async (tx) => {
      const roster = await getEnrollmentsForSession(tx, {
        classId: cls.id, sessionDate, billingModel: "PERIOD",
      });
      expectEqual(roster.length, 1, "số người thuộc về buổi này");
      expectEqual(roster[0]?.studentId, inClass.id, "đúng người còn đang học");
    });
  });

  // ---------------------------------------------------------------- 7
  await test("Đóng dư giữ lại được, kỳ sau tự trừ vào phiếu mới", async () => {
    const branch = await seedBranch(db);
    const cls = await seedClass(db, branch.id);
    const student = await seedStudent(db, branch.id, "F");
    const period1 = await seedBillingPeriod(db, branch.id, "2026-01");
    const period2 = await seedBillingPeriod(db, branch.id, "2026-02");
    await seedCharge(db, {
      studentId: student.id, classId: cls.id, billingPeriodId: period1.id,
      tuitionAmount: 5 * UNIT, unitPrice: UNIT,
    });
    await seedPayment(db, { studentId: student.id, amount: 5 * UNIT + 500_000 });

    await db.$transaction(async (tx) => {
      await settleChargesFromAdvancePayments(tx, student.id);
      expectEqual(await computeAdvanceBalance(tx, student.id), 500_000, "tiền đóng trước còn lại");
    });

    // Kỳ sau sinh phiếu mới: phải tự trừ vào tiền đã đóng trước, phụ huynh không đóng lại.
    const newCharge = await seedCharge(db, {
      studentId: student.id,
      classId: cls.id,
      billingPeriodId: period2.id,
      tuitionAmount: 300_000,
      unitPrice: UNIT,
    });

    await db.$transaction(async (tx) => {
      await settleChargesFromAdvancePayments(tx, student.id);
      const paid = await tx.paymentAllocation.aggregate({
        where: { chargeId: newCharge.id },
        _sum: { amount: true },
      });
      expectEqual(paid._sum.amount ?? 0, 300_000, "phiếu kỳ sau tự thu được");
      expectEqual(await computeAdvanceBalance(tx, student.id), 200_000, "tiền đóng trước còn lại sau khi trừ");
    });
  });

  // ---------------------------------------------------------------- 8
  // Quy tắc gốc: SỐ TIỀN THU VÀO LÀ ĐÍCH ĐẾN CUỐI CÙNG. Mua 20 buổi nhưng mới đóng tiền
  // 10 buổi, đã học 4 buổi thì chỉ được mang sang 6 buổi, không phải 16.
  await test("Chuyển lớp không mang sang nhiều hơn số tiền ĐÃ THU", async () => {
    const enrollment = {
      billingModel: "COURSE",
      purchasedMainSessionCount: 20,
      manualExtraSessionCount: 0,
      tuitionUnitPriceSnapshot: UNIT,
      paidCatchupSessionCount: 0,
      paidCatchupUnitPrice: null,
      transferredValueAmount: 0,
      usedSessionCount: 4,
      class: { totalSessions: 48, tuitionPerSession: UNIT, nextClassId: null, course: null, scheduleRules: [], branchId: "x" },
    };
    // Đã học 4 buổi, mới đóng tiền 10 buổi trên tổng 20 buổi đã đăng ký.
    const snapshot = computeLearningSnapshot(enrollment as never, 4, [], undefined, undefined, 10 * UNIT);
    expectEqual(snapshot.transferableSessions, 6, "số buổi được mang sang");
    expectEqual(snapshot.transferableValue, 6 * UNIT, "giá trị mang sang (" + vnd(6 * UNIT) + ")");
  });

  // ---------------------------------------------------------------- 9
  await test("Quy đổi khi lớp mới có đơn giá khác", async () => {
    const converted = computeTransferConversionFromValue(6 * UNIT, 200_000);
    expectEqual(converted.convertedSessionCount, 5, "số buổi ở lớp mới (1.020.000đ / 200.000đ)");
    expectEqual(converted.remainingCashAmount, 20_000, "tiền lẻ còn lại");
  });

  // ---------------------------------------------------------------- 10
  await test("Chuyển ví sang lớp mới giữ nguyên giá trị tiền", async () => {
    const branch = await seedBranch(db);
    const oldClass = await seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const newClass = await seedClass(db, branch.id, { tuitionPerSession: 200_000 });
    const student = await seedStudent(db, branch.id, "G");
    const oldEnrollment = await seedEnrollment(db, {
      studentId: student.id, classId: oldClass.id, billingModel: "PERIOD", enrollDate: day("2026-01-05"),
    });
    const newEnrollment = await seedEnrollment(db, {
      studentId: student.id, classId: newClass.id, billingModel: "PERIOD", enrollDate: day("2026-03-01"),
    });
    const payment = await seedPayment(db, { studentId: student.id, amount: 6 * UNIT });

    await db.$transaction(async (tx) => {
      await topUpWalletFromPayment(tx, {
        enrollmentId: oldEnrollment.id, paymentId: payment.id, amountVnd: 6 * UNIT, unitPrice: UNIT,
      });
      await transferWalletToNewEnrollment(tx, {
        fromEnrollmentId: oldEnrollment.id,
        toEnrollmentId: newEnrollment.id,
        oldUnitPrice: UNIT,
        newUnitPrice: 200_000,
      });
      expectEqual(await getWalletBalance(tx, oldEnrollment.id), 0, "ví lớp cũ sau khi chuyển");
      expectEqual(
        await getWalletBalance(tx, newEnrollment.id),
        5,
        "ví lớp mới (6 buổi x 170k = 1.020k, chia cho 200k)",
      );
    });
  });

  // ---------------------------------------------------------------- 11
  await test("Kết thúc lớp: ai phải chuyển, ai coi như xong", async () => {
    expectEqual(
      enrollmentNeedsTransferOnComplete({ billingModel: "PERIOD", remainingMainSessions: 0, hasNextClass: true }),
      true,
      "theo tháng + có lớp tiếp theo",
    );
    expectEqual(
      enrollmentNeedsTransferOnComplete({ billingModel: "PERIOD", remainingMainSessions: 0, hasNextClass: false }),
      false,
      "theo tháng + không có lớp tiếp theo",
    );
    expectEqual(
      enrollmentNeedsTransferOnComplete({ billingModel: "COURSE", remainingMainSessions: 3, hasNextClass: false }),
      true,
      "theo khóa còn 3 buổi chưa học",
    );
    expectEqual(
      enrollmentNeedsTransferOnComplete({ billingModel: "COURSE", remainingMainSessions: 0, hasNextClass: true }),
      false,
      "theo khóa đã học đủ buổi",
    );
  });

  const failed = summary();
  await db.$disconnect();
  dropTestDatabase();
  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  dropTestDatabase();
  process.exit(1);
});
