// Test tự động cho PHÂN CÔNG GV/TG theo buổi. Chạy: npm run test:staff
//
// Khóa lại 2 lỗi thật đã sửa:
//   1. Nhân sự mặc định lưu qua form lớp (TEACHER_1/ASSISTANT_1) sinh buổi với vai trò lạ →
//      giáo viên bị chốt nhầm đơn giá trợ giảng và KHÔNG có dòng lương nào.
//   2. Đổi giáo viên mặc định giữa khóa thì buổi chưa dạy vẫn giữ người cũ → người mới dạy,
//      lương tính cho người cũ.
// Và quy tắc chặn trùng lịch: một người không đứng 2 lớp chồng giờ trong cùng ngày.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { createSessionsInRange } = await import("@/lib/server/class-generation");
  const { saveDefaultStaff, planDefaultStaffSync } = await import("@/lib/server/class-default-assignments");
  const { findStaffConflicts, timeRangesOverlap } = await import("@/lib/server/staff-schedule");
  const { toSessionRole, hourlyRateForRole, isEmployeeWorkingOn } = await import("@/lib/assignment-roles");
  const { generatePayrollForRun } = await import("@/lib/server/payroll-generation");
  const { getVietnamToday } = await import("@/lib/server/class-rules");
  const { planBulkAssignment, applyBulkAssignment } = await import("@/lib/server/bulk-staff-assignment");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  const today = getVietnamToday();
  const plusDays = (n: number) => new Date(today.getTime() + n * 86_400_000);
  console.log("Chạy test phân công GV/TG trên CSDL riêng (prisma/test.db):\n");

  const session = (classId: string, date: Date, startTime: string, endTime: string, status = "PLANNED") =>
    db.classSession.create({ data: { classId, sessionDate: date, startTime, endTime, status } });
  const assign = (sessionId: string, employeeId: string, role: string, rate = 200_000) =>
    db.sessionAssignment.create({ data: { sessionId, employeeId, role, hours: 1.5, hourlyRate: rate, amount: 1.5 * rate } });

  // ---------------------------------------------------------------- 1
  await test("Vai trò trên buổi luôn là TEACHER/ASSISTANT, đơn giá đúng theo vai trò", async () => {
    expectEqual(toSessionRole("TEACHER_1"), "TEACHER", "TEACHER_1");
    expectEqual(toSessionRole("TEACHER_2"), "TEACHER", "TEACHER_2");
    expectEqual(toSessionRole("ASSISTANT_1"), "ASSISTANT", "ASSISTANT_1");
    expectEqual(toSessionRole("ASSISTANT2"), "ASSISTANT2", "ASSISTANT2");
    const emp = { teachingHourlyRate: 200_000, assistantHourlyRate: 50_000 };
    expectEqual(hourlyRateForRole("TEACHER_1", emp), 200_000, "giáo viên 1 lấy đơn giá dạy");
    expectEqual(hourlyRateForRole("ASSISTANT2", emp), 50_000, "trợ giảng 2 lấy đơn giá trợ giảng");
  });

  // ---------------------------------------------------------------- 2
  await test("LỖI 1: nhân sự mặc định TEACHER_1/ASSISTANT_1 → buổi sinh ra tính lương đúng", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV", teachingHourlyRate: 200_000, assistantHourlyRate: 50_000 });
    const tg = await fx.seedEmployee(db, branch.id, { fullName: "TG", teachingHourlyRate: 150_000, assistantHourlyRate: 80_000 });
    await db.scheduleRule.create({ data: { classId: cls.id, weekday: 1, startTime: "17:30", endTime: "19:00" } });
    await db.classDefaultAssignment.create({ data: { classId: cls.id, employeeId: gv.id, role: "TEACHER_1" } });
    await db.classDefaultAssignment.create({ data: { classId: cls.id, employeeId: tg.id, role: "ASSISTANT_1" } });
    await createSessionsInRange(cls.id, day("2026-05-01"), day("2026-05-31"));

    const rows = await db.sessionAssignment.findMany({ where: { session: { classId: cls.id } } });
    expectTrue(rows.every((r) => r.role === "TEACHER" || r.role === "ASSISTANT"), "không còn vai trò TEACHER_1 trên buổi");
    expectEqual(rows.find((r) => r.employeeId === gv.id)?.hourlyRate, 200_000, "GV chốt đơn giá dạy");

    await db.classSession.updateMany({ where: { classId: cls.id }, data: { status: "COMPLETED" } });
    const sessions = await db.classSession.count({ where: { classId: cls.id } });
    const run = await fx.seedPayrollRun(db, branch.id, "2026-05");
    await generatePayrollForRun(run.id);
    const lgv = await db.payrollLine.findFirst({ where: { payrollRunId: run.id, employeeId: gv.id } });
    const ltg = await db.payrollLine.findFirst({ where: { payrollRunId: run.id, employeeId: tg.id } });
    expectEqual(lgv?.teachingAmount, sessions * 1.5 * 200_000, "lương dạy GV");
    expectEqual(ltg?.assistantAmount, sessions * 1.5 * 80_000, "lương trợ giảng TG");
  });

  // ---------------------------------------------------------------- 3
  await test("Trùng lịch: cùng bắt đầu 07:00 hoặc chồng giờ là trùng; nối tiếp nhau thì không", async () => {
    expectTrue(timeRangesOverlap("07:00", "08:30", "07:00", "08:30"), "cùng 07:00–08:30");
    expectTrue(timeRangesOverlap("07:00", "08:30", "07:00", "09:00"), "cùng bắt đầu 07:00");
    expectTrue(timeRangesOverlap("07:00", "08:30", "08:00", "09:30"), "chồng 30 phút");
    expectEqual(timeRangesOverlap("07:00", "08:30", "08:30", "10:00"), false, "08:30 kết thúc, 08:30 bắt đầu");
  });

  // ---------------------------------------------------------------- 4
  await test("Tìm trùng lịch ở lớp khác; bỏ qua buổi đã hủy và buổi đã có người dạy thay", async () => {
    const branch = await fx.seedBranch(db);
    const lopA = await fx.seedClass(db, branch.id);
    const lopB = await fx.seedClass(db, branch.id);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV bận" });
    const other = await fx.seedEmployee(db, branch.id, { fullName: "GV thay" });
    const d = day("2026-06-10");
    const busy = await session(lopA.id, d, "07:00", "08:30");
    await assign(busy.id, gv.id, "TEACHER");
    const cancelled = await session(lopA.id, d, "09:00", "10:30", "CANCELLED");
    await assign(cancelled.id, gv.id, "TEACHER");
    const covered = await session(lopA.id, d, "14:00", "15:30");
    const original = await assign(covered.id, gv.id, "TEACHER");
    await db.sessionAssignment.create({ data: { sessionId: covered.id, employeeId: other.id, role: "TEACHER", substituteForId: original.id, hours: 1.5, hourlyRate: 1, amount: 1 } });

    const target = await session(lopB.id, d, "07:00", "08:30");
    expectEqual((await findStaffConflicts(db, gv.id, [target])).length, 1, "trùng buổi 07:00 lớp A");
    const at9 = await session(lopB.id, d, "09:00", "10:30");
    expectEqual((await findStaffConflicts(db, gv.id, [at9])).length, 0, "buổi 09:00 lớp A đã hủy → rảnh");
    const at14 = await session(lopB.id, d, "14:00", "15:30");
    expectEqual((await findStaffConflicts(db, gv.id, [at14])).length, 0, "buổi 14:00 đã có người dạy thay → rảnh");
    expectEqual((await findStaffConflicts(db, other.id, [at14])).length, 1, "người dạy thay thì bận lúc 14:00");
  });

  // ---------------------------------------------------------------- 4b
  await test("Không tính trùng lịch với CHÍNH buổi đang xét (TG của buổi dạy thay GV buổi đó)", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const tg = await fx.seedEmployee(db, branch.id, { fullName: "TG trong buổi" });
    const s = await session(cls.id, day("2026-06-12"), "07:00", "08:30");
    await assign(s.id, tg.id, "ASSISTANT");
    expectEqual((await findStaffConflicts(db, tg.id, [s])).length, 0, "truyền bản ghi buổi (id) — không trùng với chính nó");
    expectEqual((await findStaffConflicts(db, tg.id, [{ sessionId: s.id, sessionDate: s.sessionDate, startTime: "07:00", endTime: "08:30" }])).length, 0, "truyền sessionId");
  });

  // ---------------------------------------------------------------- 5
  await test("Sinh lịch tự động: GV mặc định đã kẹt lớp khác cùng giờ thì để trống, không xếp chồng", async () => {
    const branch = await fx.seedBranch(db);
    const lopA = await fx.seedClass(db, branch.id);
    const lopB = await fx.seedClass(db, branch.id);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV 2 lớp", teachingHourlyRate: 200_000 });
    const busy = await session(lopA.id, day("2026-07-06"), "17:30", "19:00"); // thứ Hai
    await assign(busy.id, gv.id, "TEACHER");
    await db.scheduleRule.create({ data: { classId: lopB.id, weekday: 1, startTime: "17:30", endTime: "19:00" } });
    await db.classDefaultAssignment.create({ data: { classId: lopB.id, employeeId: gv.id, role: "TEACHER_1" } });
    const result = await createSessionsInRange(lopB.id, day("2026-07-06"), day("2026-07-13"));
    const sessionsB = await db.classSession.findMany({ where: { classId: lopB.id }, include: { assignments: true }, orderBy: { sessionDate: "asc" } });
    expectEqual(sessionsB.length, 2, "sinh 2 buổi thứ Hai");
    expectEqual(sessionsB[0].assignments.length, 0, "06/07 trùng lớp A → để trống");
    expectEqual(sessionsB[1].assignments.length, 1, "13/07 rảnh → có GV");
    expectEqual(result.staffSkipped, 1, "báo 1 chỗ bỏ trống");
  });

  // ---------------------------------------------------------------- 6
  await test("LỖI 2: đổi GV mặc định A→B → chỉ đổi buổi chưa dạy đang có A", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const a = await fx.seedEmployee(db, branch.id, { fullName: "GV A", teachingHourlyRate: 200_000 });
    const b = await fx.seedEmployee(db, branch.id, { fullName: "GV B", teachingHourlyRate: 250_000 });
    const z = await fx.seedEmployee(db, branch.id, { fullName: "GV Z (riêng 1 buổi)", teachingHourlyRate: 200_000 });
    await db.classDefaultAssignment.create({ data: { classId: cls.id, employeeId: a.id, role: "TEACHER_1" } });

    const taught = await session(cls.id, plusDays(-7), "17:30", "19:00", "COMPLETED");
    const pastUnmarked = await session(cls.id, plusDays(-2), "17:30", "19:00", "PLANNED");
    const next1 = await session(cls.id, plusDays(2), "17:30", "19:00");
    const next2 = await session(cls.id, plusDays(5), "17:30", "19:00");
    const custom = await session(cls.id, plusDays(9), "17:30", "19:00");
    const checkedIn = await session(cls.id, plusDays(0), "17:30", "19:00");
    for (const s of [taught, pastUnmarked, next1, next2, checkedIn]) await assign(s.id, a.id, "TEACHER");
    await assign(custom.id, z.id, "TEACHER");
    await db.sessionAssignment.updateMany({ where: { sessionId: checkedIn.id }, data: { checkInAt: new Date() } });

    const plan = await planDefaultStaffSync(db, cls.id, [{ role: "TEACHER_1", employeeId: b.id }]);
    expectEqual(plan.changes[0]?.sessionCount, 2, "xem trước: đổi 2 buổi");
    expectEqual(plan.changes[0]?.keptLocked, 1, "xem trước: giữ 1 buổi đã check-in");

    const saved = await db.$transaction((tx) => saveDefaultStaff(tx, cls.id, [{ role: "TEACHER_1", employeeId: b.id }]));
    expectTrue(saved.ok, "lưu được");
    const who = async (sessionId: string) =>
      (await db.sessionAssignment.findMany({ where: { sessionId }, include: { employee: true } })).map((x) => x.employee.fullName).join(",");
    expectEqual(await who(taught.id), "GV A", "buổi đã dạy giữ GV A");
    expectEqual(await who(pastUnmarked.id), "GV A", "buổi ngày đã qua (chưa bấm hoàn thành) giữ GV A");
    expectEqual(await who(next1.id), "GV B", "buổi chưa dạy 1 → GV B");
    expectEqual(await who(next2.id), "GV B", "buổi chưa dạy 2 → GV B");
    expectEqual(await who(custom.id), "GV Z (riêng 1 buổi)", "buổi phân công riêng giữ nguyên, không nhét thêm B");
    expectEqual(await who(checkedIn.id), "GV A", "buổi GV A đã check-in giữ nguyên");
    const bRow = await db.sessionAssignment.findFirst({ where: { sessionId: next1.id } });
    expectEqual(bRow?.hourlyRate, 250_000, "GV B chốt đơn giá của chính B");
    const def = await db.classDefaultAssignment.findFirst({ where: { classId: cls.id, isActive: true } });
    expectEqual(def?.employeeId, b.id, "nhân sự mặc định là GV B");
  });

  // ---------------------------------------------------------------- 7
  await test("Đổi sang người đang kẹt lớp khác cùng giờ → chặn, không lưu gì", async () => {
    const branch = await fx.seedBranch(db);
    const lopA = await fx.seedClass(db, branch.id);
    const lopB = await fx.seedClass(db, branch.id);
    const a = await fx.seedEmployee(db, branch.id, { fullName: "GV A" });
    const b = await fx.seedEmployee(db, branch.id, { fullName: "GV B bận" });
    await db.classDefaultAssignment.create({ data: { classId: lopA.id, employeeId: a.id, role: "TEACHER_1" } });
    const s = await session(lopA.id, plusDays(3), "07:00", "08:30");
    await assign(s.id, a.id, "TEACHER");
    const busy = await session(lopB.id, plusDays(3), "07:00", "08:30");
    await assign(busy.id, b.id, "TEACHER");

    const saved = await db.$transaction((tx) => saveDefaultStaff(tx, lopA.id, [{ role: "TEACHER_1", employeeId: b.id }]));
    expectEqual(saved.ok, false, "bị chặn");
    expectTrue(saved.plan.errors[0]?.includes("trùng lịch") ?? false, "báo lý do trùng lịch: " + saved.plan.errors[0]);
    const still = await db.sessionAssignment.findFirst({ where: { sessionId: s.id } });
    expectEqual(still?.employeeId, a.id, "buổi vẫn là GV A");
    const def = await db.classDefaultAssignment.findFirst({ where: { classId: lopA.id, isActive: true } });
    expectEqual(def?.employeeId, a.id, "nhân sự mặc định chưa đổi");
  });

  // ---------------------------------------------------------------- 8
  await test("Thêm trợ giảng / bỏ trợ giảng khỏi lớp → cập nhật đúng các buổi chưa dạy", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const gv = await fx.seedEmployee(db, branch.id, { fullName: "GV" });
    const tg = await fx.seedEmployee(db, branch.id, { fullName: "TG mới", assistantHourlyRate: 80_000 });
    await db.classDefaultAssignment.create({ data: { classId: cls.id, employeeId: gv.id, role: "TEACHER_1" } });
    const taught = await session(cls.id, plusDays(-3), "17:30", "19:00", "COMPLETED");
    const upcoming = await session(cls.id, plusDays(3), "17:30", "19:00");
    for (const s of [taught, upcoming]) await assign(s.id, gv.id, "TEACHER");

    await db.$transaction((tx) =>
      saveDefaultStaff(tx, cls.id, [{ role: "TEACHER_1", employeeId: gv.id }, { role: "ASSISTANT_1", employeeId: tg.id }]),
    );
    expectEqual(await db.sessionAssignment.count({ where: { sessionId: upcoming.id, employeeId: tg.id, role: "ASSISTANT" } }), 1, "buổi chưa dạy có thêm TG");
    expectEqual(await db.sessionAssignment.count({ where: { sessionId: taught.id, employeeId: tg.id } }), 0, "buổi đã dạy không thêm TG");

    await db.$transaction((tx) => saveDefaultStaff(tx, cls.id, [{ role: "TEACHER_1", employeeId: gv.id }]));
    expectEqual(await db.sessionAssignment.count({ where: { sessionId: upcoming.id, employeeId: tg.id } }), 0, "bỏ TG khỏi buổi chưa dạy");
    expectEqual(await db.sessionAssignment.count({ where: { sessionId: upcoming.id, employeeId: gv.id } }), 1, "GV vẫn còn");
  });

  // ---------------------------------------------------------------- 9
  await test("Người đã nghỉ việc không xếp được vào buổi sau ngày nghỉ", async () => {
    const resigned = { workStatus: "ACTIVE", resignDate: day("2026-09-30") };
    expectTrue(isEmployeeWorkingOn(resigned, day("2026-09-30")), "đúng ngày nghỉ vẫn dạy được");
    expectEqual(isEmployeeWorkingOn(resigned, day("2026-10-01")), false, "sau ngày nghỉ thì không");
    expectEqual(isEmployeeWorkingOn({ workStatus: "RESIGNED", resignDate: null }, day("2026-01-01")), false, "đã nghỉ không ghi ngày");

    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const a = await fx.seedEmployee(db, branch.id, { fullName: "GV A" });
    const gone = await fx.seedEmployee(db, branch.id, { fullName: "GV đã nghỉ" });
    await db.employee.update({ where: { id: gone.id }, data: { workStatus: "RESIGNED", resignDate: plusDays(-1) } });
    await db.classDefaultAssignment.create({ data: { classId: cls.id, employeeId: a.id, role: "TEACHER_1" } });
    const s = await session(cls.id, plusDays(4), "17:30", "19:00");
    await assign(s.id, a.id, "TEACHER");
    const saved = await db.$transaction((tx) => saveDefaultStaff(tx, cls.id, [{ role: "TEACHER_1", employeeId: gone.id }]));
    expectEqual(saved.ok, false, "chặn xếp người đã nghỉ");
  });

  // ---------------------------------------------------------------- 10
  await test("Hàng loạt – chỉ điền buổi trống: buổi đã có người giữ nguyên, buổi trống được gán đúng vai trò/đơn giá", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const x = await fx.seedEmployee(db, branch.id, { fullName: "GV X", teachingHourlyRate: 220_000, assistantHourlyRate: 60_000 });
    const old = await fx.seedEmployee(db, branch.id, { fullName: "GV cũ" });
    const empty = await session(cls.id, plusDays(2), "17:30", "19:00");
    const filled = await session(cls.id, plusDays(4), "17:30", "19:00");
    await assign(filled.id, old.id, "TEACHER");

    const input = { sessionIds: [empty.id, filled.id], teacherIds: [x.id], mode: "FILL_EMPTY" as const };
    const plan = await planBulkAssignment(db, input);
    expectEqual(plan.counts.ASSIGN, 1, "gán mới 1 buổi");
    expectEqual(plan.counts.KEEP, 1, "giữ nguyên buổi đã có GV cũ");
    await db.$transaction(async (tx) => applyBulkAssignment(tx, await planBulkAssignment(tx, input)));
    const row = await db.sessionAssignment.findFirst({ where: { sessionId: empty.id } });
    expectEqual(row?.role, "TEACHER", "vai trò TEACHER");
    expectEqual(row?.hourlyRate, 220_000, "đơn giá dạy của GV X");
    expectEqual((await db.sessionAssignment.findFirst({ where: { sessionId: filled.id } }))?.employeeId, old.id, "buổi đã có người vẫn là GV cũ");
  });

  // ---------------------------------------------------------------- 11
  await test("Hàng loạt – thay người: không đụng buổi đã dạy có người, người đã check-in; buổi đã dạy còn trống thì bổ sung", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const x = await fx.seedEmployee(db, branch.id, { fullName: "GV X", teachingHourlyRate: 200_000 });
    const a = await fx.seedEmployee(db, branch.id, { fullName: "GV A" });
    const upcoming = await session(cls.id, plusDays(3), "17:30", "19:00");
    await assign(upcoming.id, a.id, "TEACHER");
    const taught = await session(cls.id, plusDays(-5), "17:30", "19:00", "COMPLETED");
    await assign(taught.id, a.id, "TEACHER");
    const taughtEmpty = await session(cls.id, plusDays(-3), "17:30", "19:00", "COMPLETED");
    const checked = await session(cls.id, plusDays(0), "17:30", "19:00");
    const checkedRow = await assign(checked.id, a.id, "TEACHER");
    await db.sessionAssignment.update({ where: { id: checkedRow.id }, data: { checkInAt: new Date() } });
    const cancelled = await session(cls.id, plusDays(6), "17:30", "19:00", "CANCELLED");

    const input = { sessionIds: [upcoming.id, taught.id, taughtEmpty.id, checked.id, cancelled.id], teacherIds: [x.id], mode: "REPLACE" as const };
    const plan = await planBulkAssignment(db, input);
    const actionOf = (id: string) => plan.items.find((i) => i.sessionId === id)?.action;
    expectEqual(actionOf(upcoming.id), "REPLACE", "buổi chưa dạy: thay A → X");
    expectEqual(actionOf(taught.id), "KEEP", "buổi đã dạy có A: giữ");
    expectEqual(actionOf(taughtEmpty.id), "ASSIGN", "buổi đã dạy còn trống: bổ sung");
    expectEqual(actionOf(checked.id), "KEEP", "A đã check-in: giữ");
    expectEqual(actionOf(cancelled.id), "SKIP", "buổi đã hủy: bỏ qua");
    await db.$transaction(async (tx) => applyBulkAssignment(tx, await planBulkAssignment(tx, input)));
    const who = async (id: string) => (await db.sessionAssignment.findMany({ where: { sessionId: id } })).map((r) => r.employeeId).join(",");
    expectEqual(await who(upcoming.id), x.id, "buổi chưa dạy chỉ còn GV X");
    expectEqual(await who(taught.id), a.id, "buổi đã dạy vẫn là A");
    expectEqual(await who(checked.id), a.id, "buổi đã check-in vẫn là A");
  });

  // ---------------------------------------------------------------- 12
  await test("Hàng loạt – trùng lịch: 2 lớp cùng 07:00 cùng chọn thì chỉ gán 1; kẹt lớp khác thì bỏ qua", async () => {
    const branch = await fx.seedBranch(db);
    const lopA = await fx.seedClass(db, branch.id);
    const lopB = await fx.seedClass(db, branch.id);
    const lopC = await fx.seedClass(db, branch.id);
    const x = await fx.seedEmployee(db, branch.id, { fullName: "GV X" });
    const d = plusDays(5);
    const a7 = await session(lopA.id, d, "07:00", "08:30");
    const b7 = await session(lopB.id, d, "07:00", "08:30");
    const a9 = await session(lopA.id, d, "09:00", "10:30");
    const busy = await session(lopC.id, d, "09:30", "11:00");
    await assign(busy.id, x.id, "TEACHER");

    const plan = await planBulkAssignment(db, { sessionIds: [a7.id, b7.id, a9.id], teacherIds: [x.id], mode: "FILL_EMPTY" });
    const actionOf = (id: string) => plan.items.find((i) => i.sessionId === id);
    expectEqual(actionOf(a7.id)?.action, "ASSIGN", "07:00 lớp A: gán");
    expectEqual(actionOf(b7.id)?.action, "SKIP", "07:00 lớp B cùng giờ: bỏ qua");
    expectEqual(actionOf(a9.id)?.action, "SKIP", "09:00 chồng giờ lớp C 09:30: bỏ qua");
    expectTrue(actionOf(b7.id)?.skipped.some((k) => k.reason.includes("trùng")) ?? false, "có lý do trùng: " + JSON.stringify(actionOf(b7.id)?.skipped));
  });

  // ---------------------------------------------------------------- 13
  await test("Hàng loạt – buổi đã dạy thuộc tháng lương đã chốt: không bổ sung", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const x = await fx.seedEmployee(db, branch.id, { fullName: "GV X" });
    const taught = await session(cls.id, day("2026-03-10"), "17:30", "19:00", "COMPLETED");
    await fx.seedPayrollRun(db, branch.id, "2026-03", "LOCKED");
    const plan = await planBulkAssignment(db, { sessionIds: [taught.id], teacherIds: [x.id], mode: "FILL_EMPTY" });
    expectEqual(plan.items[0]?.action, "SKIP", "tháng lương đã chốt");
  });

  // ---------------------------------------------------------------- 14
  await test("Lớp 2 GV + 2 TG: sinh buổi đủ 4 người; đổi GV thứ 2; chuyển TG lên làm GV", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const [a, b, c, d, e] = await Promise.all(
      ["GV A", "GV B", "TG C", "TG D", "GV E"].map((fullName) =>
        fx.seedEmployee(db, branch.id, { fullName, teachingHourlyRate: 200_000, assistantHourlyRate: 80_000 }),
      ),
    );
    const weekday = new Date(plusDays(2)).getUTCDay();
    await db.scheduleRule.create({ data: { classId: cls.id, weekday, startTime: "17:30", endTime: "19:00" } });
    for (const [role, emp] of [["TEACHER_1", a], ["TEACHER_2", b], ["ASSISTANT_1", c], ["ASSISTANT_2", d]] as const) {
      await db.classDefaultAssignment.create({ data: { classId: cls.id, employeeId: emp.id, role } });
    }
    await createSessionsInRange(cls.id, plusDays(1), plusDays(15));
    const staffOf = async () => {
      const s = await db.classSession.findFirst({ where: { classId: cls.id }, orderBy: { sessionDate: "asc" }, include: { assignments: { include: { employee: true } } } });
      const pick = (type: string) => s!.assignments.filter((x) => (type === "GV" ? x.role === "TEACHER" : x.role !== "TEACHER")).map((x) => x.employee.fullName).sort().join(",");
      return `GV=${pick("GV")} TG=${pick("TG")}`;
    };
    expectEqual(await staffOf(), "GV=GV A,GV B TG=TG C,TG D", "buổi mới có đủ 2 GV + 2 TG");

    const save = (list: Array<[string, { id: string }]>) =>
      db.$transaction((tx) => saveDefaultStaff(tx, cls.id, list.map(([role, emp]) => ({ role, employeeId: emp.id }))));
    const r1 = await save([["TEACHER_1", a], ["TEACHER_2", e], ["ASSISTANT_1", c], ["ASSISTANT_2", d]]);
    expectTrue(r1.ok, "đổi GV thứ 2 lưu được");
    expectEqual(await staffOf(), "GV=GV A,GV E TG=TG C,TG D", "GV B → GV E, những người khác giữ");

    const r2 = await save([["TEACHER_1", a], ["TEACHER_2", c], ["ASSISTANT_1", d]]);
    expectTrue(r2.ok, "chuyển TG C lên GV lưu được: " + r2.plan.errors.join(" "));
    expectEqual(await staffOf(), "GV=GV A,TG C TG=TG D", "C thành GV, không còn là TG; E bị gỡ");
  });

  // ---------------------------------------------------------------- 15
  await test("Hàng loạt 2 GV + 2 TG – đặt đúng danh sách: thêm người thiếu, gỡ người ngoài danh sách", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const [x, y, t1, t2, old] = await Promise.all(
      ["GV X", "GV Y", "TG 1", "TG 2", "GV cũ"].map((fullName) =>
        fx.seedEmployee(db, branch.id, { fullName, teachingHourlyRate: 200_000, assistantHourlyRate: 80_000 }),
      ),
    );
    const s1 = await session(cls.id, plusDays(3), "17:30", "19:00");
    await assign(s1.id, old.id, "TEACHER");
    await assign(s1.id, t1.id, "ASSISTANT", 80_000);

    const input = { sessionIds: [s1.id], teacherIds: [x.id, y.id], assistantIds: [t1.id, t2.id], mode: "REPLACE" as const };
    const plan = await planBulkAssignment(db, input);
    const gv = plan.items.find((i) => i.role === "TEACHER");
    const tg = plan.items.find((i) => i.role === "ASSISTANT");
    expectEqual(gv?.action, "REPLACE", "GV: thay");
    expectEqual(gv?.addNames.join(","), "GV X,GV Y", "GV: thêm X, Y");
    expectEqual(gv?.removeNames.join(","), "GV cũ", "GV: gỡ GV cũ");
    expectEqual(tg?.action, "ASSIGN", "TG: thêm");
    expectEqual(tg?.addNames.join(","), "TG 2", "TG: thêm TG 2");
    expectEqual(tg?.keepNames.join(","), "TG 1", "TG: giữ TG 1");

    await db.$transaction(async (tx) => applyBulkAssignment(tx, await planBulkAssignment(tx, input)));
    const rows = await db.sessionAssignment.findMany({ where: { sessionId: s1.id }, include: { employee: true } });
    const list = rows.map((r) => `${r.role}:${r.employee.fullName}:${r.hourlyRate}`).sort().join(" | ");
    expectEqual(list, "ASSISTANT:TG 1:80000 | ASSISTANT:TG 2:80000 | TEACHER:GV X:200000 | TEACHER:GV Y:200000", "buổi đúng 2 GV + 2 TG, đơn giá theo vai trò");
  });

  // ---------------------------------------------------------------- 16
  await test("Hàng loạt 2 GV: 1 người trùng lịch thì chỉ bỏ qua người đó, người còn lại vẫn gán", async () => {
    const branch = await fx.seedBranch(db);
    const lopA = await fx.seedClass(db, branch.id);
    const lopB = await fx.seedClass(db, branch.id);
    const x = await fx.seedEmployee(db, branch.id, { fullName: "GV X bận" });
    const y = await fx.seedEmployee(db, branch.id, { fullName: "GV Y rảnh" });
    const d = plusDays(4);
    const busy = await session(lopB.id, d, "07:00", "08:30");
    await assign(busy.id, x.id, "TEACHER");
    const target = await session(lopA.id, d, "07:00", "08:30");
    const plan = await planBulkAssignment(db, { sessionIds: [target.id], teacherIds: [x.id, y.id], mode: "FILL_EMPTY" });
    const gv = plan.items[0];
    expectEqual(gv?.action, "ASSIGN", "vẫn gán");
    expectEqual(gv?.addNames.join(","), "GV Y rảnh", "gán GV Y");
    expectTrue(gv?.skipped.some((k) => k.name === "GV X bận" && k.reason.includes("trùng")) ?? false, "báo GV X trùng lịch");
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
