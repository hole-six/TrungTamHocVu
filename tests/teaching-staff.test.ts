// Test tự động: AI ĐƯỢC XẾP VÀO BUỔI HỌC. Chạy: npm run test:staffpick
//
// Ô chọn người ở thời khoá biểu từng đổ ra toàn bộ nhân sự (kế toán, lễ tân, BGĐ) — xếp
// nhầm là người đó vào thẳng bảng lương của buổi.
import { test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  const { isTeachingStaff, filterTeachingStaff } = await import("@/lib/assignment-roles");
  console.log("Chạy test lọc người xếp lớp:\n");

  await test("Nhận đúng giáo viên và trợ giảng, bỏ các vị trí khác", async () => {
    expectTrue(isTeachingStaff("Giáo viên"), "Giáo viên");
    expectTrue(isTeachingStaff("giao vien"), "không dấu");
    expectTrue(isTeachingStaff("GIÁO VIÊN TIẾNG ANH"), "viết hoa, có hậu tố");
    expectTrue(isTeachingStaff("Trợ giảng"), "Trợ giảng");
    expectTrue(!isTeachingStaff("Kế toán"), "Kế toán");
    expectTrue(!isTeachingStaff("Ban Giám Đốc"), "Ban Giám Đốc");
    expectTrue(!isTeachingStaff("Giáo vụ"), "Giáo vụ — không đứng lớp");
    expectTrue(!isTeachingStaff(null), "chưa khai vị trí");
  });

  await test("Lọc danh sách chỉ còn người đứng lớp", async () => {
    const list = [
      { id: "1", position: "Giáo viên" },
      { id: "2", position: "Kế toán" },
      { id: "3", position: "Trợ giảng" },
      { id: "4", position: "Lễ tân" },
    ];
    expectEqual(filterTeachingStaff(list).map((item) => item.id).join(","), "1,3", "chỉ còn GV và TG");
  });

  // Dữ liệu thiếu không được làm màn hình hỏng: không ai khai vị trí thì vẫn phải xếp
  // được người, nếu không giáo vụ ngồi nhìn ô chọn trống.
  await test("Chưa ai khai vị trí thì vẫn trả lại đủ danh sách", async () => {
    const list = [
      { id: "1", position: null },
      { id: "2", position: "" },
    ];
    expectEqual(filterTeachingStaff(list).length, 2, "giữ nguyên 2 người");
  });

  const failed = summary();
  process.exit(failed ? 1 : 0);
}

main();
