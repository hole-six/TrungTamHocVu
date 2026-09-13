// Mô phỏng ĐỜI THỰC của một học viên đóng theo tháng, từng ngày một, từ lúc vào lớp tới
// giữa tháng 9 — thay vì thử từng hàm lẻ. Mỗi ngày: đợt lập phiếu tự động chạy, buổi
// học hôm đó được điểm danh (trừ ví), ngày phụ huynh đóng tiền thì phân bổ đúng như
// màn thu tiền (cũ trước, mới sau) và nạp ví.
// Chạy: npm run test:timeline
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, summary } from "./harness";

const UNIT = 170_000;

async function main() {
  prepareTestDatabase();

  const { PrismaClient } = await import("@prisma/client");
  const { generateChargesForPeriod, generatePeriodChargesForNewEnrollment, ensureBillingPeriod } = await import(
    "@/lib/server/billing-generation"
  );
  const { topUpWalletFromPayment, debitWalletsForCompletedSession } = await import("@/lib/server/enrollment-wallet");
  const { chargeOwnDueAmount, monthKey } = await import("@/lib/server/tuition-rules");
  const { prisma: sharedClient } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  console.log("Mô phỏng từng ngày một học viên đóng theo tháng (prisma/test.db):\n");

  // Lớp học thứ 2 và thứ 5 — lịch đã sinh sẵn như đợt sinh buổi tự động.
  async function seedTwiceWeekly(classId: string, from: string, to: string, maxSessions = Infinity) {
    const sessions = [];
    for (let d = day(from); d <= day(to) && sessions.length < maxSessions; d = new Date(d.getTime() + 86_400_000)) {
      const weekday = d.getUTCDay();
      if (weekday === 1 || weekday === 4) sessions.push(await fx.seedSession(db, classId, d, "PLANNED"));
    }
    return sessions;
  }

  // Giống hệt app/api/payments/route.ts: tiền vào phiếu CŨ trước, nạp ví theo đơn giá phiếu.
  async function pay(studentId: string, amount: number, paidDate: Date) {
    const payment = await fx.seedPayment(db, { studentId, amount, paidDate });
    const charges = await db.charge.findMany({
      where: { studentId },
      include: { allocations: true, billingPeriod: true },
      orderBy: [{ billingPeriod: { startDate: "asc" } }, { createdAt: "asc" }],
    });
    let remaining = amount;
    for (const charge of charges) {
      if (remaining <= 0) break;
      const due = chargeOwnDueAmount(charge) - charge.allocations.reduce((s, a) => s + a.amount, 0);
      if (due <= 0) continue;
      const alloc = Math.min(due, remaining);
      await db.paymentAllocation.create({ data: { paymentId: payment.id, chargeId: charge.id, amount: alloc } });
      remaining -= alloc;
      if (charge.enrollmentId) {
        await db.$transaction((tx) =>
          topUpWalletFromPayment(tx, { enrollmentId: charge.enrollmentId!, paymentId: payment.id, amountVnd: alloc, unitPrice: charge.unitPrice }),
        );
      }
    }
  }

  async function outstanding(studentId: string) {
    const charges = await db.charge.findMany({ where: { studentId }, include: { allocations: true } });
    return charges.reduce((s, c) => s + chargeOwnDueAmount(c) - c.allocations.reduce((x, a) => x + a.amount, 0), 0);
  }

  // Chạy từng ngày: lập phiếu tháng hiện tại (đợt tự động mỗi đêm), điểm danh buổi hôm đó,
  // và đóng tiền theo lịch payOn (ngày → hàm tính số tiền).
  async function simulate(params: {
    branchId: string;
    studentId: string;
    classId: string;
    from: string;
    to: string;
    payOn: Record<string, () => Promise<number>>;
    onDay?: (date: string) => Promise<void>;
  }) {
    for (let d = day(params.from); d <= day(params.to); d = new Date(d.getTime() + 86_400_000)) {
      const period = await ensureBillingPeriod(params.branchId, monthKey(d));
      await generateChargesForPeriod(period.id);
      const todays = await db.classSession.findMany({ where: { classId: params.classId, sessionDate: d } });
      for (const s of todays) {
        await db.classSession.update({ where: { id: s.id }, data: { status: "COMPLETED" } });
        await db.$transaction((tx) => debitWalletsForCompletedSession(tx, s.id));
      }
      const payFn = params.payOn[ymd(d)];
      if (payFn) {
        const amount = await payFn();
        if (amount > 0) await pay(params.studentId, amount, d);
      }
      await params.onDay?.(ymd(d));
    }
  }

  // ---------------------------------------------------------------- 1
  await test("Đóng đúng hạn mỗi tháng: tháng nào cũng có phiếu, giữa tháng 9 ví và nợ khớp", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT, totalSessions: 60 });
    await seedTwiceWeekly(cls.id, "2026-06-01", "2026-10-31");
    const student = await fx.seedStudent(db, branch.id, "Đóng đúng hạn");
    const enrollment = await fx.seedEnrollment(db, { studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-06-02") });
    await generatePeriodChargesForNewEnrollment(enrollment.id, day("2026-06-02"));

    const payDue = async () => outstanding(student.id);
    await simulate({
      branchId: branch.id,
      studentId: student.id,
      classId: cls.id,
      from: "2026-06-02",
      to: "2026-09-13",
      payOn: { "2026-06-03": payDue, "2026-07-05": payDue, "2026-08-05": payDue, "2026-09-05": payDue },
    });

    const charges = await db.charge.findMany({ where: { enrollmentId: enrollment.id }, include: { billingPeriod: true }, orderBy: { billingPeriod: { startDate: "asc" } } });
    const summaryText = charges.map((c) => `${c.billingPeriod.periodName}:${c.sessionCount}`).join(" ");
    const september = charges.find((c) => c.billingPeriod.periodName === "2026-09");
    const sepSessions = await db.classSession.count({ where: { classId: cls.id, sessionDate: { gte: day("2026-09-01"), lte: day("2026-09-30") } } });
    expectEqual(charges.length, 4, `có phiếu tháng 6,7,8,9 (${summaryText})`);
    expectEqual(september?.sessionCount, sepSessions, `phiếu tháng 9 thu đủ ${sepSessions} buổi của tháng`);
    expectEqual(await outstanding(student.id), 0, "đã đóng hết, không nợ");
    const wallet = await db.enrollmentWallet.findUnique({ where: { enrollmentId: enrollment.id } });
    const taughtSoFar = await db.classSession.count({ where: { classId: cls.id, status: "COMPLETED", sessionDate: { gte: day("2026-06-02") } } });
    const paidSessions = charges.reduce((s, c) => s + c.sessionCount, 0);
    expectEqual(wallet?.balance, paidSessions - taughtSoFar, `ví = buổi đã đóng (${paidSessions}) − buổi đã dạy (${taughtSoFar})`);
  });

  // ---------------------------------------------------------------- 2
  await test("Chưa đóng tháng 9: giữa tháng phải thấy nợ tháng 9, ví về 0 rồi âm", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT, totalSessions: 60 });
    await seedTwiceWeekly(cls.id, "2026-06-01", "2026-10-31");
    const student = await fx.seedStudent(db, branch.id, "Chưa đóng tháng 9");
    const enrollment = await fx.seedEnrollment(db, { studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-06-02") });
    await generatePeriodChargesForNewEnrollment(enrollment.id, day("2026-06-02"));
    const payDue = async () => outstanding(student.id);
    await simulate({
      branchId: branch.id,
      studentId: student.id,
      classId: cls.id,
      from: "2026-06-02",
      to: "2026-09-13",
      payOn: { "2026-06-03": payDue, "2026-07-05": payDue, "2026-08-05": payDue },
    });
    const september = await db.charge.findFirst({ where: { enrollmentId: enrollment.id, billingPeriod: { periodName: "2026-09" } } });
    expectEqual((september?.sessionCount ?? 0) > 0, true, "có phiếu tháng 9");
    expectEqual(await outstanding(student.id), (september?.sessionCount ?? 0) * UNIT, "nợ đúng bằng phiếu tháng 9");
  });

  // ---------------------------------------------------------------- 3
  // Phụ huynh đóng tháng 8 trễ (sang tháng 9 mới đóng). Buổi tháng 8 đã nằm trên phiếu
  // tháng 8 — phiếu tháng 9 KHÔNG được đòi lại chúng lần nữa.
  await test("Đóng tháng 8 trễ sang tháng 9: phiếu tháng 9 không đòi lại buổi tháng 8", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT, totalSessions: 60 });
    await seedTwiceWeekly(cls.id, "2026-06-01", "2026-10-31");
    const student = await fx.seedStudent(db, branch.id, "Đóng trễ");
    const enrollment = await fx.seedEnrollment(db, { studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-06-02") });
    await generatePeriodChargesForNewEnrollment(enrollment.id, day("2026-06-02"));
    const payDue = async () => outstanding(student.id);
    const sepSessions = await db.classSession.count({ where: { classId: cls.id, sessionDate: { gte: day("2026-09-01"), lte: day("2026-09-30") } } });
    let septemberOnSep3: number | null = null;
    let owedOnSep3 = 0;
    await simulate({
      branchId: branch.id,
      studentId: student.id,
      classId: cls.id,
      from: "2026-06-02",
      to: "2026-09-13",
      payOn: { "2026-06-03": payDue, "2026-07-05": payDue },
      onDay: async (date) => {
        if (date === "2026-09-03") {
          const c = await db.charge.findFirst({ where: { enrollmentId: enrollment.id, billingPeriod: { periodName: "2026-09" } } });
          septemberOnSep3 = c?.sessionCount ?? null;
          owedOnSep3 = await outstanding(student.id);
        }
        if (date === "2026-09-10") {
          // Đóng đúng phiếu tháng 8 còn nợ.
          const aug = await db.charge.findFirstOrThrow({ where: { enrollmentId: enrollment.id, billingPeriod: { periodName: "2026-08" } }, include: { allocations: true } });
          await pay(student.id, chargeOwnDueAmount(aug) - aug.allocations.reduce((s, a) => s + a.amount, 0), day(date));
        }
      },
    });
    const aug = await db.charge.findFirstOrThrow({ where: { enrollmentId: enrollment.id, billingPeriod: { periodName: "2026-08" } } });
    expectEqual(septemberOnSep3, sepSessions, `ngày 3/9 (tháng 8 chưa đóng): phiếu tháng 9 = ${sepSessions} buổi của tháng 9`);
    expectEqual(owedOnSep3, (aug.sessionCount + sepSessions) * UNIT, "ngày 3/9 tổng nợ = tháng 8 + tháng 9, không cộng trùng");
    const september = await db.charge.findFirstOrThrow({ where: { enrollmentId: enrollment.id, billingPeriod: { periodName: "2026-09" } } });
    expectEqual(september.sessionCount, sepSessions, "ngày 13/9 (đã đóng tháng 8): phiếu tháng 9 vẫn đúng số buổi tháng 9");
  });

  // ---------------------------------------------------------------- 4
  // Lớp đi đủ số buổi của khóa (30 buổi) thì dừng — tháng sau không còn buổi nào ở lớp này
  // nên không có phiếu; học tiếp là chuyển sang lớp tiếp theo.
  await test("Lớp dạy đủ số buổi của khóa giữa tháng: phiếu chỉ tới buổi cuối, tháng sau không thu ở lớp này", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT, totalSessions: 30 });
    const sessions = await seedTwiceWeekly(cls.id, "2026-06-01", "2026-12-31", 30);
    const lastDate = sessions[sessions.length - 1].sessionDate;
    const student = await fx.seedStudent(db, branch.id, "Theo lớp tới buổi cuối");
    const enrollment = await fx.seedEnrollment(db, { studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-06-01") });
    await generatePeriodChargesForNewEnrollment(enrollment.id, day("2026-06-01"));
    const payDue = async () => outstanding(student.id);
    const endMonth = monthKey(lastDate);
    const [y, m] = endMonth.split("-").map(Number);
    const nextMonthFirst = ymd(new Date(Date.UTC(y, m, 1)));
    const payOn: Record<string, () => Promise<number>> = {};
    for (const mm of ["06", "07", "08", "09"]) payOn[`2026-${mm}-05`] = payDue;
    await simulate({ branchId: branch.id, studentId: student.id, classId: cls.id, from: "2026-06-01", to: nextMonthFirst, payOn });
    const charges = await db.charge.findMany({ where: { enrollmentId: enrollment.id } });
    const billed = charges.reduce((s, c) => s + c.sessionCount, 0);
    expectEqual(billed, 30, `tổng buổi đã lập phiếu = 30 buổi của lớp (buổi cuối ${ymd(lastDate)})`);
    const nextMonthCharge = await db.charge.findFirst({ where: { enrollmentId: enrollment.id, billingPeriod: { periodName: nextMonthFirst.slice(0, 7) } } });
    expectEqual(nextMonthCharge?.sessionCount ?? 0, 0, "tháng sau buổi cuối: không thu thêm ở lớp đã dạy xong");
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
