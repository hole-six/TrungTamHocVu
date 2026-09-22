// QUY TẮC XẾP TRÙNG KHUNG GIỜ của thời khóa biểu. Chạy: npm run test:overlap
//
// Chủ trung tâm chốt (9/2026): cùng một khung giờ (vd 17:30–19:00) thì 1 giáo viên / 1
// trợ giảng đứng 1 lớp là chuẩn. Xếp thêm LỚP THỨ HAI cùng giờ thì phải hỏi lại người
// xếp lịch — đồng ý mới xếp. Xếp LỚP THỨ BA cùng giờ thì KHÔNG cho, hỏi cũng không cho.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { findStaffConflicts, overlapDecision, MAX_CLASSES_PER_SLOT } = await import("@/lib/server/staff-schedule");
  const { planBulkAssignment } = await import("@/lib/server/bulk-staff-assignment");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  console.log("Chạy test quy tắc xếp trùng khung giờ (prisma/test.db):\n");

  const session = (classId: string, date: Date, startTime: string, endTime: string) =>
    db.classSession.create({ data: { classId, sessionDate: date, startTime, endTime, status: "PLANNED" } });
  const assign = (sessionId: string, employeeId: string, role = "TEACHER") =>
    db.sessionAssignment.create({ data: { sessionId, employeeId, role, hours: 1.5, hourlyRate: 200_000, amount: 300_000 } });

  await test("Khung giờ đang trống: xếp thẳng, không hỏi gì", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV rảnh" });
    const buoi = await session(cls.id, day("2026-10-05"), "17:30", "19:00");
    const conflicts = await findStaffConflicts(db, gv.id, [buoi]);
    expectEqual(overlapDecision(conflicts), "ok", "không trùng ai");
  });

  await test("Lớp thứ 2 cùng 17:30–19:00: phải HỎI LẠI, không tự chặn", async () => {
    const branch = await fx.seedBranch(db);
    const lopA = await fx.seedClass(db, branch.id);
    const lopB = await fx.seedClass(db, branch.id);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV 2 lớp" });
    const d = day("2026-10-06");
    const a = await session(lopA.id, d, "17:30", "19:00");
    const b = await session(lopB.id, d, "17:30", "19:00");
    await assign(a.id, gv.id);

    const conflicts = await findStaffConflicts(db, gv.id, [b]);
    expectEqual(conflicts.length, 1, "thấy đúng 1 lớp đang đứng");
    expectEqual(overlapDecision(conflicts), "confirm", "hỏi lại chứ không chặn");
  });

  await test("Lớp thứ 3 cùng khung giờ: CHẶN, đồng ý cũng không xếp", async () => {
    const branch = await fx.seedBranch(db);
    const [lopA, lopB, lopC] = await Promise.all([fx.seedClass(db, branch.id), fx.seedClass(db, branch.id), fx.seedClass(db, branch.id)]);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV 3 lớp" });
    const d = day("2026-10-07");
    const a = await session(lopA.id, d, "17:30", "19:00");
    const b = await session(lopB.id, d, "17:30", "19:00");
    const c = await session(lopC.id, d, "17:30", "19:00");
    await assign(a.id, gv.id);
    await assign(b.id, gv.id);

    const conflicts = await findStaffConflicts(db, gv.id, [c]);
    expectEqual(overlapDecision(conflicts), "block", `đã đủ ${MAX_CLASSES_PER_SLOT} lớp`);
  });

  await test("Giờ nối tiếp nhau (19:00 kết thúc, 19:00 bắt đầu) không tính là trùng", async () => {
    const branch = await fx.seedBranch(db);
    const lopA = await fx.seedClass(db, branch.id);
    const lopB = await fx.seedClass(db, branch.id);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV 2 ca liền" });
    const d = day("2026-10-08");
    const a = await session(lopA.id, d, "17:30", "19:00");
    const b = await session(lopB.id, d, "19:00", "20:30");
    await assign(a.id, gv.id);
    expectEqual(overlapDecision(await findStaffConflicts(db, gv.id, [b])), "ok", "ca liền kề vẫn xếp được");
  });

  await test("Xếp hàng loạt: chưa đồng ý thì bỏ qua lớp trùng, đồng ý thì gán", async () => {
    const branch = await fx.seedBranch(db);
    const lopA = await fx.seedClass(db, branch.id);
    const lopB = await fx.seedClass(db, branch.id);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV hàng loạt" });
    const d = day("2026-10-09");
    const a = await session(lopA.id, d, "17:30", "19:00");
    const b = await session(lopB.id, d, "17:30", "19:00");
    await assign(a.id, gv.id);

    const chuaDongY = await planBulkAssignment(db, { sessionIds: [b.id], teacherIds: [gv.id], mode: "FILL_EMPTY" });
    expectEqual(chuaDongY.items[0]?.action, "SKIP", "mặc định: bỏ qua lớp trùng");
    expectTrue(
      chuaDongY.items[0]?.skipped.some((item) => item.reason.includes("trùng giờ")) ?? false,
      "nói rõ lý do trùng giờ: " + JSON.stringify(chuaDongY.items[0]?.skipped),
    );

    const dongY = await planBulkAssignment(db, { sessionIds: [b.id], teacherIds: [gv.id], mode: "FILL_EMPTY", allowOverlap: true });
    expectEqual(dongY.items[0]?.action, "ASSIGN", "đồng ý xếp trùng: gán lớp thứ 2");
  });

  await test("Xếp hàng loạt: lớp thứ 3 vẫn bị chặn dù đã đồng ý xếp trùng", async () => {
    const branch = await fx.seedBranch(db);
    const [lopA, lopB, lopC] = await Promise.all([fx.seedClass(db, branch.id), fx.seedClass(db, branch.id), fx.seedClass(db, branch.id)]);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV bị chặn" });
    const d = day("2026-10-10");
    const a = await session(lopA.id, d, "17:30", "19:00");
    const b = await session(lopB.id, d, "17:30", "19:00");
    const c = await session(lopC.id, d, "17:30", "19:00");
    await assign(a.id, gv.id);
    await assign(b.id, gv.id);

    const plan = await planBulkAssignment(db, { sessionIds: [c.id], teacherIds: [gv.id], mode: "FILL_EMPTY", allowOverlap: true });
    expectEqual(plan.items[0]?.action, "SKIP", "lớp thứ 3: vẫn bỏ qua");
    expectTrue(
      plan.items[0]?.skipped.some((item) => item.reason.includes("không xếp thêm lớp thứ 3")) ?? false,
      "nói rõ đã đủ 2 lớp: " + JSON.stringify(plan.items[0]?.skipped),
    );
  });

  await test("Chọn cùng lúc 3 lớp trùng giờ trong một lần xếp: chỉ nhận 2, lớp thứ 3 bỏ qua", async () => {
    const branch = await fx.seedBranch(db);
    const [lopA, lopB, lopC] = await Promise.all([fx.seedClass(db, branch.id), fx.seedClass(db, branch.id), fx.seedClass(db, branch.id)]);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV chọn 3 lớp" });
    const d = day("2026-10-11");
    const a = await session(lopA.id, d, "17:30", "19:00");
    const b = await session(lopB.id, d, "17:30", "19:00");
    const c = await session(lopC.id, d, "17:30", "19:00");

    const plan = await planBulkAssignment(db, {
      sessionIds: [a.id, b.id, c.id],
      teacherIds: [gv.id],
      mode: "FILL_EMPTY",
      allowOverlap: true,
    });
    const actions = [a.id, b.id, c.id].map((id) => plan.items.find((item) => item.sessionId === id)?.action);
    expectEqual(actions.filter((action) => action === "ASSIGN").length, 2, "chỉ 2 lớp được gán");
    expectEqual(actions.filter((action) => action === "SKIP").length, 1, "lớp thứ 3 bị bỏ qua");
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
