// Test tự động: HỌC VIÊN CẦN CHĂM SÓC. Chạy: npm run test:care
//
// Cột này quyết định ai bị gọi điện cho phụ huynh, nên sai hai chiều đều tệ: bỏ sót em
// đang tụt thì mất học viên, gắn nhầm em đang học tốt thì phụ huynh khó chịu. Bộ này
// khóa lại từng ngưỡng một.
import { test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  const { evaluateStudentCare, describeCare, CARE_THRESHOLDS } = await import("@/lib/server/student-care");

  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  // Danh sách buổi, MỚI NHẤT ĐỨNG TRƯỚC.
  const s = (
    score: number | null,
    homeworkStatus: string | null = "Đủ",
    attendance: string | null = "PRESENT",
    index = 0,
  ) => ({
    sessionId: `s${index}-${score ?? "x"}-${Math.random()}`,
    sessionDate: day("2026-09-01"),
    score,
    homeworkStatus,
    attendance,
  });

  console.log("Chạy test học viên cần chăm sóc:\n");

  await test("Học tốt, nộp bài đủ, đi học đều thì KHÔNG cần chăm sóc", async () => {
    const v = evaluateStudentCare([s(9), s(8.5), s(8), s(9)]);
    expectTrue(!v.needsCare, "không cần chăm sóc");
    expectEqual(v.reasons.length, 0, "không có lý do nào");
    expectEqual(v.recentAverage, 8.5, "trung bình 3 buổi gần nhất: (9+8,5+8)/3");
  });

  await test("Trung bình 3 buổi gần nhất dưới 7 thì cần chăm sóc", async () => {
    const v = evaluateStudentCare([s(5), s(6), s(6.5), s(9)]);
    expectTrue(v.needsCare, "cần chăm sóc");
    expectEqual(v.recentAverage, 5.8, "chỉ tính 3 buổi gần nhất, không kéo buổi cũ vào");
    expectTrue(describeCare(v).includes("TB 3 buổi: 5.8"), "lý do nói rõ số — nhận: " + describeCare(v));
  });

  // Một buổi điểm thấp chưa nói lên gì — chưa đủ buổi thì không kết luận, tránh gắn
  // nhầm mác cho em mới vào lớp.
  await test("Chưa đủ 3 buổi có điểm thì chưa kết luận theo điểm", async () => {
    const v = evaluateStudentCare([s(3), s(4)]);
    expectTrue(!v.reasons.some((r) => r.code === "LOW_AVERAGE"), "không kết luận vội");
    expectEqual(v.recentAverage, 3.5, "vẫn tính trung bình để hiển thị");
  });

  await test("Điểm giảm liên tiếp 3 buổi là dấu hiệu riêng, dù điểm vẫn cao", async () => {
    const v = evaluateStudentCare([s(8), s(9), s(10)]);
    expectTrue(v.needsCare, "cần chăm sóc dù trung bình 9.0");
    expectTrue(
      v.reasons.some((r) => r.code === "FALLING"),
      "bắt được đà đi xuống — nhận: " + describeCare(v),
    );
    expectTrue(!v.reasons.some((r) => r.code === "LOW_AVERAGE"), "không phải vì điểm thấp");
  });

  await test("Điểm nhấp nhô lên xuống thì không tính là đang đi xuống", async () => {
    const v = evaluateStudentCare([s(8), s(7), s(9)]);
    expectTrue(!v.reasons.some((r) => r.code === "FALLING"), "lên xuống thất thường không tính");
  });

  await test("Hai trong ba buổi gần nhất chưa nộp bài", async () => {
    const v = evaluateStudentCare([s(8, "Chưa nộp"), s(8, "Đủ"), s(8, "Chưa nộp"), s(8, "Chưa nộp")]);
    expectTrue(v.needsCare, "cần chăm sóc");
    expectTrue(describeCare(v).includes("2 buổi chưa nộp bài"), "chỉ đếm trong 3 buổi gần nhất — nhận: " + describeCare(v));
  });

  await test("Không có BTVN không phải là chưa nộp bài", async () => {
    const v = evaluateStudentCare([s(8, "Không có BTVN"), s(8, "Không có BTVN"), s(8, "Không có BTVN")]);
    expectTrue(!v.needsCare, "buổi không giao bài thì không trách học viên");
  });

  await test("Vắng 2 trong 4 buổi gần nhất", async () => {
    const v = evaluateStudentCare([s(null, null, "ABSENT"), s(8, "Đủ", "PRESENT"), s(null, null, "ABSENT"), s(8, "Đủ", "PRESENT")]);
    expectTrue(v.needsCare, "cần chăm sóc");
    expectTrue(describeCare(v).includes("Vắng 2/4"), "nói rõ vắng mấy buổi — nhận: " + describeCare(v));
  });

  await test("Nhiều dấu hiệu cùng lúc thì liệt kê đủ, không chỉ một", async () => {
    const v = evaluateStudentCare([s(4, "Chưa nộp"), s(5, "Chưa nộp"), s(6, "Đủ")]);
    expectTrue(v.reasons.length >= 2, "ít nhất 2 lý do — nhận: " + describeCare(v));
    expectTrue(describeCare(v).includes("·"), "các lý do nối nhau bằng dấu chấm giữa");
  });

  await test("Chưa có nhật ký nào thì không kết luận gì", async () => {
    const v = evaluateStudentCare([]);
    expectTrue(!v.needsCare, "không cần chăm sóc");
    expectEqual(v.recentAverage, null, "chưa có điểm");
    expectEqual(v.scoredSessions, 0, "chưa buổi nào chấm điểm");
  });

  await test("Ngưỡng khai báo tách riêng để chỉnh được sau", async () => {
    expectEqual(CARE_THRESHOLDS.lowAverage, 7, "ngưỡng điểm");
    expectEqual(CARE_THRESHOLDS.recentScoreWindow, 3, "số buổi xét điểm");
    expectEqual(CARE_THRESHOLDS.absenceWindow, 4, "số buổi xét điểm danh");
  });

  const failed = summary();
  process.exit(failed ? 1 : 0);
}

main();
