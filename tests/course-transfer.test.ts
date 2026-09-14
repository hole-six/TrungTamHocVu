// Test tự động CHUYỂN LỚP gói MUA THEO KHÓA. Chạy: npm run test:course-transfer
//
// Chốt nghiệp vụ: HỌC PHÍ ĐÃ NỘP − giá trị các buổi ĐÃ HỌC = phần còn lại, quy ra số buổi ở
// lớp mới theo đơn giá lớp mới. Chưa nộp thì không có gì để quy đổi; buổi đã học mà chưa nộp
// vẫn là nợ. Các buổi CHƯA HỌC mà CHƯA NỘP không còn là nợ ở lớp cũ nữa.
//
// Mỗi tình huống đi đúng các bước của route chuyển lớp (snapshot → quy đổi → ghi danh mới →
// cắt phiếu khóa cũ → lập phiếu khóa mới), rồi so:
//   - số buổi được ở lớp mới  = floor((đã nộp + tiền mang sang − đã học × giá cũ) / giá mới)
//   - còn nợ                   = max(0, đã học × giá cũ − (đã nộp + tiền mang sang))
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, summary } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { generateCourseCharge, trimOldCourseChargeOnTransfer } = await import("@/lib/server/billing-generation");
  const { getEnrollmentLearningSnapshot, computeTransferConversionFromValue } = await import("@/lib/server/enrollment-learning");
  const { chargeOwnDueAmount } = await import("@/lib/server/tuition-rules");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");
  const db = new PrismaClient();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  console.log("Chạy test chuyển lớp gói theo khóa (prisma/test.db):\n");

  async function classWithSessions(branchId: string, price: number, from: string, count: number) {
    const cls = await fx.seedClass(db, branchId, { tuitionPerSession: price, totalSessions: 60 });
    const sessions = [];
    for (let i = 0; i < count; i += 1) sessions.push(await fx.seedSession(db, cls.id, new Date(day(from).getTime() + i * 2 * 86_400_000), "PLANNED"));
    return { cls, sessions };
  }
  async function pay(studentId: string, chargeId: string, amount: number) {
    if (amount <= 0) return;
    const payment = await fx.seedPayment(db, { studentId, amount });
    await db.paymentAllocation.create({ data: { paymentId: payment.id, chargeId, amount } });
  }
  async function teach(sessions: { id: string }[], n: number) {
    for (const s of sessions.slice(0, n)) await db.classSession.update({ where: { id: s.id }, data: { status: "COMPLETED" } });
  }
  async function owed(studentId: string) {
    const charges = await db.charge.findMany({ where: { studentId }, include: { allocations: true } });
    return charges.reduce((s, c) => s + chargeOwnDueAmount(c) - c.allocations.reduce((x, a) => x + a.amount, 0), 0);
  }

  // Đúng các bước của app/api/enrollments/[id]/transfer/route.ts cho gói theo khóa.
  async function transfer(enrollmentId: string, targetClassId: string, newPrice: number, at: Date) {
    const existing = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { class: { include: { course: true } } } });
    const snapshot = await getEnrollmentLearningSnapshot(db, existing);
    const conversion = computeTransferConversionFromValue(snapshot.transferableValue, newPrice);
    const created = await db.$transaction(async (tx) => {
      await tx.enrollment.update({ where: { id: existing.id }, data: { status: "TRANSFERRED", endDate: at } });
      const next = await tx.enrollment.create({
        data: {
          studentId: existing.studentId, classId: targetClassId, status: "ACTIVE", billingModel: "COURSE",
          enrollDate: at, learningStartDate: at, purchasedMainSessionCount: conversion.convertedSessionCount,
          tuitionUnitPriceSnapshot: newPrice, pricingBasis: "CONTINUATION_TRANSFER", transferredFromEnrollmentId: existing.id,
          transferredValueAmount: conversion.remainingValue, transferredConvertedSessionCount: conversion.convertedSessionCount,
          transferredRemainingCashAmount: conversion.remainingCashAmount,
        },
      });
      await trimOldCourseChargeOnTransfer(tx, {
        enrollmentId: existing.id, completedSessions: snapshot.completedMainSessions, transferValueOut: conversion.remainingValue, reason: "Chuyển lớp",
      });
      return next;
    });
    if (conversion.convertedSessionCount > 0) await generateCourseCharge(created.id);
    return { created, conversion, snapshot };
  }

  async function scenario(opts: { priceA: number; priceB: number; bought: number; paid: number; learned: number }) {
    const branch = await fx.seedBranch(db);
    const A = await classWithSessions(branch.id, opts.priceA, "2026-03-02", 30);
    const B = await classWithSessions(branch.id, opts.priceB, "2026-05-01", 30);
    const student = await fx.seedStudent(db, branch.id, "Khóa");
    const e = await fx.seedEnrollment(db, { studentId: student.id, classId: A.cls.id, billingModel: "COURSE", enrollDate: day("2026-03-01"), purchasedMainSessionCount: opts.bought, unitPrice: opts.priceA });
    await generateCourseCharge(e.id);
    const charge = await db.charge.findFirstOrThrow({ where: { enrollmentId: e.id } });
    await pay(student.id, charge.id, opts.paid);
    await teach(A.sessions, opts.learned);
    const r = await transfer(e.id, B.cls.id, opts.priceB, new Date("2026-04-30T05:00:00.000Z"));
    const expectedSessions = Math.floor(Math.max(0, opts.paid - opts.learned * opts.priceA) / opts.priceB);
    const expectedOwed = Math.max(0, opts.learned * opts.priceA - opts.paid);
    expectEqual(r.created.purchasedMainSessionCount, expectedSessions, "số buổi quy đổi sang lớp mới");
    expectEqual(await owed(student.id), expectedOwed, "còn nợ = buổi đã học chưa nộp");
    return { student, B, newEnrollment: r.created };
  }

  // ---------------------------------------------------------------- 1
  await test("Đã nộp đủ 24 buổi, học 5 → lớp mới 19 buổi, không nợ", () =>
    scenario({ priceA: 100_000, priceB: 100_000, bought: 24, paid: 2_400_000, learned: 5 }).then(() => undefined));
  // ---------------------------------------------------------------- 2
  await test("CHƯA nộp, học 5 → lớp mới 0 buổi, chỉ nợ 5 buổi đã học (không nợ cả khóa)", () =>
    scenario({ priceA: 100_000, priceB: 100_000, bought: 24, paid: 0, learned: 5 }).then(() => undefined));
  // ---------------------------------------------------------------- 3
  await test("Nộp 10 buổi, học 5 → lớp mới 5 buổi, không nợ", () =>
    scenario({ priceA: 100_000, priceB: 100_000, bought: 24, paid: 1_000_000, learned: 5 }).then(() => undefined));
  // ---------------------------------------------------------------- 4
  await test("Nộp 3 buổi, học 5 → lớp mới 0 buổi, nợ 2 buổi", () =>
    scenario({ priceA: 100_000, priceB: 100_000, bought: 24, paid: 300_000, learned: 5 }).then(() => undefined));
  // ---------------------------------------------------------------- 5
  await test("Nộp đủ, học 4, sang lớp giá cao hơn → quy tiền: 20 × 100.000 = 2.000.000 → 16 buổi × 125.000", () =>
    scenario({ priceA: 100_000, priceB: 125_000, bought: 24, paid: 2_400_000, learned: 4 }).then(() => undefined));

  // ---------------------------------------------------------------- 6
  await test("Chuyển 2 lần A → B → C: tiền mang sang ở B vẫn được quy đổi tiếp sang C", async () => {
    const { student, newEnrollment } = await scenario({ priceA: 100_000, priceB: 100_000, bought: 24, paid: 2_400_000, learned: 5 });
    const branch = await db.student.findUniqueOrThrow({ where: { id: student.id } });
    const B = await db.enrollment.findUniqueOrThrow({ where: { id: newEnrollment.id } });
    const bSessions = await db.classSession.findMany({ where: { classId: B.classId! }, orderBy: { sessionDate: "asc" } });
    await teach(bSessions, 4);
    const C = await classWithSessions(branch.branchId, 100_000, "2026-08-01", 30);
    const r = await transfer(B.id, C.cls.id, 100_000, new Date("2026-07-31T05:00:00.000Z"));
    expectEqual(r.created.purchasedMainSessionCount, 15, "24 − 5 − 4 = 15 buổi ở lớp C");
    expectEqual(await owed(student.id), 0, "không nợ");
  });

  // ---------------------------------------------------------------- 7
  await test("Chưa nộp lúc chuyển, SAU ĐÓ nộp nợ: chỉ phải nộp đúng 5 buổi đã học", async () => {
    const { student } = await scenario({ priceA: 100_000, priceB: 100_000, bought: 24, paid: 0, learned: 5 });
    const debt = await db.charge.findFirstOrThrow({ where: { studentId: student.id, billingModel: "COURSE" }, include: { allocations: true } });
    await pay(student.id, debt.id, 500_000);
    expectEqual(await owed(student.id), 0, "nộp 500.000đ là hết nợ");
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
