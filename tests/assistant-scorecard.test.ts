// Test bảng điểm thưởng/phạt tháng lấy từ CSDL — gộp toàn bộ cơ sở. Chạy: npm run test:scorecard
//
// Yêu cầu của chủ trung tâm: cộng tất cả ca của một người ở MỌI cơ sở rồi mới xét thưởng
// phạt, không xét riêng từng cơ sở như trước.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { computeAssistantScorecard, computeMonthlyScoreboard } = await import("@/lib/server/assistant-score-rules");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const month = "2026-05";
  const day = (d: number) => new Date(`2026-05-${String(d).padStart(2, "0")}T00:00:00.000Z`);
  console.log("Chạy test thưởng phạt tháng (prisma/test.db):\n");

  async function taughtShift(classId: string, employeeId: string, d: number, role = "ASSISTANT") {
    const session = await fx.seedSession(db, classId, day(d), "COMPLETED");
    await fx.seedSessionAssignment(db, { sessionId: session.id, employeeId, role: role as "TEACHER" | "ASSISTANT", hours: 1.5, hourlyRate: 100_000 });
    return session;
  }

  await test("Tổng số ca cộng ở MỌI cơ sở, không xét riêng từng cơ sở", async () => {
    const branchA = await fx.seedBranch(db);
    const branchB = await fx.seedBranch(db);
    const classA = await fx.seedClass(db, branchA.id);
    const classB = await fx.seedClass(db, branchB.id);
    const tg = await fx.seedEmployee(db, branchA.id, { fullName: "TG 2 cơ sở" });
    for (let d = 1; d <= 12; d += 1) await taughtShift(classA.id, tg.id, d);
    for (let d = 13; d <= 20; d += 1) await taughtShift(classB.id, tg.id, d);

    const card = await computeAssistantScorecard(tg.id, month);
    expectEqual(card.countedShifts, 20, "12 ca cơ sở A + 8 ca cơ sở B = 20 ca");
    expectEqual(card.byBranch.length, 2, "vẫn xem được chi tiết theo cơ sở");
    expectEqual(card.suggestion.percent, 0.2, "không bị nhắc lần nào → +20% (trên 15 ca nên không bị trần)");
  });

  await test("Ca dạy lớp bổ trợ VẪN tính, chỉ ca dạy thay không tính", async () => {
    const branch = await fx.seedBranch(db);
    const normal = await fx.seedClass(db, branch.id);
    const remedial = await fx.seedClass(db, branch.id);
    await db.class.update({ where: { id: remedial.id }, data: { isRemedial: true } });
    const tg = await fx.seedEmployee(db, branch.id, { fullName: "TG bổ trợ" });
    for (let d = 1; d <= 6; d += 1) await taughtShift(normal.id, tg.id, d);
    await taughtShift(remedial.id, tg.id, 7);
    const session = await fx.seedSession(db, normal.id, day(8), "COMPLETED");
    await db.sessionAssignment.create({
      data: { sessionId: session.id, employeeId: tg.id, role: "ASSISTANT", isSubstituteShift: true, hours: 1.5, hourlyRate: 100_000, amount: 150_000 },
    });

    const card = await computeAssistantScorecard(tg.id, month);
    expectEqual(card.totalShifts, 8, "8 ca có mặt");
    expectEqual(card.countedShifts, 7, "6 ca lớp thường + 1 ca lớp bổ trợ đều là ca dạy");
    expectEqual(card.coverShifts, 1, "chỉ trừ 1 ca dạy thay");
  });

  await test("Số lần bị nhắc cộng ở mọi cơ sở và ra đúng mức theo quy chế", async () => {
    const branchA = await fx.seedBranch(db);
    const branchB = await fx.seedBranch(db);
    const classA = await fx.seedClass(db, branchA.id);
    const tg = await fx.seedEmployee(db, branchA.id, { fullName: "TG bị nhắc" });
    for (let d = 1; d <= 20; d += 1) await taughtShift(classA.id, tg.id, d);
    // 1 lần nhắc ở cơ sở A, 1 lần ở cơ sở B → A = 2/20 = 10% → −5%
    await db.assistantScoreEvent.create({ data: { employeeId: tg.id, branchId: branchA.id, eventDate: day(3), type: "DEDUCT", points: 1, reason: "Đi muộn" } });
    await db.assistantScoreEvent.create({ data: { employeeId: tg.id, branchId: branchB.id, eventDate: day(9), type: "DEDUCT", points: 2, reason: "Nghỉ họp" } });

    const card = await computeAssistantScorecard(tg.id, month);
    expectEqual(card.reminderCount, 2, "2 lần bị nhắc (không phải 3 điểm trừ)");
    expectEqual(card.totalDeducted, 3, "tổng điểm trừ vẫn là 3");
    expectEqual(card.ratio, 10, "A = 2/20 = 10%");
    expectEqual(card.suggestion.percent, -0.05, "A ≥ 10 → −5%");
  });

  await test("Bị nhắc ở cả 3 báo cáo → đề xuất −10% dù tỉ lệ A thấp", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const tg = await fx.seedEmployee(db, branch.id, { fullName: "TG 3 báo cáo" });
    for (let d = 1; d <= 20; d += 1) await taughtShift(cls.id, tg.id, d);
    await db.assistantScoreEvent.create({
      data: { employeeId: tg.id, branchId: branch.id, eventDate: day(5), type: "DEDUCT", points: 1, reason: "Truy thu muộn", tripleReported: true },
    });

    const card = await computeAssistantScorecard(tg.id, month);
    expectTrue(card.tripleReported, "có nội dung bị nhắc cả 3 báo cáo");
    expectEqual(card.suggestion.percent, -0.1, "mặc định −10%");
  });

  await test("Điểm cộng tự động theo mốc số ca và số ca dạy thay", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const tg = await fx.seedEmployee(db, branch.id, { fullName: "TG nhiều ca" });
    for (let d = 1; d <= 23; d += 1) await taughtShift(cls.id, tg.id, d);

    const card = await computeAssistantScorecard(tg.id, month);
    expectEqual(card.countedShifts, 23, "23 ca");
    expectEqual(card.autoPoints.shiftTier, 1, "22–26 ca → +1 điểm");
    expectEqual(card.autoPoints.cover, 0, "chưa dạy thay ca nào");
  });

  await test("Bảng điểm cả cơ sở: mức đã chốt đọc từ bảng gộp toàn hệ thống", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const tg = await fx.seedEmployee(db, branch.id, { fullName: "TG đã chốt" });
    for (let d = 1; d <= 16; d += 1) await taughtShift(cls.id, tg.id, d);
    await db.employeeMonthlyRating.create({ data: { employeeId: tg.id, month, bonusPercent: 0.1 } });

    const board = await computeMonthlyScoreboard({ branchId: branch.id, month });
    const row = board.rows.find((item) => item.employeeId === tg.id)!;
    expectEqual(row.countedShifts, 16, "16 ca");
    expectEqual(row.suggestedPercent, 0.2, "đề xuất +20%");
    expectEqual(row.bonusPercent, 0.1, "mức đã chốt +10% được giữ nguyên");
  });

  await test("Dưới 5 ca: hệ thống để \"chưa xét\" nhưng admin vẫn chốt được mức", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const tg = await fx.seedEmployee(db, branch.id, { fullName: "TG ít ca" });
    for (let d = 1; d <= 4; d += 1) await taughtShift(cls.id, tg.id, d);

    const card = await computeAssistantScorecard(tg.id, month);
    expectEqual(card.countedShifts, 4, "4 ca");
    expectEqual(card.suggestion.percent, null, "quy chế chưa quy định → không đề xuất");
    // Không chặn: người duyệt lương vẫn chốt tay được mức của tháng đó.
    await db.employeeMonthlyRating.create({ data: { employeeId: tg.id, month, bonusPercent: 0.1 } });
    const board = await computeMonthlyScoreboard({ branchId: branch.id, month });
    const row = board.rows.find((item) => item.employeeId === tg.id)!;
    expectEqual(row.suggestedPercent, null, "vẫn hiện chưa xét");
    expectEqual(row.bonusPercent, 0.1, "mức admin chốt tay được giữ");
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
