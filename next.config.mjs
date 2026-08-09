/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production/QA builds isolated from `next dev`. On Windows, running
  // both against the default `.next` directory can delete each other's route
  // chunks and surface random MODULE_NOT_FOUND errors at runtime.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // instrumentation.ts (đăng ký lịch tự động sinh buổi học/học phí/lương, xem
  // lib/server/scheduler.ts) chỉ được Next.js gọi nếu bật cờ này — chưa ổn định
  // mặc định cho tới Next 15. Thiếu cờ này thì register() không bao giờ chạy
  // và KHÔNG có cảnh báo/lỗi gì cả — toàn bộ sweep tự động im lặng không chạy.
  experimental: {
    instrumentationHook: true,
  },
  // instrumentation.ts tự bỏ qua runtime "edge" bằng process.env.NEXT_RUNTIME ở
  // runtime, nhưng webpack vẫn phải RESOLVE được toàn bộ cây import của
  // lib/server/scheduler.ts (node-cron, Prisma, "crypto"...) khi build bundle
  // edge cho middleware.ts, dù nhánh đó không bao giờ chạy trên edge — các gói
  // đó cần API của Node.js nên build vỡ. Chặn thẳng ở gốc (scheduler.ts) thay vì
  // chặn từng gói con một, vì cả cây import đó vốn chỉ dành cho Node.js.
  webpack: (config, { nextRuntime, webpack }) => {
    if (nextRuntime === "edge") {
      config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@\/lib\/server\/scheduler$/ }));
    }
    return config;
  },
};

export default nextConfig;
