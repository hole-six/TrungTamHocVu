// Test quy chế thưởng phạt trợ giảng (áp dụng từ 4/2025). Chạy: npm run test:rating
import { test, expectEqual, summary } from "./harness";
import { computeReminderRatio, shiftTierPoints, suggestBonusPercent } from "@/lib/assistant-rating";

async function main() {
  console.log("Test quy chế thưởng phạt trợ giảng:\n");
  const suggest = (countedShifts: number, reminderCount: number, tripleReported = false) =>
    suggestBonusPercent({ countedShifts, reminderCount, tripleReported }).percent;

  await test("Đúng ví dụ trong quy chế: trợ giảng làm 100 ca", async () => {
    expectEqual(suggest(100, 0), 0.2, "không bị nhắc lần nào → +20%");
    expectEqual(suggest(100, 3), 0.1, "bị nhắc 3 lần (A = 3) → +10%");
    expectEqual(suggest(100, 5), 0.1, "bị nhắc 5 lần (A = 5) → +10%");
    expectEqual(suggest(100, 6), 0, "bị nhắc 6 lần → giữ nguyên lương");
    expectEqual(suggest(100, 9), 0, "bị nhắc 9 lần → giữ nguyên lương");
    expectEqual(suggest(100, 10), -0.05, "bị nhắc 10 lần (A = 10) → −5%");
    expectEqual(suggest(100, 30), -0.05, "bị nhắc rất nhiều → vẫn −5%");
  });

  await test("Tỉ lệ A tính theo số lần nhắc trên tổng số ca", async () => {
    expectEqual(computeReminderRatio(2, 40), 5, "2/40 = 5%");
    expectEqual(computeReminderRatio(0, 20), 0, "không bị nhắc");
    expectEqual(computeReminderRatio(3, 0), null, "chưa có ca nào");
    expectEqual(suggest(20, 1), 0.1, "1/20 = 5% → +10%");
    expectEqual(suggest(20, 2), -0.05, "2/20 = 10% → A ≥ 10 → −5%");
    expectEqual(suggest(40, 3), 0, "3/40 = 7,5% → 5 < A < 10 → giữ nguyên lương");
  });

  await test("Trần +5% khi tổng ca trong khoảng 5 < ca < 15", async () => {
    expectEqual(suggest(10, 0), 0.05, "10 ca, không bị nhắc → trần +5% thay vì +20%");
    expectEqual(suggest(14, 0), 0.05, "14 ca → vẫn trần +5%");
    expectEqual(suggest(15, 0), 0.2, "15 ca → hết trần, +20%");
    expectEqual(suggest(10, 2), -0.05, "10 ca bị nhắc 2 lần (A = 20) → −5%, trần không nâng mức phạt");
  });

  await test("Ít hơn hoặc bằng 5 ca: quy chế chưa quy định → để người phụ trách quyết", async () => {
    expectEqual(suggest(5, 0), null, "5 ca");
    expectEqual(suggest(0, 0), null, "không có ca nào");
    expectEqual(suggestBonusPercent({ countedShifts: 0, reminderCount: 0, tripleReported: false }).ratio, null, "A không tính được");
  });

  await test("Một nội dung bị nhắc ở cả 3 báo cáo → mặc định −10%", async () => {
    expectEqual(suggest(100, 1, true), -0.1, "dù A nhỏ vẫn −10%");
    expectEqual(suggest(10, 0, true), -0.1, "áp cả khi ít ca");
  });

  await test("Điểm cộng theo số ca trong tháng (bảng xét thưởng)", async () => {
    expectEqual(shiftTierPoints(21), 0, "21 ca");
    expectEqual(shiftTierPoints(22), 1, "22 ca → +1");
    expectEqual(shiftTierPoints(26), 1, "26 ca → +1");
    expectEqual(shiftTierPoints(27), 2, "27 ca → +2");
    expectEqual(shiftTierPoints(37), 2, "37 ca → +2");
    expectEqual(shiftTierPoints(38), 3, "trên 37 ca → +3");
  });

  const failed = summary();
  if (failed > 0) process.exit(1);
}

main();
