// Chi tiết đối soát của mỗi lần chấm điểm trợ giảng/giáo viên. Chạy: npm run test:scoredetail
//
// Yêu cầu của trung tâm: khi nhân sự thắc mắc "sao em bị trừ điểm", người quản lý phải
// trả lời được ngay lỗi xảy ra lúc nào, ở lớp nào, hạn là khi nào, thực tế làm lúc nào,
// CHẬM BAO LÂU và đã khắc phục lúc nào. Bộ test này khóa phần tính "chậm bao lâu".
import { test, expectEqual, summary } from "./harness";
import { computeLateness, describeScoreEvent } from "@/lib/score-event-detail";

async function main() {
  console.log("Test chi tiết đối soát điểm trợ giảng:\n");

  await test("Nhật ký lớp phải gửi trước 9h sáng hôm sau, gửi lúc 11h30 → chậm 2 giờ 30 phút", async () => {
    const r = computeLateness({ dueAt: "2026-09-18T09:00:00", completedAt: "2026-09-18T11:30:00" });
    expectEqual(r.minutes, 150, "150 phút");
    expectEqual(r.label, "chậm 2 giờ 30 phút", r.label);
  });

  await test("Chậm nhiều ngày thì nói theo ngày + giờ, không kể lẻ phút", async () => {
    const r = computeLateness({ dueAt: "2026-09-10T09:00:00", completedAt: "2026-09-13T14:47:00" });
    expectEqual(r.label, "chậm 3 ngày 5 giờ", r.label);
  });

  await test("Làm trước hạn hoặc đúng hạn → ghi rõ đúng hạn, không phải chậm", async () => {
    expectEqual(computeLateness({ dueAt: "2026-09-18T09:00:00", completedAt: "2026-09-18T08:00:00" }).label, "đúng hạn", "làm sớm");
    expectEqual(computeLateness({ dueAt: "2026-09-18T09:00:00", completedAt: "2026-09-18T09:00:00" }).minutes, 0, "đúng phút hạn");
  });

  await test("Thiếu mốc thì không bịa ra con số", async () => {
    expectEqual(computeLateness({ dueAt: "2026-09-18T09:00:00", completedAt: null }).minutes, null, "chưa biết làm lúc nào");
    expectEqual(computeLateness({ dueAt: null, completedAt: "2026-09-18T09:00:00" }).label, "", "chưa có hạn");
    expectEqual(computeLateness({ dueAt: "sai định dạng", completedAt: "2026-09-18T09:00:00" }).minutes, null, "dữ liệu hỏng");
  });

  await test("Câu tóm tắt đủ để đọc cho nhân sự nghe", async () => {
    const text = describeScoreEvent({
      occurredAt: "2026-09-18T20:15:00",
      eventDate: "2026-09-18",
      className: "Everybody Up 5 - E1",
      dueAt: "2026-09-19T09:00:00",
      completedAt: "2026-09-19T15:00:00",
      resolvedAt: "2026-09-19T15:30:00",
    });
    expectEqual(text.includes("lớp Everybody Up 5 - E1"), true, text);
    expectEqual(text.includes("chậm 6 giờ"), true, text);
    expectEqual(text.includes("đã khắc phục"), true, text);
  });

  const failed = summary();
  if (failed > 0) process.exit(1);
}

main();
