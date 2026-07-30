// Hook khởi động của Next.js (chạy đúng 1 lần khi tiến trình server bắt đầu) —
// dùng để bật lịch tự động sinh buổi học/học phí/lương. Xem lib/server/scheduler.ts.
export async function register() {
  // middleware.ts của app này chạy ở edge runtime, và register() bị gọi cho CẢ hai
  // runtime (nodejs + edge) — node-cron/Prisma không chạy được ở edge nên phải bỏ qua.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // globalThis (không phải biến module-level) vì next dev có thể tải lại module
  // này nhiều lần khi hot-reload, nhưng globalThis sống xuyên suốt tiến trình —
  // nếu dùng biến module-level, guard sẽ bị reset và lịch bị đăng ký trùng lặp.
  const g = globalThis as typeof globalThis & { __erpSchedulerStarted?: boolean };
  if (g.__erpSchedulerStarted) return;
  g.__erpSchedulerStarted = true;

  const { startScheduler } = await import("@/lib/server/scheduler");
  startScheduler();
}
