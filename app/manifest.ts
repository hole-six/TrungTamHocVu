import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TACH — Quản lý trung tâm",
    short_name: "TACH",
    description: "Hệ thống quản lý trung tâm: tuyển sinh, học viên, lớp học, học phí, kho, thu chi, nhân sự & lương.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#F97316",
    lang: "vi",
    categories: ["business", "education", "productivity"],
    icons: [
      { src: "/pwa-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
