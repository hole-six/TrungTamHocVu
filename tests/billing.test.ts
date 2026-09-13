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
  const { generateChargesForPeriod, generatePeriodChargesForNewEnrollment } = await import("@/lib/server/billing-generation");
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

  // ---------------------------------------------------------------- 3
  // "Sinh học phí" được phép bấm lại khi kỳ còn GENERATED, và server tự chạy lại đợt thu
  // mỗi lần khởi động (deploy). Nếu giữa tháng đã dạy vài buổi (ví đã bị trừ) mà phiếu
  // chưa thu tiền, sinh lại phiếu KHÔNG được đội số buổi lên: những buổi đã trừ ví đó
  // chính là buổi của tháng này, đã nằm sẵn trong "tổng buổi tháng này" rồi.
  await test("Sinh lại phiếu giữa tháng: buổi đã dạy không bị tính 2 lần", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, "Chưa đóng tiền");
    await fx.seedEnrollment(db, {
      studentId: student.id,
      classId: cls.id,
      billingModel: "PERIOD",
      enrollDate: day("2026-09-01"),
    });
    const sessions = [];
    for (const d of ["02", "05", "09", "12", "16", "19", "23", "26"]) {
      sessions.push(await fx.seedSession(db, cls.id, day(`2026-09-${d}`), "PLANNED"));
    }
    const september = await fx.seedBillingPeriod(db, branch.id, "2026-09");
    await generateChargesForPeriod(september.id);
    const first = await db.charge.findFirst({ where: { billingPeriodId: september.id, studentId: student.id } });
    expectEqual(first?.sessionCount, 8, "lần sinh đầu: 8 buổi");

    // Dạy xong 2 buổi đầu, phụ huynh chưa đóng → ví âm 2.
    for (const s of sessions.slice(0, 2)) {
      await db.classSession.update({ where: { id: s.id }, data: { status: "COMPLETED" } });
      await db.$transaction(async (tx) => debitWalletsForCompletedSession(tx, s.id));
    }

    await generateChargesForPeriod(september.id);
    const regenerated = await db.charge.findFirst({ where: { billingPeriodId: september.id, studentId: student.id } });
    expectEqual(regenerated?.sessionCount, 8, "sinh lại: vẫn 8 buổi, không thành 10");
    expectEqual(regenerated?.carriedSessionCount, 0, "buổi dư mang sang vẫn là 0");
    expectEqual(regenerated?.tuitionAmount, 8 * UNIT, "học phí vẫn " + vnd(8 * UNIT));
  });

  // ---------------------------------------------------------------- 4
  // Ghi danh theo tháng giữa tháng phải có phiếu NGAY cho phần còn lại của tháng đó —
  // đợt thu tự động chỉ chạy ngày 1, nên trước đây em vào 15/9 học trọn nửa tháng mà
  // không có phiếu nào, ví âm dần. Và việc sinh phiếu cho 1 em KHÔNG được đụng vào phiếu
  // của học viên khác trong cùng kỳ, cũng không được đổi trạng thái cả kỳ.
  await test("Ghi danh theo tháng: sinh phiếu tháng hiện tại ngay, chỉ cho đúng em đó", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const other = await fx.seedStudent(db, branch.id, "Học viên cũ trong lớp");
    await fx.seedEnrollment(db, { studentId: other.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-09-01") });
    for (const d of ["02", "05", "09", "12", "16", "19", "23", "26"]) {
      await fx.seedSession(db, cls.id, day(`2026-09-${d}`), "PLANNED");
    }
    const september = await db.billingPeriod.create({
      data: { branchId: branch.id, periodName: "2026-09", startDate: day("2026-09-01"), endDate: new Date("2026-09-30T23:59:59.999Z"), status: "DRAFT" },
    });

    const student = await fx.seedStudent(db, branch.id, "Vào lớp 15/9");
    const enrollment = await fx.seedEnrollment(db, { studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-09-15") });
    const result = await generatePeriodChargesForNewEnrollment(enrollment.id, day("2026-09-15"));
    expectEqual(result.warnings.length, 0, "không có cảnh báo");

    const charge = await db.charge.findFirst({ where: { billingPeriodId: september.id, studentId: student.id } });
    expectEqual(charge?.scheduledSessionCount, 4, "chỉ 4 buổi từ 15/9");
    expectEqual(charge?.tuitionAmount, 4 * UNIT, "học phí " + vnd(4 * UNIT));
    const otherCharges = await db.charge.count({ where: { studentId: other.id } });
    expectEqual(otherCharges, 0, "không sinh phiếu cho học viên khác");
    const periodAfter = await db.billingPeriod.findUnique({ where: { id: september.id } });
    expectEqual(periodAfter?.status, "DRAFT", "không đổi trạng thái cả kỳ");
  });

  // ---------------------------------------------------------------- 5
  // Nợ cũ chỉ được mang vào ĐÚNG MỘT phiếu mỗi kỳ. Học viên đã có phiếu tháng này ở lớp A
  // (phiếu đó đã gánh nợ đầu kỳ), giờ ghi danh thêm lớp B — phiếu lớp B không được mang
  // nợ cũ lần nữa, nếu không phụ huynh bị đòi nợ cũ 2 lần.
  await test("Ghi danh thêm lớp giữa tháng: nợ cũ không bị cộng vào phiếu lần 2", async () => {
    const branch = await fx.seedBranch(db);
    const classA = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const classB = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, "Học 2 lớp");
    await fx.seedEnrollment(db, { studentId: student.id, classId: classA.id, billingModel: "PERIOD", enrollDate: day("2026-08-01") });

    // Tháng 8 còn nợ nguyên 1 phiếu chưa đóng.
    const august = await fx.seedBillingPeriod(db, branch.id, "2026-08");
    await fx.seedCharge(db, { studentId: student.id, classId: classA.id, billingPeriodId: august.id, tuitionAmount: 4 * UNIT, unitPrice: UNIT });

    for (const d of ["02", "09", "16", "23"]) {
      await fx.seedSession(db, classA.id, day(`2026-09-${d}`), "PLANNED");
      await fx.seedSession(db, classB.id, day(`2026-09-${d}`), "PLANNED");
    }
    const september = await fx.seedBillingPeriod(db, branch.id, "2026-09");
    await generateChargesForPeriod(september.id);
    const chargeA = await db.charge.findFirst({ where: { billingPeriodId: september.id, classId: classA.id } });
    expectEqual(chargeA?.openingBalance, 4 * UNIT, "phiếu lớp A gánh nợ cũ tháng 8");

    const enrollmentB = await fx.seedEnrollment(db, { studentId: student.id, classId: classB.id, billingModel: "PERIOD", enrollDate: day("2026-09-10") });
    await generatePeriodChargesForNewEnrollment(enrollmentB.id, day("2026-09-10"));
    const chargeB = await db.charge.findFirst({ where: { billingPeriodId: september.id, classId: classB.id } });
    expectEqual(chargeB?.tuitionAmount, 2 * UNIT, "lớp B thu 2 buổi từ 10/9");
    expectEqual(chargeB?.openingBalance, 0, "lớp B không mang nợ cũ lần 2");
  });

  // ---------------------------------------------------------------- 6
  // Phiếu tháng đã thu đủ rồi, lớp mới xếp thêm buổi trong CHÍNH tháng đó (lớp kéo dài,
  // dạy bù, lịch sinh thêm). Trước đây đợt thu bỏ qua mọi phiếu đã thu → mấy buổi thêm
  // đó không bao giờ nằm trên phiếu nào: ví về 0 rồi âm mà màn hình vẫn "Không nợ".
  // Phiếu phải tự CỘNG THÊM đúng số buổi mới (không bao giờ giảm số đã thu), và chạy lại
  // nhiều lần không cộng thêm lần nữa.
  await test("Lớp xếp thêm buổi sau khi đã thu phiếu tháng: tự cộng thêm đúng số buổi mới", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, "Đã đóng đủ tháng");
    const enrollment = await fx.seedEnrollment(db, { studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-09-01") });
    for (const d of ["02", "05", "09", "12"]) {
      await fx.seedSession(db, cls.id, day(`2026-09-${d}`), "PLANNED");
    }
    const september = await fx.seedBillingPeriod(db, branch.id, "2026-09");
    await generateChargesForPeriod(september.id);
    const charge = await db.charge.findFirstOrThrow({ where: { billingPeriodId: september.id, studentId: student.id } });
    expectEqual(charge.sessionCount, 4, "phiếu đầu: 4 buổi");

    const payment = await fx.seedPayment(db, { studentId: student.id, amount: 4 * UNIT, paidDate: day("2026-09-02") });
    await db.paymentAllocation.create({ data: { paymentId: payment.id, chargeId: charge.id, amount: 4 * UNIT } });
    await db.$transaction(async (tx) =>
      topUpWalletFromPayment(tx, { enrollmentId: enrollment.id, paymentId: payment.id, amountVnd: 4 * UNIT, unitPrice: UNIT }),
    );

    // Lớp xếp thêm 3 buổi cuối tháng.
    for (const d of ["16", "19", "23"]) {
      await fx.seedSession(db, cls.id, day(`2026-09-${d}`), "PLANNED");
    }
    await generateChargesForPeriod(september.id);
    await generateChargesForPeriod(september.id);

    const after = await db.charge.findUniqueOrThrow({ where: { id: charge.id }, include: { allocations: true } });
    expectEqual(after.sessionCount, 7, "cộng thêm 3 buổi, chạy 2 lần vẫn là 7");
    expectEqual(after.scheduledSessionCount, 7, "tổng buổi tháng in trên phiếu");
    expectEqual(after.tuitionAmount, 7 * UNIT, "học phí " + vnd(7 * UNIT));
    const paid = after.allocations.reduce((sum, item) => sum + item.amount, 0);
    expectEqual(after.tuitionAmount + after.materialsAmount - paid, 3 * UNIT, "còn phải thu đúng 3 buổi thêm");
  });

  // ---------------------------------------------------------------- 7
  // Phiếu đã thu mà lớp HỦY bớt buổi: không được trừ lùi số đã thu (buổi dư nằm lại
  // trong ví, tháng sau tự trừ) — và phiếu có số liệu không khớp công thức (dữ liệu cũ,
  // sửa tay) thì không tự đụng vào.
  await test("Phiếu đã thu: lớp hủy buổi không trừ lùi, phiếu cũ sửa tay không bị đụng", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id, { tuitionPerSession: UNIT });
    const student = await fx.seedStudent(db, branch.id, "Lớp hủy buổi");
    await fx.seedEnrollment(db, { studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-09-01") });
    const sessions = [];
    for (const d of ["02", "05", "09", "12"]) {
      sessions.push(await fx.seedSession(db, cls.id, day(`2026-09-${d}`), "PLANNED"));
    }
    const september = await fx.seedBillingPeriod(db, branch.id, "2026-09");
    await generateChargesForPeriod(september.id);
    const charge = await db.charge.findFirstOrThrow({ where: { billingPeriodId: september.id, studentId: student.id } });
    const payment = await fx.seedPayment(db, { studentId: student.id, amount: 4 * UNIT, paidDate: day("2026-09-02") });
    await db.paymentAllocation.create({ data: { paymentId: payment.id, chargeId: charge.id, amount: 4 * UNIT } });

    await db.classSession.update({ where: { id: sessions[3].id }, data: { status: "CANCELLED" } });
    await generateChargesForPeriod(september.id);
    const afterCancel = await db.charge.findUniqueOrThrow({ where: { id: charge.id } });
    expectEqual(afterCancel.sessionCount, 4, "vẫn 4 buổi đã thu");

    // Phiếu dữ liệu cũ: chưa lưu tổng buổi (0) — không suy ra được đã tính gì, bỏ qua.
    await db.charge.update({ where: { id: charge.id }, data: { scheduledSessionCount: 0 } });
    for (const d of ["16", "19"]) {
      await fx.seedSession(db, cls.id, day(`2026-09-${d}`), "PLANNED");
    }
    await generateChargesForPeriod(september.id);
    const legacy = await db.charge.findUniqueOrThrow({ where: { id: charge.id } });
    expectEqual(legacy.sessionCount, 4, "phiếu không khớp công thức: giữ nguyên");
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
