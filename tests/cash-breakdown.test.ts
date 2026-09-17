// Bóc tách số tiền của phiếu thu ở SỔ QUỸ: 850.000đ gồm học phí bao nhiêu, sách bao nhiêu.
// Chạy: npm run test:breakdown
//
// Yêu cầu của trung tâm: soát sổ quỹ phải đọc được ngay tiền này là của cái gì. Điều
// quan trọng nhất về mặt tiền: các phần cộng lại PHẢI đúng bằng số tiền đã thu, không
// được lệch dù 1đ do làm tròn.
import { test, expectEqual, summary, vnd } from "./harness";
import { splitPaymentAmount } from "@/lib/server/cash-breakdown";

async function main() {
  console.log("Test bóc tách số tiền phiếu thu:\n");

  await test("Phiếu có cả học phí và tiền sách: tách đúng từng phần", async () => {
    const r = splitPaymentAmount(
      [{ amount: 1_516_000, charge: { tuitionAmount: 1_216_000, materialsAmount: 300_000 } }],
      1_516_000,
    );
    expectEqual(r.tuition, 1_216_000, "học phí " + vnd(1_216_000));
    expectEqual(r.materials, 300_000, "sách " + vnd(300_000));
    expectEqual(r.advance, 0, "không có tiền đóng trước");
  });

  await test("Đóng một phần: chia theo đúng tỉ lệ cấu thành của phiếu", async () => {
    // Phiếu 1.000.000đ học phí + 200.000đ sách, phụ huynh mới đóng 600.000đ.
    const r = splitPaymentAmount([{ amount: 600_000, charge: { tuitionAmount: 1_000_000, materialsAmount: 200_000 } }], 600_000);
    expectEqual(r.materials, 100_000, "sách = 600.000 × 200/1.200");
    expectEqual(r.tuition, 500_000, "còn lại là học phí");
    expectEqual(r.tuition + r.materials, 600_000, "tổng khớp số đã thu");
  });

  await test("Thu nhiều hơn phần đã gắn vào phiếu: phần dư là tiền đóng trước", async () => {
    const r = splitPaymentAmount([{ amount: 500_000, charge: { tuitionAmount: 500_000, materialsAmount: 0 } }], 800_000);
    expectEqual(r.tuition, 500_000, "học phí");
    expectEqual(r.materials, 0, "không có sách");
    expectEqual(r.advance, 300_000, "đóng trước " + vnd(300_000));
  });

  await test("Một phiếu thu trả cho nhiều phiếu học phí: cộng dồn từng phần", async () => {
    const r = splitPaymentAmount(
      [
        { amount: 800_000, charge: { tuitionAmount: 800_000, materialsAmount: 0 } },
        { amount: 350_000, charge: { tuitionAmount: 200_000, materialsAmount: 150_000 } },
      ],
      1_150_000,
    );
    expectEqual(r.tuition, 1_000_000, "học phí 2 phiếu cộng lại");
    expectEqual(r.materials, 150_000, "tiền sách");
    expectEqual(r.advance, 0, "không dư");
  });

  await test("Làm tròn không bao giờ làm lệch tổng", async () => {
    for (const amount of [333_333, 1, 7, 999_999, 1_234_567]) {
      for (const [tuition, materials] of [
        [1_000_000, 300_000],
        [777_777, 111_111],
        [1, 2],
        [0, 500_000],
      ] as const) {
        const r = splitPaymentAmount([{ amount, charge: { tuitionAmount: tuition, materialsAmount: materials } }], amount);
        expectEqual(r.tuition + r.materials, amount, `thu ${amount} trên phiếu ${tuition}+${materials}`);
        expectEqual(r.tuition >= 0 && r.materials >= 0, true, "không có phần âm");
      }
    }
  });

  await test("Phiếu thu chưa gắn vào phiếu học phí nào: tất cả là đóng trước", async () => {
    const r = splitPaymentAmount([], 500_000);
    expectEqual(r.tuition, 0, "chưa có học phí");
    expectEqual(r.materials, 0, "chưa có sách");
    expectEqual(r.advance, 500_000, "toàn bộ là đóng trước");
  });

  const failed = summary();
  if (failed > 0) process.exit(1);
}

main();
