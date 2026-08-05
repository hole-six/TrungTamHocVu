// Đăng ký lịch chạy nền cho 3 sweep tự động (xem lib/server/scheduling.ts). Được
// gọi đúng 1 lần khi server khởi động, từ instrumentation.ts ở gốc repo.
//
// Cơ chế "bắt kịp" khi server từng tắt lúc tới giờ chạy: các sweep tự kiểm tra
// TRẠNG THÁI ("kỳ tháng này đã có chưa / lớp đã sinh buổi tới đâu"), không kiểm
// tra NGÀY ("có phải hôm nay là ngày 1 không") — nên chỉ cần gọi lại 1 lần ngay
// lúc khởi động là đủ bắt kịp, không cần thư viện dò "tick bị lỡ".
import cron from "node-cron";
import {
  runDailySessionSweep,
  runMonthlyBillingSweep,
  runMonthlyPayrollSweep,
  runClassEndCreditSweep,
} from "@/lib/server/scheduling";

type JobName = "sessions" | "classEndCredits" | "billing" | "payroll";

const running: Record<JobName, boolean> = { sessions: false, classEndCredits: false, billing: false, payroll: false };

async function runOnce(name: JobName, fn: () => Promise<{ correlationId: string; processed: number; errors: number }>) {
  if (running[name]) {
    console.log(`[scheduler] "${name}" đang chạy dở, bỏ qua lượt gọi trùng.`);
    return;
  }
  running[name] = true;
  try {
    const result = await fn();
    console.log(`[scheduler] "${name}" xong — processed=${result.processed} errors=${result.errors} correlationId=${result.correlationId}`);
  } catch (error) {
    console.error(`[scheduler] "${name}" lỗi không bắt được:`, error);
  } finally {
    running[name] = false;
  }
}

export function startScheduler() {
  console.log("[scheduler] Khởi động lịch tự động sinh buổi học / học phí / lương.");

  cron.schedule("0 2 * * *", async () => {
    await runOnce("sessions", runDailySessionSweep);
    // Chạy sau sessions cùng khung giờ — để 1 lớp vừa sinh xong buổi cuối cùng
    // lượt này vẫn được lượt sau bắt kịp (expectedEndDate không đổi theo sweep này).
    await runOnce("classEndCredits", runClassEndCreditSweep);
  });
  cron.schedule("0 3 1 * *", () => runOnce("billing", runMonthlyBillingSweep));
  cron.schedule("0 4 1 * *", () => runOnce("payroll", runMonthlyPayrollSweep));

  // Chạy ngay 1 lần lúc khởi động để bắt kịp nếu server từng tắt qua giờ hẹn.
  void runOnce("sessions", runDailySessionSweep).then(() => runOnce("classEndCredits", runClassEndCreditSweep));
  void runOnce("billing", runMonthlyBillingSweep);
  void runOnce("payroll", runMonthlyPayrollSweep);
}
