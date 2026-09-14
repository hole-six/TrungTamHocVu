// Test tự động CHUYỂN LỚP GIỮA THÁNG khi đã đóng / chưa đóng / đóng một phần học phí.
// Chạy: npm run test:transfer
//
// Mô phỏng từng ngày: đợt thu tự động mỗi đêm, điểm danh trừ ví, đóng tiền, chuyển lớp đúng
// các bước của route chuyển lớp. Mỗi tháng so "đáng thu" (buổi thật sự học ở lớp A × giá A +
// buổi học ở lớp B × giá B) với tổng phiếu đã lập.
//
// Lỗi thật đã sửa: chưa đóng (hoặc đóng một phần) tháng 9 mà chuyển lớp 16/9 thì phiếu lớp
// cũ vẫn đòi đủ 8 buổi còn lớp mới đòi thêm 4 buổi → thu dư 600.000đ; chuyển đúng 1/10 thì
// phiếu tháng 10 lớp cũ còn nguyên → thu dư 1.200.000đ. Xem trimOldPeriodChargesOnTransfer.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, summary } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { generateChargesForPeriod, ensureBillingPeriod, generatePeriodChargesForNewEnrollment, trimOldPeriodChargesOnTransfer } = await import("@/lib/server/billing-generation");
  const { topUpWalletFromPayment, debitWalletsForCompletedSession, transferWalletToNewEnrollment } = await import("@/lib/server/enrollment-wallet");
  const { chargeOwnDueAmount, monthKey } = await import("@/lib/server/tuition-rules");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");
  const db = new PrismaClient();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  async function seedWeekly(classId: string, from: string, to: string, weekdays: number[]) {
    for (let d = day(from); d <= day(to); d = new Date(d.getTime() + 86_400_000)) {
      if (weekdays.includes(d.getUTCDay())) await fx.seedSession(db, classId, d, "PLANNED");
    }
  }
  async function pay(studentId: string, amount: number, paidDate: Date) {
    const payment = await fx.seedPayment(db, { studentId, amount, paidDate });
    const charges = await db.charge.findMany({ where: { studentId }, include: { allocations: true, billingPeriod: true }, orderBy: [{ billingPeriod: { startDate: "asc" } }, { createdAt: "asc" }] });
    let remaining = amount;
    for (const charge of charges) {
      if (remaining <= 0) break;
      const due = chargeOwnDueAmount(charge) - charge.allocations.reduce((s, a) => s + a.amount, 0);
      if (due <= 0) continue;
      const alloc = Math.min(due, remaining);
      await db.paymentAllocation.create({ data: { paymentId: payment.id, chargeId: charge.id, amount: alloc } });
      remaining -= alloc;
      if (charge.enrollmentId) await db.$transaction((tx) => topUpWalletFromPayment(tx, { enrollmentId: charge.enrollmentId!, paymentId: payment.id, amountVnd: alloc, unitPrice: charge.unitPrice }));
    }
  }

  async function scenario(name: string, opts: { priceA: number; priceB: number; transferAt: string; paySep: "FULL" | "HALF" | "SIX" | "NONE" }) {
    const branch = await fx.seedBranch(db);
    const A = await fx.seedClass(db, branch.id, { tuitionPerSession: opts.priceA });
    const B = await fx.seedClass(db, branch.id, { tuitionPerSession: opts.priceB });
    await seedWeekly(A.id, "2026-09-01", "2026-10-31", [1, 4]); // T2, T5
    await seedWeekly(B.id, "2026-09-01", "2026-10-31", [2, 5]); // T3, T6
    const student = await fx.seedStudent(db, branch.id, name);
    const oldE = await fx.seedEnrollment(db, { studentId: student.id, classId: A.id, billingModel: "PERIOD", enrollDate: day("2026-08-20") });
    let newE: { id: string } | null = null;

    for (let d = day("2026-09-01"); d <= day("2026-10-31"); d = new Date(d.getTime() + 86_400_000)) {
      const period = await ensureBillingPeriod(branch.id, monthKey(d));
      await generateChargesForPeriod(period.id); // đợt thu tự động mỗi đêm
      if (ymd(d) === opts.transferAt) {
        // Đúng các bước route chuyển lớp PERIOD.
        const now = new Date(`${opts.transferAt}T05:00:00.000Z`);
        await db.enrollment.update({ where: { id: oldE.id }, data: { status: "TRANSFERRED", endDate: now } });
        newE = await db.enrollment.create({ data: { studentId: student.id, classId: B.id, status: "ACTIVE", billingModel: "PERIOD", enrollDate: now, tuitionUnitPriceSnapshot: opts.priceB } });
        await db.$transaction(async (tx) => {
          await transferWalletToNewEnrollment(tx, { fromEnrollmentId: oldE.id, toEnrollmentId: newE!.id, oldUnitPrice: opts.priceA, newUnitPrice: opts.priceB });
          await trimOldPeriodChargesOnTransfer(tx, { enrollmentId: oldE.id, leftAt: now, reason: "Chuyển lớp" });
        });
        await generatePeriodChargesForNewEnrollment(newE.id, now);
      }
      for (const s of await db.classSession.findMany({ where: { classId: { in: [A.id, B.id] }, sessionDate: d } })) {
        await db.classSession.update({ where: { id: s.id }, data: { status: "COMPLETED" } });
        await db.$transaction((tx) => debitWalletsForCompletedSession(tx, s.id));
      }
      if (ymd(d) === "2026-09-02" && opts.paySep !== "NONE") {
        const sepCharge = await db.charge.findFirstOrThrow({ where: { studentId: student.id } });
        await pay(student.id, opts.paySep === "FULL" ? chargeOwnDueAmount(sepCharge) : opts.paySep === "SIX" ? 6 * opts.priceA : Math.round(chargeOwnDueAmount(sepCharge) / 2), d);
      }
    }

    const charges = await db.charge.findMany({ where: { studentId: student.id }, include: { billingPeriod: true, allocations: true, class: true } });
    const debits = await db.enrollmentWalletTxn.findMany({ where: { kind: "SESSION_DEBIT", wallet: { enrollment: { studentId: student.id } } }, include: { session: { include: { class: true } } } });
    const learned = (month: string, cls: string) => debits.filter((x) => x.session?.sessionDate.toISOString().startsWith(month) && x.session?.class.id === cls).length;
    const results: Array<{ month: string; fair: number; billed: number }> = [];
    for (const month of ["2026-09", "2026-10"]) {
      const a = learned(month, A.id), b = learned(month, B.id);
      const fair = a * opts.priceA + b * opts.priceB;
      const billed = charges.filter((c) => c.billingPeriod?.periodName === month).reduce((s, c) => s + c.tuitionAmount, 0);
      results.push({ month, fair, billed });
    }
    const paid = charges.reduce((s, c) => s + c.allocations.reduce((x, y) => x + y.amount, 0), 0);
    const owed = charges.reduce((s, c) => s + chargeOwnDueAmount(c), 0) - paid;
    const fairTotal = results.reduce((s, r) => s + r.fair, 0);
    for (const r of results) expectEqual(r.billed, r.fair, `tháng ${r.month.slice(5)}: phiếu = buổi thật sự học × đơn giá`);
    expectEqual(owed, fairTotal - paid, "còn nợ = đáng thu − đã đóng");
  }

  await test("Đã đóng đủ tháng 9, chuyển 16/9 cùng giá", () => scenario("Đã đóng đủ tháng 9, chuyển 16/9 cùng giá", { priceA: 150_000, priceB: 150_000, transferAt: "2026-09-16", paySep: "FULL" }));
  await test("CHƯA đóng tháng 9, chuyển 16/9 cùng giá", () => scenario("CHƯA đóng tháng 9, chuyển 16/9 cùng giá", { priceA: 150_000, priceB: 150_000, transferAt: "2026-09-16", paySep: "NONE" }));
  await test("Đóng NỬA tháng 9, chuyển 16/9 cùng giá", () => scenario("Đóng NỬA tháng 9, chuyển 16/9 cùng giá", { priceA: 150_000, priceB: 150_000, transferAt: "2026-09-16", paySep: "HALF" }));
  await test("Chưa đóng tháng 9, chuyển đúng ngày 1/10 (phiếu tháng 10 lớp cũ đã lập đêm đó)", () => scenario("Chưa đóng tháng 9, chuyển đúng ngày 1/10 (phiếu tháng 10 lớp cũ đã lập đêm đó)", { priceA: 150_000, priceB: 150_000, transferAt: "2026-10-01", paySep: "NONE" }));
  await test("Đã đóng đủ tháng 9, chuyển 16/9 sang lớp giá cao hơn", () => scenario("Đã đóng đủ tháng 9, chuyển 16/9 sang lớp giá cao hơn", { priceA: 150_000, priceB: 200_000, transferAt: "2026-09-16", paySep: "FULL" }));
  await test("Chưa đóng tháng 9, chuyển 16/9 sang lớp giá cao hơn", () => scenario("Chưa đóng tháng 9, chuyển 16/9 sang lớp giá cao hơn", { priceA: 150_000, priceB: 200_000, transferAt: "2026-09-16", paySep: "NONE" }));
  await test("Đóng 6/8 buổi tháng 9, chuyển 16/9 cùng giá", () => scenario("Đóng 6/8 buổi tháng 9, chuyển 16/9 cùng giá", { priceA: 150_000, priceB: 150_000, transferAt: "2026-09-16", paySep: "SIX" }));
  const failed = summary();
  await db.$disconnect();
  await shared.$disconnect();
  dropTestDatabase();
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); dropTestDatabase(); process.exit(1); });
