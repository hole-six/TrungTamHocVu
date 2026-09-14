// Test gợi ý lớp đang học ở trường theo ngày sinh. Chạy: npm run test:grade
import { test, expectEqual, summary } from "./harness";
import { suggestSchoolGrade } from "@/lib/school-grade";

async function main() {
  console.log("Test gợi ý lớp theo ngày sinh:\n");
  // 14/9/2026 giờ VN — năm học 2026–2027 đã bắt đầu.
  const sep2026 = new Date("2026-09-14T03:00:00.000Z");

  await test("Năm học 2026–2027: tròn 6 tuổi trong năm là lớp 1", async () => {
    expectEqual(suggestSchoolGrade("2020-12-31", sep2026)?.value, "Lớp 1", "sinh cuối 2020 vẫn lớp 1 (tính theo năm sinh)");
    expectEqual(suggestSchoolGrade("2020-01-01", sep2026)?.value, "Lớp 1", "sinh đầu 2020");
    expectEqual(suggestSchoolGrade("2016-05-10", sep2026)?.value, "Lớp 5", "sinh 2016");
    expectEqual(suggestSchoolGrade("2015-05-10", sep2026)?.level, "THCS", "sinh 2015 là lớp 6 — THCS");
    expectEqual(suggestSchoolGrade("2010-11-11", sep2026)?.value, "Lớp 11", "sinh 2010");
    expectEqual(suggestSchoolGrade("2009-03-03", sep2026)?.value, "Lớp 12", "sinh 2009");
  });

  await test("Chưa vào lớp 1 / đã xong THPT", async () => {
    expectEqual(suggestSchoolGrade("2021-06-01", sep2026)?.value, "Mầm non", "5 tuổi");
    expectEqual(suggestSchoolGrade("2024-06-01", sep2026)?.value, "Nhà trẻ", "2 tuổi");
    expectEqual(suggestSchoolGrade("2007-06-01", sep2026)?.value, "Đã học xong THPT", "19 tuổi");
    expectEqual(suggestSchoolGrade("2030-01-01", sep2026), null, "ngày sinh tương lai");
    expectEqual(suggestSchoolGrade("", sep2026), null, "chưa nhập");
  });

  await test("Tháng 1–8 vẫn thuộc năm học bắt đầu từ năm trước; hè có câu nhắc lên lớp", async () => {
    const mar2026 = new Date("2026-03-10T03:00:00.000Z");
    expectEqual(suggestSchoolGrade("2019-04-04", mar2026)?.value, "Lớp 1", "tháng 3/2026, sinh 2019 đang lớp 1");
    expectEqual(suggestSchoolGrade("2020-04-04", mar2026)?.value, "Mầm non", "tháng 3/2026, sinh 2020 chưa vào lớp 1");
    const jul2026 = new Date("2026-07-10T03:00:00.000Z");
    const summer = suggestSchoolGrade("2019-04-04", jul2026);
    expectEqual(summer?.value, "Lớp 1", "tháng 7: vừa học xong lớp 1");
    expectEqual(summer?.note, "Đang nghỉ hè: vừa học xong lớp 1, tháng 9 lên lớp 2.", "câu nhắc hè");
    expectEqual(suggestSchoolGrade("2020-04-04", jul2026)?.note, "Đang nghỉ hè: tháng 9 này vào lớp 1.", "hè sắp vào lớp 1");
  });

  await test("Mốc 31/8 → 1/9 tính theo giờ Việt Nam", async () => {
    // 31/8/2026 18:00 UTC = 1/9/2026 01:00 giờ VN → đã sang năm học mới.
    expectEqual(suggestSchoolGrade("2020-02-02", new Date("2026-08-31T18:00:00.000Z"))?.value, "Lớp 1", "sáng 1/9 giờ VN");
    expectEqual(suggestSchoolGrade("2020-02-02", new Date("2026-08-31T10:00:00.000Z"))?.value, "Mầm non", "chiều 31/8 giờ VN");
  });

  const failed = summary();
  if (failed > 0) process.exit(1);
}

main();
