"use client";

import { useEffect } from "react";

const RELOAD_KEY = "chunk-reload-at";
// Không tải lại lần 2 trong vòng này — nếu tải lại xong vẫn thiếu chunk (server đang lỗi
// thật chứ không phải tab cũ) thì để lỗi hiện ra, không lặp tải lại vô tận.
const RELOAD_COOLDOWN_MS = 60_000;

function isChunkLoadError(value: unknown) {
  const message =
    value instanceof Error ? `${value.name} ${value.message}` : typeof value === "string" ? value : String((value as { message?: unknown })?.message ?? "");
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk/i.test(message);
}

// Tab mở từ TRƯỚC một lần deploy vẫn giữ tên chunk của bản build cũ; bấm chuyển trang
// là trình duyệt đi tải chunk theo tên cũ. Deploy đã giữ lại chunk cũ 7 ngày
// (scripts/deploy.sh), nhưng tab mở lâu hơn thế — hoặc lỡ mở đúng lúc đang chuyển bản —
// vẫn gặp ChunkLoadError và trắng trang. Tải lại trang một lần là lấy đúng bản mới.
export default function ChunkReloadGuard() {
  useEffect(() => {
    function reloadOnce(reason: unknown) {
      if (!isChunkLoadError(reason)) return;
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      } catch {
        // sessionStorage bị chặn — vẫn tải lại, chấp nhận không có chốt chống lặp.
      }
      if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
      try {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch {
        // bỏ qua
      }
      window.location.reload();
    }

    const onError = (event: ErrorEvent) => reloadOnce(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => reloadOnce(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
