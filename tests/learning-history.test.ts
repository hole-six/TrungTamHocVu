// Test tự động cho LỊCH SỬ HỌC TẬP & ĐIỂM NHẬT KÝ. Chạy: npm run test:history
//
// Điểm trung bình là con số báo tiến bộ cho phụ huynh, nên cách tính phải khóa lại:
// điểm buổi = trung bình các cột quy về thang 10; điểm TB = trung bình các buổi có điểm;
// buổi vắng/chưa có điểm không tính là 0; điểm nhập sai (vượt thang) không được tính.
import { createTestDatabase, dropTestDatabase, test, expectEqual, summary } from "./harness";
import { seedBranch, seedClass, seedStudent, seedEnrollment, seedSession } from "./fixtures";
import { getStudentLearningHistory } from "@/lib/server/learning-history";

async function main() {
  const db = createTestDatabase();
  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  console.log("Chạy test lịch sử học tập trên CSDL riêng (prisma/test.db):\n");

  async function scoreSession(sessionId: string, studentId: string, scores: { label: string; score: number; maxScore?: number }[]) {
    const journal = await db.classSessionJournal.create({ data: { sessionId } });
    await db.journalEntry.create({
      data: {
        journalId: journal.id,
        studentId,
        scores: { create: scores.map((item) => ({ label: item.label, score: item.score, maxScore: item.maxScore ?? 10 })) },
      },
    });
  }

  const branch = await seedBranch(db);
  const cls = await seedClass(db, branch.id);
  const student = await seedStudent(db, branch.id, "Học viên có điểm");
  await seedEnrollment(db, { studentId: student.id, classId: cls.id, billingModel: "PERIOD", enrollDate: day("2026-01-01") });

  const s1 = await seedSession(db, cls.id, day("2026-02-02"), "COMPLETED");
  const s2 = await seedSession(db, cls.id, day("2026-02-04"), "COMPLETED");
  const s3 = await seedSession(db, cls.id, day("2026-02-06"), "COMPLETED");
  const s4 = await seedSession(db, cls.id, day("2026-02-09"), "COMPLETED");
  const s5 = await seedSession(db, cls.id, day("2026-02-11"), "COMPLETED");

  await db.studentAttendance.createMany({
    data: [s1, s2, s3, s4, s5].map((s, index) => ({
      sessionId: s.id,
      studentId: student.id,
      status: index === 2 ? "ABSENT" : "PRESENT",
    })),
  });

  await scoreSession(s1.id, student.id, [{ label: "Vấn đáp", score: 6 }, { label: "Minitest từ", score: 7 }]); // 6,5
  await scoreSession(s2.id, student.id, [{ label: "Vấn đáp", score: 8 }, { label: "Bài viết", score: 14, maxScore: 20 }]); // (8 + 7)/2 = 7,5
  // s3: vắng, không có điểm
  await scoreSession(s4.id, student.id, [{ label: "Vấn đáp", score: 9 }, { label: "Minitest từ", score: 123 }]); // 123/10 sai → chỉ tính 9
  await scoreSession(s5.id, student.id, [{ label: "Vấn đáp", score: 8.5 }]); // 8,5

  const history = await getStudentLearningHistory(db, student.id, { page: 1, pageSize: 10 });
  const byDate = new Map(history.items.map((item) => [item.sessionDate, item]));

  await test("Điểm buổi = trung bình các cột, mỗi cột quy về thang 10", async () => {
    expectEqual(byDate.get("2026-02-02")?.sessionScore, 6.5, "buổi 02/02 (6 và 7)");
    expectEqual(byDate.get("2026-02-04")?.sessionScore, 7.5, "buổi 04/02 (8/10 và 14/20)");
  });

  await test("Buổi vắng / chưa có điểm KHÔNG tính là 0", async () => {
    expectEqual(byDate.get("2026-02-06")?.sessionScore, null, "buổi vắng không có điểm");
    expectEqual(history.summary.totalSessions, 5, "vẫn đủ 5 buổi trong lịch sử");
    expectEqual(history.summary.scoredSessions, 4, "chỉ 4 buổi có điểm");
  });

  await test("Điểm nhập sai (vượt thang) hiện ra nhưng không được tính", async () => {
    const item = byDate.get("2026-02-09");
    expectEqual(item?.sessionScore, 9, "buổi 09/02 chỉ tính Vấn đáp 9, bỏ Minitest 123/10");
    expectEqual(item?.scores.find((score) => score.label === "Minitest từ")?.invalid, true, "cột 123/10 bị đánh dấu sai");
  });

  await test("Điểm trung bình = trung bình các buổi có điểm, và dãy tiến bộ đúng thứ tự", async () => {
    // (6,5 + 7,5 + 9 + 8,5) / 4 = 7,875 → 7,9
    expectEqual(history.summary.averageScore, 7.9, "điểm trung bình");
    expectEqual(history.progression.map((item) => item.score).join(" → "), "6.5 → 7.5 → 9 → 8.5", "dãy điểm cũ → mới");
    expectEqual(byDate.get("2026-02-09")?.deltaFromPrevious, 1.5, "buổi 09/02 so với buổi CÓ ĐIỂM liền trước (04/02), bỏ qua buổi vắng");
    expectEqual(byDate.get("2026-02-11")?.deltaFromPrevious, -0.5, "buổi 11/02 giảm 0,5");
  });

  await test("Phân trang 10 buổi, mới nhất trước", async () => {
    const extra = await seedStudent(db, branch.id, "Nhiều buổi");
    for (let index = 1; index <= 12; index += 1) {
      const s = await seedSession(db, cls.id, day(`2026-03-${String(index).padStart(2, "0")}`), "COMPLETED");
      await db.studentAttendance.create({ data: { sessionId: s.id, studentId: extra.id, status: "PRESENT" } });
    }
    const page1 = await getStudentLearningHistory(db, extra.id, { page: 1, pageSize: 10 });
    const page2 = await getStudentLearningHistory(db, extra.id, { page: 2, pageSize: 10 });
    expectEqual(page1.totalPages, 2, "12 buổi thành 2 trang");
    expectEqual(page1.items.length, 10, "trang 1 có 10 buổi");
    expectEqual(page1.items[0]?.sessionDate, "2026-03-12", "trang 1 bắt đầu từ buổi mới nhất");
    expectEqual(page2.items.length, 2, "trang 2 còn 2 buổi");
  });

  const failed = summary();
  await db.$disconnect();
  dropTestDatabase();
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  dropTestDatabase();
  process.exit(1);
});
