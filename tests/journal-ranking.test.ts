import { computeJournalRankings, formatJournalAverage } from "@/lib/journal-ranking";
import { expectEqual, summary, test } from "./harness";

async function main() {
  console.log("Chạy test xếp hạng nhật ký lớp:");

  await test("Tính trung bình theo thang 10 từ nhiều cột điểm", async () => {
    const [row] = computeJournalRankings([
      { studentId: "s1", scores: [{ score: 8 }, { score: 14, maxScore: 20 }, { score: null }] },
    ]);
    expectEqual(row.average, 7.5, "TB quy đổi thang 10");
    expectEqual(row.scoredCount, 2, "chỉ đếm cột có điểm hợp lệ");
  });

  await test("Xếp hạng cao xuống thấp và đồng hạng", async () => {
    const rows = computeJournalRankings([
      { studentId: "a", scores: [{ score: 9 }] },
      { studentId: "b", scores: [{ score: 8 }] },
      { studentId: "c", scores: [{ score: 8 }] },
      { studentId: "d", scores: [{ score: 6 }] },
    ]);
    expectEqual(rows.find((item) => item.studentId === "a")?.rank, 1, "hạng cao nhất");
    expectEqual(rows.find((item) => item.studentId === "b")?.rank, 2, "đồng hạng 2");
    expectEqual(rows.find((item) => item.studentId === "c")?.rank, 2, "đồng hạng 2");
    expectEqual(rows.find((item) => item.studentId === "d")?.rank, 4, "hạng sau đồng hạng");
  });

  await test("Không có điểm thì không xếp hạng", async () => {
    const rows = computeJournalRankings([
      { studentId: "empty", scores: [{ score: null }] },
      { studentId: "bad", scores: [{ score: 12, maxScore: 10 }] },
      { studentId: "ok", scores: [{ score: 7 }] },
    ]);
    expectEqual(rows.find((item) => item.studentId === "empty")?.rank, null, "trống không có hạng");
    expectEqual(rows.find((item) => item.studentId === "bad")?.average, null, "điểm sai thang bị bỏ qua");
    expectEqual(rows.find((item) => item.studentId === "ok")?.rank, 1, "học viên có điểm vẫn hạng 1");
  });

  await test("Format trung bình gọn cho giao diện", async () => {
    expectEqual(formatJournalAverage(8), "8", "số nguyên không ép .0");
    expectEqual(formatJournalAverage(8.5), "8,5", "số lẻ dùng chuẩn vi-VN");
    expectEqual(formatJournalAverage(null), "", "không có điểm để trống");
  });

  process.exitCode = summary();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
