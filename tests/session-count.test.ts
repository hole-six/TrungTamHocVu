// Số buổi THU TIỀN của tháng phải bằng số buổi lớp THỰC SỰ dạy trong tháng đó.
// Ca thực tế gặp trên VPS: lớp học thứ 2 + thứ 4, tháng 30 ngày, học viên mới vào giữa
// tháng — phiếu thu 5 buổi trong khi lịch lớp có 6 buổi.
// Chạy: npm run test:sessions
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, summary } from "./harness";

const UNIT = 100_000;

async function main() {
  prepareTestDatabase();

  const { PrismaClient } = await import("@prisma/client");
  const { generateChargesForPeriod, generatePeriodChargesForNewEnrollment } = await import("@/lib/server/billing-generation");
  const { prisma: sharedClient } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  console.log("Chạy test số buổi thu tiền trên CSDL riêng (prisma/test.db):\n");

  // Tháng 9/2026 có 30 ngày: thứ 2 = 7, 14, 21, 28 · thứ 4 = 2, 9, 16, 23, 30.
  async function seedMonWed(classId: string, from: string, to: string) {
    const created: string[] = [];
    for (let d = day(from); d <= day(to); d = new Date(d.getTime() + 86_400_000)) {
      if (d.getUTCDay() === 1 || d.getUTCDay() === 3) {
        await fx.seedSession(db, classId, d, "PLANNED");
        created.push(ymd(d));
      }
    }
    return created;
  }

  async function seedRules(classId: string) {
    for (const weekday of [1, 3]) {
      await db.scheduleRule.create({
        data: { classId, weekday, startTime: "17:30", endTime: "19:00", isActive: true },
      });
    }
  }

  // ---------------------------------------------------------------- 1
  // Vào lớp ĐÚNG NGÀY có buổi học (thứ 2 14/9): buổi hôm đó phải được tính.
  await test("Vào lớp đúng ngày có buổi: thu đủ 6 buổi còn lại của tháng (14,16,21,23,28,30)", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT, totalSessions: 60 });
    await seedRules(cls.id);
    await seedMonWed(cls.id, "2026-09-01", "2026-09-30");
    const student = await fx.seedStudent(db, branch.id, "Vào ngày 14/9");
    const enrollment = await fx.seedEnrollment(db, {
      studentId: student.id,
      classId: cls.id,
      billingModel: "PERIOD",
      // Ghi danh lúc 10h sáng — enrollDate mang cả giờ, buổi cùng ngày không được loại.
      enrollDate: new Date("2026-09-14T03:00:00.000Z"),
    });
    await generatePeriodChargesForNewEnrollment(enrollment.id, day("2026-09-14"));
    const charge = await db.charge.findFirstOrThrow({ where: { enrollmentId: enrollment.id } });
    expectEqual(charge.scheduledSessionCount, 6, "tổng buổi từ 14/9 tới hết tháng");
    expectEqual(charge.sessionCount, 6, "số buổi thu tiền");
    expectEqual(charge.tuitionAmount, 6 * UNIT, "học phí 6 buổi");
  });

  // ---------------------------------------------------------------- 2
  // Buổi CUỐI THÁNG rơi đúng ngày 30 (thứ 4) — không được rơi ra ngoài mốc cuối kỳ.
  await test("Buổi cuối tháng đúng ngày 30: vẫn nằm trong kỳ thu tháng đó", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT, totalSessions: 60 });
    await seedRules(cls.id);
    await seedMonWed(cls.id, "2026-09-01", "2026-09-30");
    const student = await fx.seedStudent(db, branch.id, "Cả tháng 9");
    await fx.seedEnrollment(db, { studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-09-01") });
    const september = await fx.seedBillingPeriod(db, branch.id, "2026-09");
    await generateChargesForPeriod(september.id);
    const charge = await db.charge.findFirstOrThrow({ where: { billingPeriodId: september.id, studentId: student.id } });
    expectEqual(charge.scheduledSessionCount, 9, "9 buổi thứ 2 + thứ 4 của tháng 9");
  });

  // ---------------------------------------------------------------- 3
  // ĐÚNG CA THẬT TRÊN VPS: lớp thứ 2 + thứ 4, lịch mới sinh tới vài ngày sau hôm nay
  // (đợt sinh buổi tự động chưa chạy tới cuối tháng), học viên mới vào hôm nay — phiếu
  // phải thu đủ số buổi lớp SẼ dạy từ hôm nay tới hết tháng, không phải chỉ số buổi đã
  // có trong lịch. Dùng tháng HIỆN TẠI để test không phụ thuộc ngày chạy.
  await test("Lịch lớp chưa sinh tới cuối tháng: phiếu vẫn thu đủ số buổi lớp sẽ dạy", async () => {
    const { getVietnamToday } = await import("@/lib/server/class-rules");
    const { monthKey } = await import("@/lib/server/tuition-rules");
    const today = getVietnamToday();
    const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    // Số buổi thứ 2 + thứ 4 còn lại của tháng, tính từ hôm nay.
    let expected = 0;
    for (let d = new Date(today); d <= monthEnd; d = new Date(d.getTime() + 86_400_000)) {
      if (d.getUTCDay() === 1 || d.getUTCDay() === 3) expected += 1;
    }

    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT, totalSessions: 200 });
    await db.class.update({ where: { id: cls.id }, data: { startDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), expectedEndDate: null } });
    await seedRules(cls.id);
    // Lịch chỉ có tới 2 ngày sau hôm nay.
    const partialEnd = new Date(today.getTime() + 2 * 86_400_000);
    await seedMonWed(cls.id, ymd(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))), ymd(partialEnd));

    const student = await fx.seedStudent(db, branch.id, "Lịch thiếu cuối tháng");
    const enrollment = await fx.seedEnrollment(db, { studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: today });
    await generatePeriodChargesForNewEnrollment(enrollment.id, today);

    const charge = await db.charge.findFirstOrThrow({ where: { enrollmentId: enrollment.id } });
    const sessionsNow = await db.classSession.count({ where: { classId: cls.id, sessionDate: { gte: today, lte: monthEnd } } });
    expectEqual(sessionsNow, expected, `lịch lớp được sinh đủ tới hết tháng ${monthKey(today)} (${expected} buổi)`);
    expectEqual(charge.scheduledSessionCount, expected, `phiếu tính đủ ${expected} buổi`);
    expectEqual(charge.sessionCount, expected, "số buổi thu tiền");
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
