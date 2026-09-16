// Test bảng GIỜ DỰ KIẾN & GIỜ THỰC TẾ theo tuần/tháng. Chạy: npm run test:hours
//
// Quy tắc cần giữ: giờ dự kiến lấy theo thời khóa biểu đã phân công (gồm cả buổi sau đó
// trung tâm cho nghỉ), giờ thực tế là buổi đã dạy + công hành chính, và phần chênh luôn
// giải thích được (nghỉ / chưa tới ngày / dạy thay).
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { computeStaffHours, weekStartOf } = await import("@/lib/server/staff-hours");
  const { getVietnamToday } = await import("@/lib/server/class-rules");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  const today = getVietnamToday();
  const month = today.toISOString().slice(0, 7);
  const plusDays = (n: number) => new Date(today.getTime() + n * 86_400_000);
  console.log("Chạy test giờ dự kiến / thực tế (prisma/test.db):\n");

  // Ngày nằm trong tháng đang xem (tránh rơi sang tháng khác khi chạy cuối tháng).
  const inMonth = (offset: number) => {
    const date = plusDays(offset);
    return date.toISOString().slice(0, 7) === month ? date : today;
  };

  await test("Giờ dự kiến gồm cả buổi trung tâm cho nghỉ; giờ thực tế chỉ buổi đã dạy", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const staff = await fx.seedEmployee(db, branch.id, { fullName: "GV giờ" });
    const taught = await fx.seedSession(db, cls.id, inMonth(-2), "COMPLETED");
    const off = await fx.seedSession(db, cls.id, inMonth(-1), "CANCELLED");
    const next = await fx.seedSession(db, cls.id, inMonth(1), "PLANNED");
    for (const session of [taught, off, next]) {
      await fx.seedSessionAssignment(db, { sessionId: session.id, employeeId: staff.id, role: "TEACHER", hours: 1.5, hourlyRate: 100_000 });
    }

    const { rows } = await computeStaffHours({ month, branchId: branch.id });
    const row = rows.find((item) => item.employeeId === staff.id)!;
    expectEqual(row.plannedHours, 4.5, "3 buổi × 1,5h = 4,5h dự kiến");
    expectEqual(row.actualHours, 1.5, "chỉ 1 buổi đã dạy");
    expectEqual(row.cancelledHours, 1.5, "1 buổi trung tâm cho nghỉ");
    expectEqual(row.upcomingHours, 1.5, "1 buổi chưa tới ngày dạy");
    expectEqual(row.plannedSessions, 3, "3 ca theo lịch");
  });

  await test("Buổi đã dời lịch không tính; buổi bù tính vào ngày bù", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const staff = await fx.seedEmployee(db, branch.id, { fullName: "GV dời" });
    const moved = await fx.seedSession(db, cls.id, inMonth(-3), "RESCHEDULED");
    const makeup = await db.classSession.create({
      data: { classId: cls.id, sessionDate: inMonth(-1), startTime: "17:30", endTime: "19:00", status: "COMPLETED", replacesSessionId: moved.id },
    });
    for (const session of [moved, makeup]) {
      await fx.seedSessionAssignment(db, { sessionId: session.id, employeeId: staff.id, role: "TEACHER", hours: 1.5, hourlyRate: 100_000 });
    }

    const { rows } = await computeStaffHours({ month, branchId: branch.id });
    const row = rows.find((item) => item.employeeId === staff.id)!;
    expectEqual(row.plannedHours, 1.5, "chỉ tính buổi bù, không tính buổi đã dời");
    expectEqual(row.actualHours, 1.5, "buổi bù đã dạy");
  });

  await test("Người được dạy thay không bị tính giờ; người dạy thay được cộng giờ", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const owner = await fx.seedEmployee(db, branch.id, { fullName: "GV nghỉ" });
    const cover = await fx.seedEmployee(db, branch.id, { fullName: "GV dạy thay" });
    const session = await fx.seedSession(db, cls.id, inMonth(-1), "COMPLETED");
    const original = await fx.seedSessionAssignment(db, { sessionId: session.id, employeeId: owner.id, role: "TEACHER", hours: 1.5, hourlyRate: 100_000 });
    await db.sessionAssignment.create({
      data: {
        sessionId: session.id,
        employeeId: cover.id,
        role: "TEACHER",
        substituteForId: original.id,
        isSubstituteShift: true,
        hours: 1.5,
        hourlyRate: 100_000,
        amount: 150_000,
      },
    });

    const { rows } = await computeStaffHours({ month, branchId: branch.id });
    const ownerRow = rows.find((item) => item.employeeId === owner.id)!;
    const coverRow = rows.find((item) => item.employeeId === cover.id)!;
    expectEqual(ownerRow.plannedHours, 0, "người được thay không tính giờ buổi đó");
    expectEqual(coverRow.actualHours, 1.5, "người dạy thay tính 1,5h");
    expectEqual(coverRow.substituteHours, 1.5, "ghi nhận là giờ dạy thay để giải thích chênh lệch");
  });

  await test("Công hành chính cộng vào giờ thực tế; ghi chú và định mức đọc đúng", async () => {
    const branch = await fx.seedBranch(db);
    const staff = await fx.seedEmployee(db, branch.id, { fullName: "NV hành chính" });
    await db.employee.update({ where: { id: staff.id }, data: { contractHoursPerMonth: 160 } });
    await fx.seedTimesheetEntry(db, { employeeId: staff.id, workDate: inMonth(-1), days: 1 });
    await db.timesheetEntry.updateMany({ where: { employeeId: staff.id }, data: { hours: 8 } });
    await db.staffHoursNote.create({ data: { employeeId: staff.id, periodKey: month, note: "Nghỉ lễ 2/9" } });

    const { rows } = await computeStaffHours({ month, branchId: branch.id });
    const row = rows.find((item) => item.employeeId === staff.id)!;
    expectEqual(row.adminHours, 8, "8 giờ hành chính");
    expectEqual(row.contractHoursPerMonth, 160, "định mức 160h/tháng");
    expectEqual(row.note, "Nghỉ lễ 2/9", "ghi chú tháng");
  });

  await test("Chia theo tuần: giờ rơi đúng tuần chứa ngày đó", async () => {
    const branch = await fx.seedBranch(db);
    const cls = await fx.seedClass(db, branch.id);
    const staff = await fx.seedEmployee(db, branch.id, { fullName: "GV tuần" });
    const day = inMonth(-1);
    const session = await fx.seedSession(db, cls.id, day, "COMPLETED");
    await fx.seedSessionAssignment(db, { sessionId: session.id, employeeId: staff.id, role: "TEACHER", hours: 1.5, hourlyRate: 100_000 });

    const { rows } = await computeStaffHours({ month, branchId: branch.id });
    const row = rows.find((item) => item.employeeId === staff.id)!;
    const weekKey = weekStartOf(day).toISOString().slice(0, 10);
    const week = row.weeks.find((item) => item.key === weekKey)!;
    expectTrue(Boolean(week), "có tuần chứa ngày dạy");
    expectEqual(week.actualHours, 1.5, "giờ nằm đúng tuần đó");
    expectEqual(
      row.weeks.filter((item) => item.key !== weekKey).reduce((sum, item) => sum + item.plannedHours, 0),
      0,
      "các tuần khác không có giờ",
    );
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
