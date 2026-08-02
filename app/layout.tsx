import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import PwaProvider from "@/components/PwaProvider";

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
    <html
      lang="vi"
      suppressHydrationWarning
      style={{ ["--font-sans" as string]: '"Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif' }}
    >
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          {children}
          <PwaProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
