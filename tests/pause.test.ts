// Test tự động cho BẢO LƯU / ĐI HỌC LẠI. Chạy: npm run test:pause
//
// Hai lỗi thật đã sửa và phải khóa lại:
//   1. Mốc ngày: bảo lưu ghi theo GIỜ bấm nút nên lệch một ngày so với buổi học (buổi hôm
//      nay vẫn có tên sau khi bảo lưu; không có tên sau khi đi học lại).
//   2. Học phí: tháng đi học lại giữa chừng bị thu cả những buổi rơi vào kỳ bảo lưu.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, summary, vnd } from "./harness";

const UNIT = 150_000;

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { generateChargesForPeriod } = await import("@/lib/server/billing-generation");
  const { getEnrollmentsForSession } = await import("@/lib/server/class-roster");
  const { pauseStartBoundary, pauseEndBoundary, pickCurrentEnrollment } = await import("@/lib/server/class-rules");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  console.log("Chạy test bảo lưu trên CSDL riêng (prisma/test.db):\n");

  // ---------------------------------------------------------------- 1
  await test("Bảo lưu TỪ ngày F: buổi đúng ngày F đã không có tên; đi học lại TỪ ngày R: buổi ngày R có tên", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, "Bảo lưu");
    const enrollment = await fx.seedEnrollment(db, {
      studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-01-05"),
    });
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "ACTIVE", pausedFrom: pauseStartBoundary("2026-03-10"), pausedTo: pauseEndBoundary("2026-04-15") },
    });

    await db.$transaction(async (tx) => {
      const has = async (iso: string) =>
        (await getEnrollmentsForSession(tx, { classId: cls.id, sessionDate: day(iso) })).some((e) => e.id === enrollment.id);
      expectEqual(await has("2026-03-09"), true, "ngày trước bảo lưu còn tên");
      expectEqual(await has("2026-03-10"), false, "ĐÚNG ngày bắt đầu bảo lưu không còn tên");
      expectEqual(await has("2026-04-14"), false, "ngày cuối kỳ bảo lưu không có tên");
      expectEqual(await has("2026-04-15"), true, "ĐÚNG ngày đi học lại đã có tên");
    });
  });

  // ---------------------------------------------------------------- 2
  // Bảo lưu từ tháng 9, đi học lại 20/10, ví không còn buổi dư: tháng 10 lớp dạy 8 buổi,
  // em chỉ học 3 buổi từ 20/10 → chỉ được thu 3 buổi.
  await test("Tháng đi học lại giữa chừng chỉ thu các buổi từ ngày đi học lại", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, "Đi học lại 20/10");
    const enrollment = await fx.seedEnrollment(db, {
      studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-08-01"),
    });
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "ACTIVE", pausedFrom: pauseStartBoundary("2026-09-01"), pausedTo: pauseEndBoundary("2026-10-20") },
    });
    for (const d of ["01", "05", "08", "12", "15", "20", "22", "27"]) {
      await fx.seedSession(db, cls.id, day(`2026-10-${d}`), "PLANNED");
    }
    const october = await fx.seedBillingPeriod(db, branch.id, "2026-10");
    await generateChargesForPeriod(october.id);

    const charge = await db.charge.findFirst({ where: { billingPeriodId: october.id, studentId: student.id } });
    expectEqual(charge?.scheduledSessionCount, 3, "chỉ đếm 3 buổi từ 20/10");
    expectEqual(charge?.tuitionAmount, 3 * UNIT, "học phí tháng 10 " + vnd(3 * UNIT));
  });

  // ---------------------------------------------------------------- 3
  // Bảo lưu BẮT ĐẦU GIỮA tháng: phiếu tháng đó lập lúc em còn đang học — không được trừ
  // thêm, vì buổi chưa học đã nằm lại trong ví (trừ nữa là tính giá trị hai lần).
  await test("Tháng bắt đầu bảo lưu giữa chừng: phiếu tháng đó giữ nguyên, không trừ hai lần", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, "Bảo lưu giữa tháng");
    const enrollment = await fx.seedEnrollment(db, {
      studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-10-01"),
    });
    for (const d of ["02", "06", "09", "13", "16", "20", "23", "27"]) {
      await fx.seedSession(db, cls.id, day(`2026-11-${d}`), "PLANNED");
    }
    const november = await fx.seedBillingPeriod(db, branch.id, "2026-11");
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "ACTIVE", pausedFrom: pauseStartBoundary("2026-11-15"), pausedTo: pauseEndBoundary("2026-12-01") },
    });
    await generateChargesForPeriod(november.id);
    const charge = await db.charge.findFirst({ where: { billingPeriodId: november.id, studentId: student.id } });
    expectEqual(charge?.scheduledSessionCount, 8, "vẫn đủ 8 buổi của tháng 11");
  });

  // ---------------------------------------------------------------- 4
  await test("Học viên đang bảo lưu có ghi danh cũ đã xong: lấy đúng lớp đang bảo lưu", async () => {
    const picked = pickCurrentEnrollment([
      { id: "cu", status: "COMPLETED" },
      { id: "dang-bao-luu", status: "PAUSED" },
    ]);
    expectEqual(picked?.id, "dang-bao-luu", "ghi danh hiện tại");
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
