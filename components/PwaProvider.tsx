"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
// Nếu người dùng đã bấm "Để sau" thì không hỏi lại ngay — chờ vài ngày mới nhắc lại,
// tránh làm phiền mỗi lần mở app.
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export default function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Không chặn app nếu đăng ký service worker thất bại — cài đặt/offline chỉ là tính năng bổ sung.
    });
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    function handleAppInstalled() {
      setInstallEvent(null);
      localStorage.removeItem(DISMISS_KEY);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    setInstalling(true);
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstalling(false);
    setInstallEvent(null);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setInstallEvent(null);
  }

  if (!installEvent) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex max-w-sm items-center gap-3 rounded-2xl border border-hairline bg-white px-4 py-3 shadow-[0_18px_45px_rgba(15,23,41,0.16)]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Cài đặt TACH lên máy?</p>
        <p className="mt-0.5 text-xs text-ink-muted48">Mở nhanh như 1 ứng dụng, dùng được cả khi mất mạng.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={handleDismiss} className="btn-ghost text-xs">
          Để sau
        </button>
        <button type="button" onClick={handleInstall} disabled={installing} className="btn-primary text-xs">
          {installing ? "..." : "Cài đặt"}
        </button>
      </div>
    </div>
  );
}
