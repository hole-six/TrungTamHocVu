// Test tự động cho chuỗi GHI DANH → HỌC PHÍ THEO SỐ BUỔI RIÊNG → DANH SÁCH LỚP.
// Chạy: npm run test:enrollment
//
// Đây là quy tắc gốc chủ trung tâm chốt: lớp chỉ là cái mác để xếp thời khóa biểu, còn
// SỐ BUỔI là cam kết riêng của từng học viên, nên mỗi em một ngày kết thúc khác nhau.
// Bộ này kiểm đúng chuỗi đó có khớp nhau từ đầu tới cuối không.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, summary, vnd } from "./harness";

const UNIT = 200_000;

async function main() {
  prepareTestDatabase();

  const { PrismaClient } = await import("@prisma/client");
  const { generateCourseCharge } = await import("@/lib/server/billing-generation");
  const { getEnrollmentsForSession, countRosterOnDate } = await import("@/lib/server/class-roster");
  const { computeLearningSnapshot } = await import("@/lib/server/enrollment-learning");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  console.log("Chạy test ghi danh & danh sách lớp trên CSDL riêng (prisma/test.db):\n");

  // ---------------------------------------------------------------- 1
  // Hai em CÙNG MỘT LỚP nhưng mua số buổi khác nhau thì tiền phải khác nhau. Nếu học phí
  // bám theo số buổi của LỚP thì hai em sẽ ra cùng một số — đúng cái sai đã gỡ bỏ.
  await test("Cùng lớp, mua số buổi khác nhau thì học phí khác nhau", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT, totalSessions: 48 });
    const period = await fx.seedBillingPeriod(db, branch.id, "2026-03");

    const mua50 = await fx.seedStudent(db, branch.id, "Mua 50 buổi");
    const mua30 = await fx.seedStudent(db, branch.id, "Mua 30 buổi");
    const e50 = await fx.seedEnrollment(db, {
      studentId: mua50.id, classId: cls.id, billingModel: "COURSE",
      enrollDate: day("2026-03-02"), purchasedMainSessionCount: 50, unitPrice: UNIT,
    });
    const e30 = await fx.seedEnrollment(db, {
      studentId: mua30.id, classId: cls.id, billingModel: "COURSE",
      enrollDate: day("2026-03-02"), purchasedMainSessionCount: 30, unitPrice: UNIT,
    });

    await generateCourseCharge(e50.id, { billingPeriodId: period.id });
    await generateCourseCharge(e30.id, { billingPeriodId: period.id });

    const c50 = await db.charge.findFirst({ where: { enrollmentId: e50.id } });
    const c30 = await db.charge.findFirst({ where: { enrollmentId: e30.id } });
    expectEqual(c50?.tuitionAmount, 50 * UNIT, "học phí em mua 50 buổi " + vnd(50 * UNIT));
    expectEqual(c30?.tuitionAmount, 30 * UNIT, "học phí em mua 30 buổi " + vnd(30 * UNIT));
    expectEqual(c50?.sessionCount, 50, "số buổi trên phiếu em mua 50");
    expectEqual(c30?.sessionCount, 30, "số buổi trên phiếu em mua 30");
    // Lớp dự kiến 48 buổi — KHÔNG được dính vào số của ai cả.
    expectEqual(c50?.sessionCount === 48 || c30?.sessionCount === 48, false, "không em nào bị lấy số buổi của lớp");
  });

  // ---------------------------------------------------------------- 2
  // Mỗi em một ngày vào lớp khác nhau: danh sách của một buổi chỉ gồm những em đã vào
  // lớp tính tới ngày đó.
  await test("Vào lớp rải rác nhiều ngày: mỗi buổi chỉ gọi tên đúng người đã vào", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const som = await fx.seedStudent(db, branch.id, "Vào sớm");
    const giua = await fx.seedStudent(db, branch.id, "Vào giữa");
    const muon = await fx.seedStudent(db, branch.id, "Vào muộn");
    await fx.seedEnrollment(db, { studentId: som.id, classId: cls.id, billingModel: "COURSE", enrollDate: day("2026-04-01"), purchasedMainSessionCount: 20 });
    await fx.seedEnrollment(db, { studentId: giua.id, classId: cls.id, billingModel: "COURSE", enrollDate: day("2026-04-15"), purchasedMainSessionCount: 20 });
    await fx.seedEnrollment(db, { studentId: muon.id, classId: cls.id, billingModel: "COURSE", enrollDate: day("2026-05-01"), purchasedMainSessionCount: 20 });

    await db.$transaction(async (tx) => {
      const count = async (iso: string) =>
        (await getEnrollmentsForSession(tx, { classId: cls.id, sessionDate: day(iso) })).length;
      expectEqual(await count("2026-04-05"), 1, "buổi 5/4 — mới có em vào sớm");
      expectEqual(await count("2026-04-20"), 2, "buổi 20/4 — thêm em vào giữa");
      expectEqual(await count("2026-05-10"), 3, "buổi 10/5 — đủ cả ba");
    });
  });

  // ---------------------------------------------------------------- 3
  // Học viên mua 50 buổi ở lớp dự kiến 48 buổi: tiến độ phải đếm theo SỐ CỦA EM (50),
  // không phải số của lớp.
  await test("Tiến độ đếm theo số buổi em đã mua, không theo số buổi của lớp", async () => {
    const enrollment = {
      billingModel: "COURSE",
      purchasedMainSessionCount: 50,
      manualExtraSessionCount: 0,
      tuitionUnitPriceSnapshot: UNIT,
      paidCatchupSessionCount: 0,
      paidCatchupUnitPrice: null,
      transferredValueAmount: 0,
      usedSessionCount: 20,
      class: { totalSessions: 48, tuitionPerSession: UNIT, nextClassId: null, course: null, scheduleRules: [], branchId: "x" },
    };
    const snapshot = computeLearningSnapshot(enrollment as never, 20, []);
    expectEqual(snapshot.entitledMainSessions, 50, "mẫu số là số buổi em mua");
    expectEqual(snapshot.remainingMainSessions, 30, "còn lại 30 buổi");
  });

  // ---------------------------------------------------------------- 4
  // Câu hỏi thật: em ĐÃ HỌC HẾT số buổi đã mua thì buổi sau còn tên trong danh sách không?
  // Ghi lại hành vi hiện tại để không đổi ngầm — xem phần báo cáo kèm theo.
  await test("Đã học hết số buổi đã mua: vẫn còn tên cho tới khi rời lớp thật", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, "Học hết buổi");
    await fx.seedEnrollment(db, {
      studentId: student.id, classId: cls.id, billingModel: "COURSE",
      enrollDate: day("2026-04-01"), purchasedMainSessionCount: 5,
    });
    await db.enrollment.updateMany({ where: { studentId: student.id }, data: { usedSessionCount: 5 } });

    await db.$transaction(async (tx) => {
      const after = await getEnrollmentsForSession(tx, { classId: cls.id, sessionDate: day("2026-09-01") });
      // Danh sách lớp KHÔNG tự loại người học hết buổi — phải có thao tác rút/chuyển lớp
      // thật thì mới rời khỏi lớp. Đây là hành vi CÓ CHỦ Ý: lớp chạy chậm hơn kế hoạch,
      // học bù, cộng buổi linh động đều là chuyện thường, tự loại là đuổi nhầm người
      // vẫn đang đi học. Việc nhắc nhở nằm ở cảnh báo "cần chuyển lớp" trên trang lớp.
      expectEqual(after.length, 1, "vẫn còn tên trong danh sách buổi sau");
    });
  });

  // ---------------------------------------------------------------- 5
  // THỜI KHÓA BIỂU phải nói cùng một con số với danh sách điểm danh. Trước đây lịch đếm
  // toàn bộ học viên đang học của lớp rồi dán lên mọi buổi — buổi tháng 1 hiện sĩ số của
  // hôm nay. Đo trên dữ liệu thật: 33/304 buổi sai.
  await test("Sĩ số trên thời khóa biểu khớp đúng danh sách điểm danh của từng buổi", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const cu = await fx.seedStudent(db, branch.id, "Vào từ đầu");
    const moi = await fx.seedStudent(db, branch.id, "Mới vào");
    const nghi = await fx.seedStudent(db, branch.id, "Đang bảo lưu");
    await fx.seedEnrollment(db, { studentId: cu.id, classId: cls.id, billingModel: "COURSE", enrollDate: day("2026-01-05"), purchasedMainSessionCount: 20 });
    await fx.seedEnrollment(db, { studentId: moi.id, classId: cls.id, billingModel: "COURSE", enrollDate: day("2026-06-01"), purchasedMainSessionCount: 20 });
    await fx.seedEnrollment(db, {
      studentId: nghi.id, classId: cls.id, billingModel: "COURSE", enrollDate: day("2026-01-05"),
      purchasedMainSessionCount: 20, status: "PAUSED", pausedFrom: day("2026-05-01"),
    });

    const rows = await db.enrollment.findMany({
      where: { classId: cls.id },
      select: { id: true, studentId: true, status: true, enrollDate: true, endDate: true, billingModel: true, pausedFrom: true, pausedTo: true },
    });

    await db.$transaction(async (tx) => {
      for (const iso of ["2026-02-10", "2026-05-20", "2026-07-15"]) {
        const lich = countRosterOnDate(rows, day(iso));
        const diemDanh = (await getEnrollmentsForSession(tx, { classId: cls.id, sessionDate: day(iso) })).length;
        expectEqual(lich, diemDanh, `buổi ${iso}: lịch ${lich} vs điểm danh ${diemDanh}`);
      }
    });

    // Và đúng số thật, không chỉ khớp nhau một cách sai giống nhau.
    expectEqual(countRosterOnDate(rows, day("2026-02-10")), 2, "tháng 2: 2 em (em mới chưa vào)");
    expectEqual(countRosterOnDate(rows, day("2026-05-20")), 1, "tháng 5: 1 em (một em đang bảo lưu)");
    expectEqual(countRosterOnDate(rows, day("2026-07-15")), 2, "tháng 7: 2 em (em mới đã vào)");
  });

  const failed = summary();
  await db.$disconnect();
  await shared.$disconnect();
  dropTestDatabase();
  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  dropTestDatabase();
  process.exit(1);
});
