// Test tự động: ĐỔI LỚP BỔ TRỢ ↔ LỚP THƯỜNG. Chạy: npm run test:remedial
//
// Lỗi gốc: route PATCH /api/classes/[id] không nhận cột isRemedial, nên tick nhầm "lớp
// bổ trợ" lúc tạo là vĩnh viễn không sửa lại được — phải xóa lớp làm lại từ đầu.
// Mở cho sửa thì phải có chốt, vì hai loại lớp tính tiền khác hẳn nhau:
//   - lớp bổ trợ: không thu học phí, buổi học trừ vào SessionCredit của học viên;
//   - lớp thường: thu học phí theo kỳ/khóa, buổi học trừ ví buổi học.
// Đổi bừa khi đã phát sinh dữ liệu là lệch tiền, nên bộ này khóa đúng các chốt đó.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  prepareTestDatabase();

  const { PrismaClient } = await import("@prisma/client");
  const { describeRemedialSwitchBlock, checkRemedialSwitch } = await import("@/lib/server/class-rules");
  const fixtures = await import("./fixtures");
  const { prisma: sharedClient } = await import("@/lib/prisma");

  const db = new PrismaClient();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  console.log("Chạy test đổi lớp bổ trợ ↔ lớp thường:\n");

  // ---------------------------------------------------------------- 1
  await test("Không đổi gì thì không bao giờ bị chặn", async () => {
    expectEqual(
      describeRemedialSwitchBlock({ from: true, to: true, consumedCreditCount: 9, chargeCount: 9 }),
      null,
      "giữ nguyên lớp bổ trợ",
    );
    expectEqual(
      describeRemedialSwitchBlock({ from: false, to: false, consumedCreditCount: 9, chargeCount: 9 }),
      null,
      "giữ nguyên lớp thường",
    );
  });

  // ---------------------------------------------------------------- 2
  // Lớp vừa tạo, chưa phát sinh gì — đây chính là ca tick nhầm cần sửa lại.
  await test("Lớp chưa phát sinh dữ liệu thì đổi qua lại thoải mái", async () => {
    expectEqual(
      describeRemedialSwitchBlock({ from: true, to: false, consumedCreditCount: 0, chargeCount: 0 }),
      null,
      "bổ trợ → thường",
    );
    expectEqual(
      describeRemedialSwitchBlock({ from: false, to: true, consumedCreditCount: 0, chargeCount: 0 }),
      null,
      "thường → bổ trợ",
    );
  });

  // ---------------------------------------------------------------- 3
  await test("Bổ trợ → thường bị chặn khi đã có buổi học bù dùng buổi dư", async () => {
    const reason = describeRemedialSwitchBlock({ from: true, to: false, consumedCreditCount: 3, chargeCount: 0 });
    expectTrue(reason !== null, "phải chặn");
    expectTrue(reason!.includes("3"), "nói rõ có 3 buổi đã dùng — nhận: " + reason);
  });

  // ---------------------------------------------------------------- 4
  await test("Thường → bổ trợ bị chặn khi lớp đã có phiếu học phí", async () => {
    const reason = describeRemedialSwitchBlock({ from: false, to: true, consumedCreditCount: 0, chargeCount: 2 });
    expectTrue(reason !== null, "phải chặn");
    expectTrue(reason!.includes("2"), "nói rõ có 2 phiếu thu — nhận: " + reason);
  });

  // ---------------------------------------------------------------- 5
  // Đếm đúng trên dữ liệu thật: chỉ tính buổi học bù THUỘC LỚP NÀY, buổi của lớp khác
  // không được tính vào (nếu không, lớp nào cũng bị chặn oan).
  await test("Đếm đúng số buổi bù của chính lớp này, không tính lớp khác", async () => {
    const branch = await fixtures.seedBranch(db);
    const lopBoTro = await fixtures.seedClass(db, branch.id);
    const lopKhac = await fixtures.seedClass(db, branch.id);
    await db.class.update({ where: { id: lopBoTro.id }, data: { isRemedial: true } });

    const student = await fixtures.seedStudent(db, branch.id, "HS bù");
    const enrollment = await fixtures.seedEnrollment(db, {
      studentId: student.id,
      classId: lopKhac.id,
      billingModel: "PERIOD",
      enrollDate: day("2026-09-01"),
    });

    const buoiBu = await fixtures.seedSession(db, lopBoTro.id, day("2026-10-05"), "COMPLETED");
    const buoiLopKhac = await fixtures.seedSession(db, lopKhac.id, day("2026-10-06"), "COMPLETED");
    const nguon1 = await fixtures.seedSession(db, lopKhac.id, day("2026-09-01"), "COMPLETED");
    const nguon2 = await fixtures.seedSession(db, lopKhac.id, day("2026-09-02"), "COMPLETED");

    await db.sessionCredit.create({
      data: { studentId: student.id, enrollmentId: enrollment.id, sourceSessionId: nguon1.id, status: "CONSUMED", consumedSessionId: buoiBu.id },
    });
    await db.sessionCredit.create({
      data: { studentId: student.id, enrollmentId: enrollment.id, sourceSessionId: nguon2.id, status: "CONSUMED", consumedSessionId: buoiLopKhac.id },
    });

    const chan = await checkRemedialSwitch(db, lopBoTro.id, false);
    expectTrue(chan !== null, "lớp bổ trợ có 1 buổi bù đã dùng → phải chặn");
    expectTrue(chan!.includes("1"), "đếm đúng 1 buổi, không phải 2 — nhận: " + chan);

    const khongChan = await checkRemedialSwitch(db, lopKhac.id, true);
    expectEqual(khongChan, null, "lớp kia chưa có học phí thì vẫn đổi được");
  });

  const failed = summary();
  await db.$disconnect();
  await sharedClient.$disconnect();
  dropTestDatabase();
  process.exit(failed ? 1 : 0);
}

main();
