import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import PwaProvider from "@/components/PwaProvider";

// Trước đây --font-sans chỉ KHAI BÁO tên "Inter" trong font-stack CSS mà không tải
// font thật ở đâu cả — máy nào không cài sẵn Inter (hầu hết máy Windows) thì trình
// duyệt tự rơi về Segoe UI, đây là lý do chữ toàn hệ thống trông không như mong đợi.
// next/font/google tải đúng file Inter thật, tự host, có subset tiếng Việt.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TACH — Quản lý trung tâm",
  description: "Hệ thống quản lý trung tâm: tuyển sinh, học viên, lớp học, học phí, kho, thu chi, nhân sự & lương.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TACH",
  },
  icons: {
    icon: [{ url: "/pwa-icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/pwa-icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F97316",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          {children}
          <PwaProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
