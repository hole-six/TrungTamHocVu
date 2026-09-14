// Test tự động cho CHÈN / XÓA / ĐỔI CHỖ buổi trong lộ trình lớp. Chạy: npm run test:roadmap
//
// Nội dung lộ trình nối với buổi học THEO VỊ TRÍ (buổi học thứ k lấy mục thứ k). Chèn sai
// một số thứ tự là toàn bộ nội dung phía sau lệch buổi — giáo viên mở buổi 20 ra thấy bài
// của buổi 19. Mấy phép thử này không cần CSDL: chỉ kiểm các hàm thuần mà form dùng.
import { test, expectEqual, summary } from "./harness";
import {
  buildRoadmapDraft,
  insertRoadmapDraftAt,
  removeRoadmapDraftAt,
  swapRoadmapDrafts,
  type RoadmapDraft,
} from "@/components/classes/ClassRoadmapEditor";

function lesson(sessionNumber: number, title: string): RoadmapDraft {
  return { ...buildRoadmapDraft(sessionNumber), title, objective: `Mục tiêu ${title}` };
}
const titles = (list: RoadmapDraft[]) => list.map((item) => `${item.sessionNumber}:${item.title}`).join(" | ");

async function main() {
  console.log("Chạy test chèn/xóa/đổi chỗ buổi trong lộ trình:\n");

  // ---------------------------------------------------------------- 1
  // Đúng tình huống thật: tới tuần thi học kỳ, chèn 2 buổi ôn thi vào sau buổi 3.
  await test("Chèn 2 buổi ôn thi vào giữa: nội dung phía sau lùi đúng, không mất bài nào", async () => {
    let list = [lesson(1, "Unit 1"), lesson(2, "Unit 2"), lesson(3, "Unit 3"), lesson(4, "Unit 4"), lesson(5, "Unit 5")];
    list = insertRoadmapDraftAt(list, 4);
    list = insertRoadmapDraftAt(list, 5);
    list = list.map((item) => (item.sessionNumber === 4 || item.sessionNumber === 5 ? { ...item, title: "Ôn thi học kỳ" } : item));
    expectEqual(list.length, 7, "tổng số buổi sau khi chèn 2");
    expectEqual(
      titles(list),
      "1:Unit 1 | 2:Unit 2 | 3:Unit 3 | 4:Ôn thi học kỳ | 5:Ôn thi học kỳ | 6:Unit 4 | 7:Unit 5",
      "thứ tự bài",
    );
    // Nội dung đi theo bài, không bị bỏ lại ở số buổi cũ.
    expectEqual(list.find((item) => item.sessionNumber === 6)?.objective, "Mục tiêu Unit 4", "mục tiêu của Unit 4 đi theo bài");
  });

  // ---------------------------------------------------------------- 2
  await test("Xóa một buổi: các buổi sau tiến lên, không trống lỗ giữa chừng", async () => {
    const list = removeRoadmapDraftAt([lesson(1, "Unit 1"), lesson(2, "Unit 2"), lesson(3, "Unit 3"), lesson(4, "Unit 4")], 2);
    expectEqual(titles(list), "1:Unit 1 | 2:Unit 3 | 3:Unit 4", "thứ tự sau khi xóa buổi 2");
    expectEqual(list.map((item) => item.sessionNumber).join(","), "1,2,3", "số thứ tự liền mạch");
  });

  // ---------------------------------------------------------------- 3
  await test("Đổi chỗ hai buổi: chỉ đổi đúng hai buổi đó", async () => {
    const list = swapRoadmapDrafts([lesson(1, "Unit 1"), lesson(2, "Unit 2"), lesson(3, "Unit 3")], 2, 3);
    expectEqual(titles(list), "1:Unit 1 | 2:Unit 3 | 3:Unit 2", "sau khi đổi chỗ buổi 2 và 3");
  });

  // ---------------------------------------------------------------- 4
  // Tên mặc định chứa luôn số thứ tự. Dịch vị trí mà giữ nguyên chữ thì buổi 3 lại mang tên
  // "Buổi 2" — vừa sai, vừa bị hệ thống coi như tên do người soạn tự đặt.
  await test("Tên mặc định 'Buổi N' đổi theo vị trí mới, tên tự đặt thì giữ nguyên", async () => {
    const list = insertRoadmapDraftAt([buildRoadmapDraft(1), buildRoadmapDraft(2), lesson(3, "Kiểm tra giữa kỳ")], 2);
    expectEqual(titles(list), "1:Buổi 1 | 2:Buổi 2 | 3:Buổi 3 | 4:Kiểm tra giữa kỳ", "tên sau khi chèn vào vị trí 2");
  });

  process.exit(summary() > 0 ? 1 : 0);
}

main();
