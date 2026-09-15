// Test số thứ tự buổi (nối buổi học với tài liệu). Chạy: npm run test:numbering
import { test, expectEqual, summary } from "./harness";
import { computeSessionNumbers, lastTaughtNumber, type NumberableSession } from "@/lib/session-numbering";

async function main() {
  console.log("Test đánh số buổi theo lộ trình:\n");
  const s = (id: string, date: string, status = "PLANNED", replacesSessionId: string | null = null): NumberableSession => ({
    id, sessionDate: `${date}T00:00:00.000Z`, startTime: "17:30", status, replacesSessionId,
  });
  const numbers = (list: NumberableSession[]) => {
    const { numberById } = computeSessionNumbers(list);
    return list.map((x) => `${x.id}:${numberById.get(x.id) ?? "-"}`).join(" ");
  };

  await test("Lịch bình thường: đánh số theo ngày", async () => {
    expectEqual(numbers([s("c", "2026-09-10"), s("a", "2026-09-03"), s("b", "2026-09-07")]), "c:3 a:1 b:2", "theo ngày");
  });

  await test("TRUNG TÂM CHO NGHỈ: buổi nghỉ không có số, các buổi sau dồn lên học tài liệu buổi nghỉ", async () => {
    const list = [s("b1", "2026-09-01", "COMPLETED"), s("b2", "2026-09-03", "CANCELLED"), s("b3", "2026-09-08"), s("b4", "2026-09-10")];
    expectEqual(numbers(list), "b1:1 b2:- b3:2 b4:3", "b3 học tài liệu buổi 2, b4 học buổi 3");
  });

  await test("DỜI LỊCH sang SAU buổi kế tiếp: buổi bù giữ số của buổi gốc, buổi khác không đổi", async () => {
    // Buổi 2 (3/9) dời sang 9/9 — sau buổi 3 (8/9).
    const list = [s("b1", "2026-09-01"), s("b2", "2026-09-03", "RESCHEDULED"), s("b3", "2026-09-08"), s("bu", "2026-09-09", "PLANNED", "b2"), s("b4", "2026-09-10")];
    expectEqual(numbers(list), "b1:1 b2:- b3:3 bu:2 b4:4", "buổi bù ngày 9/9 vẫn là buổi 2");
    expectEqual(computeSessionNumbers(list).movedNumberById.get("b2"), 2, "buổi gốc ghi nhận đã chuyển số 2 sang buổi bù");
  });

  await test("Dời lịch sang TRƯỚC: buổi bù vẫn giữ số buổi gốc", async () => {
    const list = [s("b1", "2026-09-01"), s("bu", "2026-09-02", "PLANNED", "b3"), s("b2", "2026-09-03"), s("b3", "2026-09-08", "RESCHEDULED")];
    expectEqual(numbers(list), "b1:1 bu:3 b2:2 b3:-", "buổi 3 dời lên 2/9 vẫn là buổi 3");
  });

  await test("Dời 2 lần: số đi theo buổi bù mới nhất; buổi bù bị cho nghỉ thì các buổi sau dồn lên", async () => {
    const twice = [s("b1", "2026-09-01", "RESCHEDULED"), s("bu1", "2026-09-05", "RESCHEDULED", "b1"), s("bu2", "2026-09-06", "PLANNED", "bu1"), s("b2", "2026-09-03")];
    expectEqual(numbers(twice), "b1:- bu1:- bu2:1 b2:2", "bu2 giữ buổi 1");
    const makeupCancelled = [s("b1", "2026-09-01", "RESCHEDULED"), s("bu", "2026-09-05", "CANCELLED", "b1"), s("b2", "2026-09-03")];
    expectEqual(numbers(makeupCancelled), "b1:- bu:- b2:1", "buổi bù nghỉ → b2 dồn lên buổi 1");
  });

  await test("Dữ liệu cũ: buổi đã dời mà không có buổi bù thì như buổi nghỉ", async () => {
    expectEqual(numbers([s("b1", "2026-09-01", "RESCHEDULED"), s("b2", "2026-09-03")]), "b1:- b2:1", "không có buổi bù");
  });

  await test("Vị trí đã dạy xa nhất tính theo số mới", async () => {
    const list = [s("b1", "2026-09-01", "COMPLETED"), s("b2", "2026-09-03", "CANCELLED"), s("b3", "2026-09-08", "COMPLETED"), s("b4", "2026-09-10")];
    expectEqual(lastTaughtNumber(list), 2, "đã dạy tới buổi 2");
  });

  const failed = summary();
  if (failed > 0) process.exit(1);
}

main();
