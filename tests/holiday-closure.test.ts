// Test tự động TRUNG TÂM CHO NGHỈ và NGÀY NGHỈ CỦA TRUNG TÂM. Chạy: npm run test:closure
//
// Quy tắc cần giữ: buổi nghỉ không có số trong lộ trình → các buổi sau học tiếp đúng tài liệu
// còn dang dở; lớp đã sinh lịch tới cuối khóa được nối thêm buổi; bỏ nghỉ thì mọi thứ về như cũ.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { createSessionsInRange } = await import("@/lib/server/class-generation");
  const {
    applyHolidayClosure,
    countTaughtSessionsAfter,
    extendScheduleAfterCancellation,
    planHolidayClosure,
    removeHolidayAndRestore,
    trimExcessUpcomingSessions,
  } = await import("@/lib/server/session-cancellation");
  const { computeSessionNumbers } = await import("@/lib/session-numbering");
  const { getVietnamToday } = await import("@/lib/server/class-rules");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");
  const db = new PrismaClient();
  const today = getVietnamToday();
  const plusDays = (n: number) => new Date(today.getTime() + n * 86_400_000);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  console.log("Chạy test cho nghỉ / ngày nghỉ trung tâm (prisma/test.db):\n");

  // Lớp học 1 buổi/tuần vào đúng thứ của ngày (hôm nay + 1), sinh sẵn `generated` buổi.
  async function weeklyClass(branchId: string, total: number, generated: number) {
    const cls = await fx.seedClass(db, branchId, { totalSessions: total });
    const first = plusDays(1);
    await db.class.update({ where: { id: cls.id }, data: { startDate: first } });
    await db.scheduleRule.create({ data: { classId: cls.id, weekday: first.getUTCDay(), startTime: "17:30", endTime: "19:00" } });
    await createSessionsInRange(cls.id, first, new Date(first.getTime() + (generated - 1) * 7 * 86_400_000));
    return cls;
  }
  const sessionsOf = (classId: string) =>
    db.classSession.findMany({ where: { classId }, orderBy: { sessionDate: "asc" } });
  const numbersOf = async (classId: string) => {
    const list = await sessionsOf(classId);
    const { numberById, count } = computeSessionNumbers(list);
    return { list, numberById, count };
  };

  // ---------------------------------------------------------------- 1
  await test("Cho nghỉ 1 buổi ở lớp đã sinh đủ lịch: buổi sau dồn lên, nối thêm đúng 1 buổi cuối khóa", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await weeklyClass(branch.id, 6, 6);
    const before = await sessionsOf(cls.id);
    expectEqual(before.length, 6, "đã sinh 6 buổi");
    await db.classSession.update({ where: { id: before[2].id }, data: { status: "CANCELLED" } }); // nghỉ buổi 3
    const { created } = await extendScheduleAfterCancellation(cls.id, 1);
    expectEqual(created, 1, "nối thêm 1 buổi");
    const after = await numbersOf(cls.id);
    expectEqual(after.count, 6, "vẫn đủ 6 buổi trong lộ trình");
    expectEqual(after.numberById.get(before[3].id), 3, "buổi ngay sau buổi nghỉ học tài liệu buổi 3");
    expectEqual(after.numberById.get(after.list[after.list.length - 1].id), 6, "buổi mới nối thêm là buổi 6");
    expectTrue(after.list[after.list.length - 1].sessionDate > before[5].sessionDate, "buổi nối thêm nằm sau buổi cuối cũ");
  });

  // ---------------------------------------------------------------- 2
  await test("Lớp chưa sinh hết lịch: cho nghỉ không sinh trước cả khóa (để đợt sinh lịch tự động lo)", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await weeklyClass(branch.id, 20, 4);
    const list = await sessionsOf(cls.id);
    await db.classSession.update({ where: { id: list[1].id }, data: { status: "CANCELLED" } });
    expectEqual((await extendScheduleAfterCancellation(cls.id, 1)).created, 0, "không sinh thêm");
  });

  // ---------------------------------------------------------------- 3
  await test("Không cho nghỉ lùi buổi mà sau nó đã có buổi dạy", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await weeklyClass(branch.id, 6, 6);
    const list = await sessionsOf(cls.id);
    await db.classSession.update({ where: { id: list[2].id }, data: { status: "COMPLETED" } });
    expectEqual(await countTaughtSessionsAfter(db, list[1]), 1, "buổi 2 có buổi đã dạy phía sau");
    expectEqual(await countTaughtSessionsAfter(db, list[3]), 0, "buổi 4 thì không");
  });

  // ---------------------------------------------------------------- 4
  await test("NGÀY NGHỈ TRUNG TÂM: mọi lớp của cơ sở nghỉ buổi rơi vào ngày đó, lớp đủ lịch được nối thêm, buổi đã dạy bỏ qua", async () => {
    const branch = await fx.seedBranch(db);
    const otherBranch = await fx.seedBranch(db);
    const a = await weeklyClass(branch.id, 5, 5);
    const b = await weeklyClass(branch.id, 30, 5);
    const other = await weeklyClass(otherBranch.id, 5, 5);
    const day = (await sessionsOf(a.id))[1].sessionDate; // cả 3 lớp đều có buổi ngày này
    const taught = await weeklyClass(branch.id, 5, 5);
    const taughtSession = (await sessionsOf(taught.id))[1];
    await db.classSession.update({ where: { id: taughtSession.id }, data: { status: "COMPLETED" } });

    const plan = await planHolidayClosure(db, { branchId: branch.id, dateKeys: [key(day)] });
    expectEqual(plan.cancelCount, 2, "xem trước: nghỉ 2 buổi (lớp A, B)");
    expectEqual(plan.items.filter((i) => i.action === "SKIP").length, 1, "xem trước: bỏ qua buổi đã dạy");

    const result = await applyHolidayClosure({ branchId: branch.id, dateKeys: [key(day)], name: "Nghỉ lễ thử" });
    expectEqual(result.cancelCount, 2, "đã nghỉ 2 buổi");
    expectEqual(result.extended, 1, "chỉ lớp A (đủ lịch) được nối thêm 1 buổi");
    const holiday = await db.holiday.findFirstOrThrow({ where: { branchId: branch.id, date: day } });
    expectEqual(holiday.name, "Nghỉ lễ thử", "đã khai ngày nghỉ");
    const aSessions = await sessionsOf(a.id);
    const cancelled = aSessions.find((s) => s.sessionDate.getTime() === day.getTime());
    expectEqual(cancelled?.status, "CANCELLED", "buổi lớp A ngày nghỉ đã nghỉ");
    expectEqual(cancelled?.cancelledByHolidayId, holiday.id, "gắn với ngày nghỉ");
    expectEqual(cancelled?.notes, "Trung tâm nghỉ: Nghỉ lễ thử", "ghi lý do");
    expectEqual((await sessionsOf(other.id)).every((s) => s.status === "PLANNED"), true, "cơ sở khác không bị ảnh hưởng");
    expectEqual((await db.classSession.findUniqueOrThrow({ where: { id: taughtSession.id } })).status, "COMPLETED", "buổi đã dạy giữ nguyên");
    const aNumbers = await numbersOf(a.id);
    expectEqual(aNumbers.count, 5, "lớp A vẫn đủ 5 buổi");
    expectEqual(aNumbers.numberById.get(aSessions[2].id), 2, "buổi kế tiếp học tài liệu buổi 2");
  });

  // ---------------------------------------------------------------- 5
  await test("BỎ NGÀY NGHỈ: khôi phục đúng các buổi, bỏ buổi đã nối thêm, lộ trình về như cũ", async () => {
    const branch = await fx.seedBranch(db);
    const a = await weeklyClass(branch.id, 5, 5);
    const original = await sessionsOf(a.id);
    const day = original[3].sessionDate;
    await applyHolidayClosure({ branchId: branch.id, dateKeys: [key(day)], name: "Bão" });
    expectEqual((await sessionsOf(a.id)).length, 6, "sau khi nghỉ: 6 buổi (1 nghỉ + 1 nối thêm)");
    const holiday = await db.holiday.findFirstOrThrow({ where: { branchId: branch.id, date: day } });

    const result = await removeHolidayAndRestore(holiday.id);
    expectEqual(result.restored, 1, "khôi phục 1 buổi");
    expectEqual(result.removed, 1, "bỏ 1 buổi đã nối thêm");
    const after = await numbersOf(a.id);
    expectEqual(after.list.length, 5, "còn đúng 5 buổi");
    expectEqual(after.list.map((s) => s.id).join(","), original.map((s) => s.id).join(","), "đúng các buổi ban đầu");
    expectEqual(after.numberById.get(original[3].id), 4, "buổi được khôi phục lại là buổi 4");
    expectEqual(await db.holiday.count({ where: { id: holiday.id } }), 0, "đã xóa ngày nghỉ");
  });

  // ---------------------------------------------------------------- 6
  await test("Bỏ nghỉ không xóa buổi cuối đã có dữ liệu (điểm danh) — chỉ bỏ buổi trống", async () => {
    const branch = await fx.seedBranch(db);
    const a = await weeklyClass(branch.id, 3, 3);
    const list = await sessionsOf(a.id);
    await db.classSession.update({ where: { id: list[0].id }, data: { status: "CANCELLED" } });
    await extendScheduleAfterCancellation(a.id, 1);
    const extra = (await sessionsOf(a.id)).at(-1)!;
    const student = await fx.seedStudent(db, branch.id, "Có điểm danh");
    await db.studentAttendance.create({ data: { sessionId: extra.id, studentId: student.id, status: "PRESENT" } });
    await db.classSession.update({ where: { id: list[0].id }, data: { status: "PLANNED" } });
    const { removed } = await trimExcessUpcomingSessions(a.id);
    expectEqual(removed, 1, "vẫn bỏ được 1 buổi trống");
    expectTrue((await db.classSession.count({ where: { id: extra.id } })) === 1, "buổi có điểm danh còn nguyên");
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
