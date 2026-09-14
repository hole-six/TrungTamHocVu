// Test tự động cho MÃ HỌC VIÊN HV-001, HV-002... Chạy: npm run test:codes
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, summary } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { formatStudentCode, nextStudentCode, withStudentCodeRetry } = await import("@/lib/server/student-code");
  const { prisma: shared } = await import("@/lib/prisma");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  console.log("Chạy test mã học viên trên CSDL riêng (prisma/test.db):\n");

  await test("Định dạng: tối thiểu 3 chữ số, qua nghìn thì dài ra chứ không cắt", async () => {
    expectEqual(formatStudentCode(1), "HV-001", "số 1");
    expectEqual(formatStudentCode(42), "HV-042", "số 42");
    expectEqual(formatStudentCode(999), "HV-999", "số 999");
    expectEqual(formatStudentCode(1000), "HV-1000", "số 1000");
    expectEqual(formatStudentCode(12345), "HV-12345", "số 12345");
  });

  const branch = await fx.seedBranch(db);

  await test("Chưa có mã HV- nào: bắt đầu từ HV-001; mã kiểu cũ (HV0001, LEAD-...) không làm lệch dãy", async () => {
    await fx.seedStudent(db, branch.id, "Mã cũ kiểu fixture"); // HV0001-style
    await db.student.create({ data: { branchId: branch.id, studentCode: "LEAD-0101", fullName: "Mã lead cũ", status: "ACTIVE" } });
    expectEqual(await nextStudentCode(db), "HV-001", "mã đầu tiên");
  });

  await test("Lấy số LỚN NHẤT + 1 (xóa học viên giữa dãy không cấp trùng số cuối)", async () => {
    for (const code of ["HV-001", "HV-002", "HV-007"]) {
      await db.student.create({ data: { branchId: branch.id, studentCode: code, fullName: code, status: "ACTIVE" } });
    }
    expectEqual(await nextStudentCode(db), "HV-008", "sau HV-007");
    await db.student.create({ data: { branchId: branch.id, studentCode: "HV-999", fullName: "999", status: "ACTIVE" } });
    expectEqual(await nextStudentCode(db), "HV-1000", "sau HV-999 là HV-1000");
    await db.student.create({ data: { branchId: branch.id, studentCode: "HV-1000", fullName: "1000", status: "ACTIVE" } });
    expectEqual(await nextStudentCode(db), "HV-1001", "sau HV-1000 là HV-1001 (so số, không so chuỗi)");
  });

  await test("Hai người tạo cùng lúc lấy trùng mã: người sau tự thử lại và nhận số kế tiếp", async () => {
    let attempts = 0;
    const stale = await nextStudentCode(db); // cả hai cùng đọc được số này
    await db.student.create({ data: { branchId: branch.id, studentCode: stale, fullName: "Người nhanh tay", status: "ACTIVE" } });
    const created = await withStudentCodeRetry(() =>
      db.$transaction(async (tx) => {
        attempts += 1;
        const studentCode = attempts === 1 ? stale : await nextStudentCode(tx);
        return tx.student.create({ data: { branchId: branch.id, studentCode, fullName: "Người chậm tay", status: "ACTIVE" } });
      }),
    );
    expectEqual(attempts, 2, "thử lại đúng 1 lần");
    expectEqual(created.studentCode, "HV-1002", "nhận số kế tiếp");
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
