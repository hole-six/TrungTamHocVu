// Test chiết khấu khi thu tiền mặt. Chạy: npm run test:discount
//
// Quy tắc: "giảm x% cho phụ huynh đóng tiền mặt" = phụ huynh trả (100 − x)% của khoản nợ
// được xóa. Bộ test này khóa lại đúng các ca đã tính SAI trước đây.
import { test, expectEqual, summary } from "./harness";
import { computeCashDiscount, computeCashDiscountForTuitionOnly } from "@/lib/cash-discount";

async function main() {
  console.log("Test chiết khấu thu tiền mặt:\n");
  const DEBT = 3_775_000;

  await test("Nợ 3.775.000đ, giảm 3%: thu 3.661.750đ là hết sạch nợ", async () => {
    const r = computeCashDiscount({ cash: 3_661_750, percent: 3, outstanding: DEBT });
    expectEqual(r.cashToClearAll, 3_661_750, "gợi ý thu 97% số nợ");
    expectEqual(r.discountAmount, 113_250, "giảm đúng 3% của 3.775.000đ");
    expectEqual(r.settledAmount, DEBT, "xóa đúng số nợ, không hơn");
    expectEqual(r.remainingDebt, 0, "hết nợ");
    expectEqual(r.advanceAmount, 0, "không dư");
  });

  await test("Không bao giờ xóa nợ nhiều hơn số đang nợ (ca sai trong ảnh)", async () => {
    // Trước đây: gõ đúng số nợ + 3% → màn hình báo xóa nợ 3.888.250đ rồi API chặn.
    const r = computeCashDiscount({ cash: DEBT, percent: 3, outstanding: DEBT });
    expectEqual(r.settledAmount, DEBT, "xóa tối đa bằng số nợ");
    expectEqual(r.remainingDebt, 0, "hết nợ");
    expectEqual(r.cashForDebt, 3_661_750, "chỉ cần 3.661.750đ để trả nợ");
    expectEqual(r.advanceAmount, 113_250, "phần thu thừa thành tiền đóng trước, không nhân chiết khấu");
    expectEqual(r.discountAmount, 113_250, "chiết khấu vẫn đúng 3% của khoản nợ");
  });

  await test("Đóng một phần: chiết khấu tính trên đúng phần nợ được xóa", async () => {
    const r = computeCashDiscount({ cash: 1_940_000, percent: 3, outstanding: DEBT });
    expectEqual(r.settledAmount, 2_000_000, "1.940.000đ tiền mặt xóa được 2.000.000đ nợ");
    expectEqual(r.discountAmount, 60_000, "giảm 3% của 2.000.000đ");
    expectEqual(r.remainingDebt, 1_775_000, "còn nợ phần chưa đóng");
    expectEqual(r.advanceAmount, 0, "chưa đóng dư");
  });

  await test("Không chiết khấu: giữ nguyên cách thu cũ", async () => {
    const r = computeCashDiscount({ cash: 2_000_000, percent: 0, outstanding: DEBT });
    expectEqual(r.discountAmount, 0, "không giảm");
    expectEqual(r.settledAmount, 2_000_000, "xóa đúng số tiền mặt");
    expectEqual(r.remainingDebt, 1_775_000, "còn nợ");
    const over = computeCashDiscount({ cash: 4_000_000, percent: 0, outstanding: DEBT });
    expectEqual(over.settledAmount, DEBT, "thu vượt thì chỉ xóa hết nợ");
    expectEqual(over.advanceAmount, 225_000, "phần vượt là tiền đóng trước");
  });

  await test("Học phí 340k + sách 600k, giảm 3%: chỉ giảm tiền học, sách thu đủ", async () => {
    const r = computeCashDiscountForTuitionOnly({
      cash: 929_800,
      percent: 3,
      tuitionOutstanding: 340_000,
      materialsOutstanding: 600_000,
    });
    expectEqual(r.materialsCash, 600_000, "sách thu đủ 600.000đ");
    expectEqual(r.tuitionCash, 329_800, "tiền học thu 97% của 340.000đ");
    expectEqual(r.discountAmount, 10_200, "giảm đúng 3% tiền học");
    expectEqual(r.settledAmount, 940_000, "xóa đủ tổng nợ học + sách");
    expectEqual(r.remainingDebt, 0, "hết nợ");
  });

  await test("Học viên không còn nợ: mọi khoản thu là đóng trước, không có chiết khấu", async () => {
    const r = computeCashDiscount({ cash: 1_000_000, percent: 5, outstanding: 0 });
    expectEqual(r.discountAmount, 0, "không có nợ thì không giảm được gì");
    expectEqual(r.advanceAmount, 1_000_000, "toàn bộ là đóng trước");
    expectEqual(r.settledAmount, 0, "không xóa nợ nào");
  });

  await test("Trần 10% và số phần trăm không hợp lệ", async () => {
    const capped = computeCashDiscount({ cash: 900_000, percent: 30, outstanding: 1_000_000 });
    expectEqual(capped.discountAmount, 100_000, "quá 10% thì tính đúng trần 10%");
    expectEqual(capped.settledAmount, 1_000_000, "thu 900.000đ là hết nợ 1.000.000đ");
    const weird = computeCashDiscount({ cash: 500_000, percent: Number.NaN, outstanding: 1_000_000 });
    expectEqual(weird.discountAmount, 0, "phần trăm không hợp lệ coi như không giảm");
  });

  await test("Tiền mặt + chiết khấu luôn bằng đúng phần nợ được xóa", async () => {
    for (const cash of [100_000, 1_234_567, 3_000_000, 3_661_749, 3_661_750]) {
      for (const percent of [1, 3, 5.5, 10]) {
        const r = computeCashDiscount({ cash, percent, outstanding: DEBT });
        expectEqual(r.cashForDebt + r.discountAmount, r.settledAmount, `thu ${cash} giảm ${percent}%`);
        expectEqual(r.settledAmount + r.remainingDebt, DEBT, `tổng nợ khớp khi thu ${cash} giảm ${percent}%`);
      }
    }
  });

  const failed = summary();
  if (failed > 0) process.exit(1);
}

main();
