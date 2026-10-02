// Test tự động: KHOẢNG THỜI GIAN DÙNG CHUNG. Chạy: npm run test:period
//
// Thanh chọn thời gian này dùng cho TOÀN hệ thống (lịch, bảng điều hành, chấm công, học
// phí...). Tính sai một ngày là mọi màn hình lệch theo, nên các ca khó của ISO 8601 —
// giao thừa, năm 53 tuần, tuần vắt qua hai năm — phải được khóa lại ở đây.
import { test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  const {
    isoWeekNumber,
    isoWeekYear,
    isoWeeksInYear,
    startOfIsoWeek,
    weekKey,
    parseWeekKey,
    parseMonthKey,
    resolvePeriod,
    currentKey,
  } = await import("@/lib/period-range");

  const day = (iso: string) => new Date(iso + "T00:00:00.000Z");
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  console.log("Chạy test khoảng thời gian dùng chung:\n");

  await test("Tuần bắt đầu Thứ Hai", async () => {
    expectEqual(ymd(startOfIsoWeek(day("2026-10-02"))), "2026-09-28", "Thứ Sáu 2/10 → Thứ Hai 28/9");
    expectEqual(ymd(startOfIsoWeek(day("2026-09-28"))), "2026-09-28", "chính Thứ Hai");
    expectEqual(ymd(startOfIsoWeek(day("2026-10-04"))), "2026-09-28", "Chủ Nhật vẫn thuộc tuần trước đó");
  });

  await test("Số tuần trong năm tính theo ISO 8601", async () => {
    expectEqual(isoWeekNumber(day("2026-01-01")), 1, "1/1/2026 là tuần 1");
    expectEqual(isoWeekNumber(day("2026-10-02")), 40, "2/10/2026 là tuần 40");
    expectEqual(isoWeekNumber(day("2026-12-31")), 53, "31/12/2026 là tuần 53");
  });

  // Ca kinh điển: ngày đầu năm dương lịch vẫn thuộc tuần CUỐI của năm trước.
  await test("Tuần vắt qua hai năm tính đúng năm của tuần", async () => {
    expectEqual(isoWeekNumber(day("2027-01-01")), 53, "1/1/2027 nằm trong tuần 53");
    expectEqual(isoWeekYear(day("2027-01-01")), 2026, "tuần đó thuộc năm 2026");
    expectEqual(weekKey(day("2027-01-01")), "2026-W53", "khoá tuần");
  });

  await test("Năm 52 tuần và năm 53 tuần", async () => {
    expectEqual(isoWeeksInYear(2026), 53, "2026 có 53 tuần");
    expectEqual(isoWeeksInYear(2025), 52, "2025 có 52 tuần");
  });

  await test("Đọc khoá tuần, và chấp nhận đường dẫn cũ dạng ngày", async () => {
    expectEqual(ymd(parseWeekKey("2026-W40")), "2026-09-28", "dạng chuẩn");
    expectEqual(ymd(parseWeekKey("2026-09-30")), "2026-09-28", "dạng cũ của màn lịch");
    expectEqual(ymd(parseWeekKey("2026-W01")), "2025-12-29", "tuần 1/2026 bắt đầu từ 29/12/2025");
    expectEqual(ymd(parseWeekKey("rác", day("2026-10-02"))), "2026-09-28", "giá trị sai → tuần hiện tại");
    expectEqual(ymd(parseWeekKey(null, day("2026-10-02"))), "2026-09-28", "không truyền → tuần hiện tại");
  });

  await test("Đọc khoá tháng", async () => {
    expectEqual(ymd(parseMonthKey("2026-10")), "2026-10-01", "tháng 10");
    expectEqual(ymd(parseMonthKey("2026-13", day("2026-10-02"))), "2026-10-01", "tháng sai → tháng hiện tại");
  });

  await test("Khoảng tuần: đầu cuối, nhãn, tuần trước và tuần sau", async () => {
    const p = resolvePeriod({ mode: "week", week: "2026-W40" }, day("2026-10-02"));
    expectEqual(ymd(p.start), "2026-09-28", "đầu tuần");
    expectEqual(ymd(p.end), "2026-10-04", "cuối tuần");
    expectEqual(p.end.getUTCHours(), 23, "cuối tuần lấy hết ngày");
    expectEqual(p.label, "Tuần 40/2026", "nhãn");
    expectEqual(p.rangeLabel, "28/09 – 04/10/2026", "khoảng ngày");
    expectEqual(p.prevKey, "2026-W39", "tuần trước");
    expectEqual(p.nextKey, "2026-W41", "tuần sau");
    expectEqual(p.weeksInYear, 53, "số tuần của năm");
    expectTrue(p.isCurrent, "tuần chứa hôm nay");
  });

  await test("Sang tuần mới qua ranh giới năm không nhảy lung tung", async () => {
    const p = resolvePeriod({ mode: "week", week: "2026-W53" }, day("2026-10-02"));
    expectEqual(p.nextKey, "2027-W01", "sau tuần 53/2026 là tuần 1/2027");
    const q = resolvePeriod({ mode: "week", week: "2027-W01" }, day("2026-10-02"));
    expectEqual(q.prevKey, "2026-W53", "lùi lại đúng tuần 53");
  });

  await test("Khoảng tháng: đầu cuối, nhãn, tháng trước và tháng sau", async () => {
    const p = resolvePeriod({ mode: "month", month: "2026-01" }, day("2026-10-02"));
    expectEqual(ymd(p.start), "2026-01-01", "đầu tháng");
    expectEqual(ymd(p.end), "2026-01-31", "cuối tháng");
    expectEqual(p.label, "Tháng 1/2026", "nhãn");
    expectEqual(p.prevKey, "2025-12", "tháng trước vắt sang năm cũ");
    expectEqual(p.nextKey, "2026-02", "tháng sau");
    expectTrue(!p.isCurrent, "không phải tháng hiện tại");
  });

  await test("Tháng 2 năm nhuận lấy đủ 29 ngày", async () => {
    const p = resolvePeriod({ mode: "month", month: "2028-02" }, day("2026-10-02"));
    expectEqual(ymd(p.end), "2028-02-29", "29/2/2028");
  });

  await test("Nút Tuần này / Tháng này lấy đúng mốc hôm nay", async () => {
    expectEqual(currentKey("week", day("2026-10-02")), "2026-W40", "tuần này");
    expectEqual(currentKey("month", day("2026-10-02")), "2026-10", "tháng này");
  });

  const failed = summary();
  process.exit(failed ? 1 : 0);
}

main();
