// Test luat chan trung ten hoc vien trong cung co so. Chay: npm run test:student-duplicate
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  prepareTestDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const { prisma: shared } = await import("@/lib/prisma");
  const {
    DuplicateStudentNameError,
    assertStudentNameNotDuplicated,
    findDuplicateStudentNames,
    normalizeStudentName,
    suggestStudentNameVariants,
  } = await import("@/lib/server/student-duplicate-name");
  const fx = await import("./fixtures");

  const db = new PrismaClient();
  console.log("Chay test chan trung ten hoc vien tren CSDL rieng (prisma/test.db):\n");

  const branchA = await fx.seedBranch(db);
  const branchB = await fx.seedBranch(db);
  const cls = await fx.seedClass(db, branchA.id);
  const original = await fx.seedStudent(db, branchA.id, "Nguyen   Van A");
  await fx.seedEnrollment(db, {
    studentId: original.id,
    classId: cls.id,
    billingModel: "PERIOD",
    enrollDate: new Date("2026-09-01T00:00:00.000Z"),
  });

  await test("Chuan hoa khoang trang va hoa/thuong de bat dung ten trung", async () => {
    expectEqual(normalizeStudentName(" Nguyen   Van A "), normalizeStudentName("nguyen van a"), "ten da chuan hoa");
    const matches = await findDuplicateStudentNames(db, { branchId: branchA.id, fullName: "nguyen van a" });
    expectEqual(matches.length, 1, "so hoc vien trung");
    expectEqual(matches[0].studentCode, original.studentCode, "ma HV trung");
    expectEqual(matches[0].currentClassName, cls.className, "hien lop de canh bao");
  });

  await test("Trung dung ten trong cung co so thi nem loi kem goi y A1/A2", async () => {
    let error: unknown = null;
    try {
      await assertStudentNameNotDuplicated(db, { branchId: branchA.id, fullName: "Nguyen Van A" });
    } catch (caught) {
      error = caught;
    }
    expectTrue(error instanceof DuplicateStudentNameError, "phai la loi trung ten chuyen biet");
    expectTrue((error as Error).message.includes(original.studentCode), "thong bao co ma hoc vien dang trung");
    expectTrue((error as Error).message.includes(cls.className), "thong bao co lop hien tai");
    expectEqual((error as { suggestions: string[] }).suggestions.join("|"), "Nguyen Van A1|Nguyen Van A2", "goi y ten");
  });

  await test("Cung ten nhung khac co so van duoc phep", async () => {
    const matches = await findDuplicateStudentNames(db, { branchId: branchB.id, fullName: "Nguyen Van A" });
    expectEqual(matches.length, 0, "khong bat trung cheo co so");
    await assertStudentNameNotDuplicated(db, { branchId: branchB.id, fullName: "Nguyen Van A" });
  });

  await test("Sua ho so giu nguyen chinh hoc vien do khong tu chan minh", async () => {
    await assertStudentNameNotDuplicated(db, {
      branchId: branchA.id,
      fullName: "Nguyen Van A",
      excludeStudentId: original.id,
    });
  });

  await test("Goi y bo qua cac hau to da dung", async () => {
    await fx.seedStudent(db, branchA.id, "Nguyen Van A1");
    const suggestions = await suggestStudentNameVariants(db, { branchId: branchA.id, fullName: "Nguyen Van A", take: 2 });
    expectEqual(suggestions.join("|"), "Nguyen Van A2|Nguyen Van A3", "goi y tiep theo");
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
