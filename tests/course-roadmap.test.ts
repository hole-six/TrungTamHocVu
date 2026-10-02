// Test tự động: TIẾN TRÌNH DÙNG CHUNG CỦA KHÓA HỌC. Chạy: npm run test:roadmap2
//
// Chốt 10/2026: tiến trình soạn một lần ở KHÓA, mọi lớp cùng khóa dùng chung; lớp muốn
// khác ở buổi nào thì ghi đè đúng buổi đó. Hai điều phải giữ bằng mọi giá:
//   1. Dữ liệu CŨ không đổi — lớp đang có tiến trình riêng vẫn ra đúng nội dung cũ,
//      nếu không thì sau khi nâng cấp giáo viên mở lớp ra thấy nội dung lạ.
//   2. Sửa ở khóa thì mọi lớp chưa ghi đè phải đổi theo, còn lớp đã ghi đè thì không.
import { prepareTestDatabase, dropTestDatabase, test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  prepareTestDatabase();

  const { PrismaClient } = await import("@prisma/client");
  const { resolveClassRoadmap, isRealRoadmapOverride, normalizeAlertLevel } = await import("@/lib/server/class-roadmap");
  const fixtures = await import("./fixtures");
  const { prisma: sharedClient } = await import("@/lib/prisma");

  const db = new PrismaClient();
  console.log("Chạy test tiến trình dùng chung của khóa học:\n");

  async function seedCourseClass(totalSessions = 4) {
    const branch = await fixtures.seedBranch(db);
    const cls = await fixtures.seedClass(db, branch.id, { totalSessions });
    const full = await db.class.findUniqueOrThrow({ where: { id: cls.id } });
    return { branch, cls: full, courseId: full.courseId! };
  }

  // ---------------------------------------------------------------- 1
  await test("Phân biệt được buổi ghi đè thật và buổi trống mặc định", async () => {
    expectTrue(!isRealRoadmapOverride({ sessionNumber: 3, title: "Buổi 3" }), "tiêu đề mặc định = chưa ghi đè");
    expectTrue(!isRealRoadmapOverride({ sessionNumber: 3, title: "" }), "để trống = chưa ghi đè");
    expectTrue(isRealRoadmapOverride({ sessionNumber: 3, title: "Unit 2" }), "đổi tiêu đề = ghi đè");
    expectTrue(
      isRealRoadmapOverride({ sessionNumber: 3, title: "Buổi 3", objective: "Ôn tập" }),
      "có nội dung khác = ghi đè dù tiêu đề mặc định",
    );
  });

  // ---------------------------------------------------------------- 2
  await test("Lớp không ghi đè thì lấy nguyên tiến trình của khóa", async () => {
    const { cls, courseId } = await seedCourseClass();
    await db.courseRoadmapItem.createMany({
      data: [
        { courseId, sessionNumber: 1, title: "Unit 1 - Hello", objective: "Chào hỏi" },
        { courseId, sessionNumber: 2, title: "Unit 1 - Numbers" },
      ],
    });

    const items = await resolveClassRoadmap(db, cls.id);
    expectEqual(items[0]?.title, "Unit 1 - Hello", "buổi 1 theo khóa");
    expectEqual(items[0]?.objective, "Chào hỏi", "mục tiêu theo khóa");
    expectEqual(items[0]?.source, "course", "nguồn là khóa");
    expectEqual(items[1]?.title, "Unit 1 - Numbers", "buổi 2 theo khóa");
    // Buổi khóa chưa soạn vẫn phải có dòng, không được mất buổi.
    expectEqual(items.length, 4, "đủ 4 buổi theo tổng số buổi của lớp");
    expectEqual(items[2]?.title, "Buổi 3", "buổi khóa chưa soạn hiện tiêu đề mặc định");
    expectEqual(items[2]?.source, "empty", "nguồn trống");
  });

  // ---------------------------------------------------------------- 3
  await test("Lớp ghi đè buổi nào thì chỉ buổi đó khác, buổi khác vẫn theo khóa", async () => {
    const { cls, courseId } = await seedCourseClass();
    await db.courseRoadmapItem.createMany({
      data: [
        { courseId, sessionNumber: 1, title: "Unit 1 - Hello" },
        { courseId, sessionNumber: 2, title: "Unit 1 - Numbers" },
      ],
    });
    await db.classRoadmapItem.create({
      data: { classId: cls.id, sessionNumber: 2, title: "Unit 1 - Numbers + ôn thêm" },
    });

    const items = await resolveClassRoadmap(db, cls.id);
    expectEqual(items[0]?.title, "Unit 1 - Hello", "buổi 1 vẫn theo khóa");
    expectEqual(items[0]?.source, "course", "buổi 1 nguồn khóa");
    expectEqual(items[1]?.title, "Unit 1 - Numbers + ôn thêm", "buổi 2 lấy bản ghi đè của lớp");
    expectEqual(items[1]?.source, "class", "buổi 2 nguồn lớp");
  });

  // ---------------------------------------------------------------- 4
  // Đây là ca quan trọng nhất khi nâng cấp: lớp cũ có đủ dòng ClassRoadmapItem cho MỌI
  // buổi, phần lớn là dòng trống mặc định. Dòng trống đó KHÔNG được che mất tiến trình
  // của khóa, nếu không gắn khóa vào lớp cũ sẽ chẳng thấy gì.
  await test("Dòng trống mặc định của lớp cũ không che mất tiến trình khóa", async () => {
    const { cls, courseId } = await seedCourseClass();
    await db.courseRoadmapItem.create({ data: { courseId, sessionNumber: 1, title: "Unit 1 - Hello" } });
    await db.classRoadmapItem.createMany({
      data: [
        { classId: cls.id, sessionNumber: 1, title: "Buổi 1" },
        { classId: cls.id, sessionNumber: 2, title: "Buổi 2" },
      ],
    });

    const items = await resolveClassRoadmap(db, cls.id);
    expectEqual(items[0]?.title, "Unit 1 - Hello", "buổi 1 vẫn lấy của khóa");
    expectEqual(items[0]?.source, "course", "dòng trống không tính là ghi đè");
  });

  // ---------------------------------------------------------------- 5
  await test("Lớp có tiến trình riêng, chưa gắn khóa: giữ nguyên như trước", async () => {
    const { cls } = await seedCourseClass();
    await db.class.update({ where: { id: cls.id }, data: { courseId: null } });
    await db.classRoadmapItem.create({
      data: { classId: cls.id, sessionNumber: 1, title: "Giáo án riêng của lớp", objective: "Mục tiêu riêng" },
    });

    const items = await resolveClassRoadmap(db, cls.id);
    expectEqual(items[0]?.title, "Giáo án riêng của lớp", "giữ nguyên nội dung cũ");
    expectEqual(items[0]?.objective, "Mục tiêu riêng", "giữ nguyên mục tiêu");
    expectEqual(items[0]?.source, "class", "nguồn lớp");
  });

  // ---------------------------------------------------------------- 6
  await test("Sửa tiến trình khóa thì mọi lớp chưa ghi đè đổi theo", async () => {
    const { cls, courseId, branch } = await seedCourseClass();
    const cls2 = await db.class.create({
      data: {
        branchId: branch.id,
        courseId,
        classCode: "LOP-CHUNG-2",
        className: "Lớp B",
        totalSessions: 4,
        status: "ACTIVE",
      },
    });
    await db.courseRoadmapItem.create({ data: { courseId, sessionNumber: 1, title: "Bản cũ" } });
    await db.classRoadmapItem.create({ data: { classId: cls2.id, sessionNumber: 1, title: "Lớp B tự soạn" } });

    await db.courseRoadmapItem.update({
      where: { courseId_sessionNumber: { courseId, sessionNumber: 1 } },
      data: { title: "Bản mới" },
    });

    const a = await resolveClassRoadmap(db, cls.id);
    const b = await resolveClassRoadmap(db, cls2.id);
    expectEqual(a[0]?.title, "Bản mới", "lớp A chưa ghi đè → đổi theo khóa");
    expectEqual(b[0]?.title, "Lớp B tự soạn", "lớp B đã ghi đè → không bị đổi");
  });

  // ----------------------------------------------- CẢNH BÁO CHUYÊN MÔN (Gói 3)
  await test("Mức cảnh báo chỉ nhận 3 giá trị, rác thì coi như không cảnh báo", async () => {
    expectEqual(normalizeAlertLevel("RED"), "RED", "đỏ");
    expectEqual(normalizeAlertLevel("yellow"), "YELLOW", "vàng viết thường");
    expectEqual(normalizeAlertLevel("TIM"), "NONE", "giá trị lạ");
    expectEqual(normalizeAlertLevel(null), "NONE", "để trống");
  });

  await test("Cảnh báo của khóa chảy xuống mọi lớp dùng chung", async () => {
    const { cls, courseId } = await seedCourseClass();
    await db.courseRoadmapItem.createMany({
      data: [
        { courseId, sessionNumber: 1, title: "Presentation", alertLevel: "YELLOW", teacherRequirement: "Chuẩn bị slide cho HS" },
        { courseId, sessionNumber: 2, title: "Hạn trả kết quả", alertLevel: "RED" },
      ],
    });
    const items = await resolveClassRoadmap(db, cls.id);
    expectEqual(items[0]?.alertLevel, "YELLOW", "buổi 1 vàng");
    expectEqual(items[0]?.teacherRequirement, "Chuẩn bị slide cho HS", "kèm nội dung việc cần làm");
    expectEqual(items[1]?.alertLevel, "RED", "buổi 2 đỏ");
    expectEqual(items[2]?.alertLevel, "NONE", "buổi không khai thì không cảnh báo");
  });

  // Bật cảnh báo mà chưa điền nội dung vẫn phải là một quyết định thật của lớp, không
  // được coi là dòng trống rồi bị tiến trình khóa đè lên.
  await test("Lớp bật cảnh báo riêng dù chưa điền nội dung vẫn được giữ", async () => {
    const { cls, courseId } = await seedCourseClass();
    await db.courseRoadmapItem.create({ data: { courseId, sessionNumber: 1, title: "Bài thường", alertLevel: "NONE" } });
    await db.classRoadmapItem.create({ data: { classId: cls.id, sessionNumber: 1, title: "Buổi 1", alertLevel: "RED" } });

    const items = await resolveClassRoadmap(db, cls.id);
    expectEqual(items[0]?.alertLevel, "RED", "giữ cảnh báo của lớp");
    expectEqual(items[0]?.source, "class", "tính là lớp ghi đè");
  });

  const failed = summary();
  await db.$disconnect();
  await sharedClient.$disconnect();
  dropTestDatabase();
  process.exit(failed ? 1 : 0);
}

main();
