// Test tự động mảng CHẤM CÔNG & LƯƠNG. Chạy: npm run test:payroll
//
// Lương là tiền ĐI RA, sai thì ảnh hưởng trực tiếp tới thu nhập của nhân sự, nhưng
// trước đây không có một phép thử nào bảo vệ. Bộ này khóa lại các quy tắc trong
// lib/server/payroll-rules.ts và lib/server/payroll-generation.ts.
//
// generatePayrollForRun dùng prisma singleton (@/lib/prisma) chứ không nhận tx, nên
// phải trỏ DATABASE_URL sang CSDL test TRƯỚC rồi mới await import() — xem
// prepareTestDatabase trong harness.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, expectTrue, summary, vnd } from "./harness";

async function main() {
  prepareTestDatabase();

  // Nạp sau khi DATABASE_URL đã trỏ đúng chỗ.
  const { PrismaClient } = await import("@prisma/client");
  const { generatePayrollForRun } = await import("@/lib/server/payroll-generation");
  const { computeHoursFromTimeRange, computeAdjustedHours, computeSessionBaseHours, canEditPayroll } = await import(
    "@/lib/server/payroll-rules"
  );
  const fixtures = await import("./fixtures");
  // generatePayrollForRun chạy trên client singleton này — phải ngắt cả nó, nếu không
  // file CSDL test còn bị giữ và không dọn được.
  const { prisma: sharedClient } = await import("@/lib/prisma");

  const db = new PrismaClient();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  console.log("Chạy test mảng chấm công & lương trên CSDL riêng (prisma/test.db):\n");

  // ---------------------------------------------------------------- 1
  await test("Giờ dạy tính đúng theo khung giờ buổi học", async () => {
    expectEqual(computeHoursFromTimeRange("17:30", "19:00"), 1.5, "17:30-19:00");
    expectEqual(computeHoursFromTimeRange("08:00", "11:30"), 3.5, "08:00-11:30");
    expectEqual(computeHoursFromTimeRange("19:00", "17:30"), 0, "giờ kết thúc trước giờ bắt đầu");
  });

  // ---------------------------------------------------------------- 2
  // Người trả theo CA thì 1 buổi là 1 đơn vị, vì đơn giá là tiền/ca. Nhân theo giờ
  // thực sẽ trả sai mỗi khi buổi dài/ngắn hơn khung chuẩn.
  await test("Trả theo CA thì 1 buổi tính 1 đơn vị, không nhân theo giờ", async () => {
    expectEqual(computeSessionBaseHours("SESSION", "17:30", "19:00"), 1, "trả theo ca");
    expectEqual(computeSessionBaseHours("HOURLY", "17:30", "19:00"), 1.5, "trả theo giờ");
  });

  // ---------------------------------------------------------------- 3
  // Đúng cột "Đi muộn TG" của file quản lý: trừ vào giờ được tính lương, và không
  // bao giờ để giờ công thành số âm.
  await test("Đi muộn bị trừ giờ, nhưng giờ công không bao giờ âm", async () => {
    expectEqual(computeAdjustedHours(1.5, 0.25, 0), 1.25, "đi muộn 15 phút");
    expectEqual(computeAdjustedHours(1.5, 0, 0.5), 2, "cộng thêm 30 phút chuẩn bị");
    expectEqual(computeAdjustedHours(1, 3, 0), 0, "trừ nhiều hơn giờ thực có");
  });

  // ---------------------------------------------------------------- 4
  // Đây là bản song song của lỗi ví vừa tìm được: buổi KHÔNG DIỄN RA thì không ai
  // được tính công, kể cả khi đã phân công giáo viên từ trước.
  await test("Buổi trung tâm cho nghỉ KHÔNG được tính công cho ai", async () => {
    const branch = await fixtures.seedBranch(db);
    const cls = await fixtures.seedClass(db, branch.id);
    const teacher = await fixtures.seedEmployee(db, branch.id, { fullName: "GV A", teachingHourlyRate: 200_000 });
    const taught = await fixtures.seedSession(db, cls.id, day("2026-05-05"), "COMPLETED");
    const cancelled = await fixtures.seedSession(db, cls.id, day("2026-05-07"), "CANCELLED");
    await fixtures.seedSessionAssignment(db, { sessionId: taught.id, employeeId: teacher.id, role: "TEACHER", hours: 1.5, hourlyRate: 200_000 });
    await fixtures.seedSessionAssignment(db, { sessionId: cancelled.id, employeeId: teacher.id, role: "TEACHER", hours: 1.5, hourlyRate: 200_000 });

    const run = await fixtures.seedPayrollRun(db, branch.id, "2026-05");
    await generatePayrollForRun(run.id);

    const line = await db.payrollLine.findFirst({ where: { payrollRunId: run.id, employeeId: teacher.id } });
    expectEqual(line?.teachingHours, 1.5, "giờ dạy (chỉ buổi đã dạy thật)");
    expectEqual(line?.teachingAmount, 300_000, "tiền dạy " + vnd(300_000));
  });

  // ---------------------------------------------------------------- 5
  await test("Buổi ngoài tháng không lọt vào bảng lương tháng này", async () => {
    const branch = await fixtures.seedBranch(db);
    const cls = await fixtures.seedClass(db, branch.id);
    const teacher = await fixtures.seedEmployee(db, branch.id, { fullName: "GV B", teachingHourlyRate: 200_000 });
    const inMonth = await fixtures.seedSession(db, cls.id, day("2026-06-10"), "COMPLETED");
    const nextMonth = await fixtures.seedSession(db, cls.id, day("2026-07-02"), "COMPLETED");
    await fixtures.seedSessionAssignment(db, { sessionId: inMonth.id, employeeId: teacher.id, role: "TEACHER", hours: 2, hourlyRate: 200_000 });
    await fixtures.seedSessionAssignment(db, { sessionId: nextMonth.id, employeeId: teacher.id, role: "TEACHER", hours: 2, hourlyRate: 200_000 });

    const run = await fixtures.seedPayrollRun(db, branch.id, "2026-06");
    await generatePayrollForRun(run.id);

    const line = await db.payrollLine.findFirst({ where: { payrollRunId: run.id, employeeId: teacher.id } });
    expectEqual(line?.teachingHours, 2, "giờ dạy tháng 6");
    expectEqual(line?.teachingAmount, 400_000, "tiền dạy tháng 6");
  });

  // ---------------------------------------------------------------- 6
  await test("Công hành chính nhân đúng đơn giá ngày công", async () => {
    const branch = await fixtures.seedBranch(db);
    const staff = await fixtures.seedEmployee(db, branch.id, { fullName: "NV hành chính", staffDailyRate: 300_000 });
    for (const d of ["2026-05-04", "2026-05-05", "2026-05-06"]) {
      await fixtures.seedTimesheetEntry(db, { employeeId: staff.id, workDate: day(d), days: 1 });
    }
    await fixtures.seedTimesheetEntry(db, { employeeId: staff.id, workDate: day("2026-05-07"), days: 0.5 });

    const run = await fixtures.seedPayrollRun(db, branch.id, "2026-05");
    await generatePayrollForRun(run.id);

    const line = await db.payrollLine.findFirst({ where: { payrollRunId: run.id, employeeId: staff.id } });
    expectEqual(line?.staffDays, 3.5, "số ngày công");
    expectEqual(line?.baseSalaryAmount, 1_050_000, "lương hành chính " + vnd(1_050_000));
  });

  // ---------------------------------------------------------------- 7
  // Trước đây trường hợp này im lặng: nhân sự chấm công đủ cả tháng, bảng lương vẫn
  // hiện 0đ mà không ai biết vì sao.
  await test("Có công nhưng chưa cấu hình đơn giá thì phải CẢNH BÁO, không im lặng", async () => {
    const branch = await fixtures.seedBranch(db);
    const staff = await fixtures.seedEmployee(db, branch.id, { fullName: "NV chưa có đơn giá", staffDailyRate: null });
    await fixtures.seedTimesheetEntry(db, { employeeId: staff.id, workDate: day("2026-05-04"), days: 1 });

    const run = await fixtures.seedPayrollRun(db, branch.id, "2026-05");
    const result = await generatePayrollForRun(run.id);
    const warnings = ("warnings" in result ? result.warnings : []) ?? [];

    expectTrue(
      warnings.some((w) => w.employeeId === staff.id && /đơn giá ngày công/i.test(w.message)),
      "phải có cảnh báo thiếu đơn giá ngày công cho " + staff.fullName,
    );
    const line = await db.payrollLine.findFirst({ where: { payrollRunId: run.id, employeeId: staff.id } });
    expectEqual(line?.baseSalaryAmount, 0, "lương hành chính khi chưa có đơn giá");
  });

  // ---------------------------------------------------------------- 8
  // Bấm "Tính lại lương" là thao tác được phép làm nhiều lần trong lúc rà soát —
  // chạy lại không được nhân đôi số liệu hay đẻ thêm dòng lương.
  await test("Tính lại lương nhiều lần không nhân đôi số", async () => {
    const branch = await fixtures.seedBranch(db);
    const cls = await fixtures.seedClass(db, branch.id);
    const teacher = await fixtures.seedEmployee(db, branch.id, { fullName: "GV C", teachingHourlyRate: 200_000 });
    const session = await fixtures.seedSession(db, cls.id, day("2026-05-12"), "COMPLETED");
    await fixtures.seedSessionAssignment(db, { sessionId: session.id, employeeId: teacher.id, role: "TEACHER", hours: 2, hourlyRate: 200_000 });

    const run = await fixtures.seedPayrollRun(db, branch.id, "2026-05");
    await generatePayrollForRun(run.id);
    await generatePayrollForRun(run.id);
    await generatePayrollForRun(run.id);

    const lines = await db.payrollLine.findMany({ where: { payrollRunId: run.id, employeeId: teacher.id } });
    expectEqual(lines.length, 1, "số dòng lương của người này");
    expectEqual(lines[0]?.teachingAmount, 400_000, "tiền dạy sau 3 lần tính lại");
  });

  // ---------------------------------------------------------------- 9
  // Thưởng/phạt là nhân sự tự gõ, không suy ra được từ dữ liệu — tính lại mà xóa mất
  // thì mọi điều chỉnh tay của kế toán bay hết.
  await test("Tính lại lương giữ nguyên các khoản nhập tay và cộng trừ đúng", async () => {
    const branch = await fixtures.seedBranch(db);
    const cls = await fixtures.seedClass(db, branch.id);
    const teacher = await fixtures.seedEmployee(db, branch.id, { fullName: "GV D", teachingHourlyRate: 200_000 });
    const session = await fixtures.seedSession(db, cls.id, day("2026-05-14"), "COMPLETED");
    await fixtures.seedSessionAssignment(db, { sessionId: session.id, employeeId: teacher.id, role: "TEACHER", hours: 2, hourlyRate: 200_000 });

    const run = await fixtures.seedPayrollRun(db, branch.id, "2026-05");
    await generatePayrollForRun(run.id);

    await db.payrollLine.updateMany({
      where: { payrollRunId: run.id, employeeId: teacher.id },
      data: { bonus: 500_000, penalty: 200_000, parkingAllowance: 100_000 },
    });
    await generatePayrollForRun(run.id);

    const line = await db.payrollLine.findFirst({ where: { payrollRunId: run.id, employeeId: teacher.id } });
    expectEqual(line?.bonus, 500_000, "thưởng nhập tay còn nguyên");
    expectEqual(line?.penalty, 200_000, "phạt nhập tay còn nguyên");
    // 400.000 dạy + 500.000 thưởng + 100.000 phụ cấp gửi xe − 200.000 phạt
    expectEqual(line?.totalAmount, 800_000, "tổng lương " + vnd(800_000));
  });

  // ---------------------------------------------------------------- 10
  await test("Thưởng đánh giá trợ giảng tính theo % thu nhập trợ giảng", async () => {
    const branch = await fixtures.seedBranch(db);
    const cls = await fixtures.seedClass(db, branch.id);
    const assistant = await fixtures.seedEmployee(db, branch.id, { fullName: "TG E", assistantHourlyRate: 100_000 });
    const session = await fixtures.seedSession(db, cls.id, day("2026-05-18"), "COMPLETED");
    await fixtures.seedSessionAssignment(db, { sessionId: session.id, employeeId: assistant.id, role: "ASSISTANT", hours: 10, hourlyRate: 100_000 });
    await db.assistantMonthlyBonus.create({
      data: { employeeId: assistant.id, branchId: branch.id, month: "2026-05", bonusPercent: 0.1 },
    });

    const run = await fixtures.seedPayrollRun(db, branch.id, "2026-05");
    await generatePayrollForRun(run.id);

    const line = await db.payrollLine.findFirst({ where: { payrollRunId: run.id, employeeId: assistant.id } });
    expectEqual(line?.assistantAmount, 1_000_000, "thu nhập trợ giảng");
    expectEqual(line?.assistantRatingBonus, 100_000, "thưởng đánh giá 10%");
    expectEqual(line?.totalAmount, 1_100_000, "tổng lương");
  });

  // ---------------------------------------------------------------- 11
  // Đã khóa/đã trả lương thì số liệu phải đóng băng, không cho tính lại đè lên.
  await test("Tháng lương đã khóa thì không tính lại được", async () => {
    expectEqual(canEditPayroll("DRAFT"), true, "nháp");
    expectEqual(canEditPayroll("CALCULATED"), true, "đã tính");
    expectEqual(canEditPayroll("REOPENED"), true, "đã mở lại");
    expectEqual(canEditPayroll("LOCKED"), false, "đã khóa");
    expectEqual(canEditPayroll("PAID"), false, "đã trả lương");

    const branch = await fixtures.seedBranch(db);
    const run = await fixtures.seedPayrollRun(db, branch.id, "2026-05", "LOCKED");
    const result = await generatePayrollForRun(run.id);
    expectEqual("code" in result ? result.code : null, "NOT_EDITABLE", "mã lỗi khi tính lại tháng đã khóa");
  });

  // ---------------------------------------------------------------- 12
  // Nhân sự của chi nhánh khác không được lọt vào bảng lương chi nhánh này.
  await test("Bảng lương chỉ gồm nhân sự của đúng chi nhánh", async () => {
    const branchA = await fixtures.seedBranch(db);
    const branchB = await fixtures.seedBranch(db);
    const clsA = await fixtures.seedClass(db, branchA.id);
    const ourTeacher = await fixtures.seedEmployee(db, branchA.id, { fullName: "GV cơ sở A", teachingHourlyRate: 200_000 });
    const otherTeacher = await fixtures.seedEmployee(db, branchB.id, { fullName: "GV cơ sở B", teachingHourlyRate: 200_000 });
    const session = await fixtures.seedSession(db, clsA.id, day("2026-05-20"), "COMPLETED");
    await fixtures.seedSessionAssignment(db, { sessionId: session.id, employeeId: ourTeacher.id, role: "TEACHER", hours: 2, hourlyRate: 200_000 });
    await fixtures.seedTimesheetEntry(db, { employeeId: otherTeacher.id, workDate: day("2026-05-20"), days: 1 });

    const run = await fixtures.seedPayrollRun(db, branchA.id, "2026-05");
    await generatePayrollForRun(run.id);

    const lines = await db.payrollLine.findMany({ where: { payrollRunId: run.id } });
    expectEqual(lines.length, 1, "số dòng lương của cơ sở A");
    expectEqual(lines[0]?.employeeId, ourTeacher.id, "đúng người của cơ sở A");
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
