"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type NotificationItem = {
  id: string;
  type: "requirement" | "overdue";
  title: string;
  detail: string;
  href: string;
};

type Summary = {
  total: number;
  requirementCount: number;
  overdueCount: number;
  items: NotificationItem[];
};

// Bell thông báo cho admin — tính động mỗi lần mở, không có bảng lưu trạng thái đã
// đọc/chưa đọc (chưa có cơ chế realtime/polling nào trong hệ thống để đồng bộ điều đó
// đúng đắn). Đúng pattern dropdown đã dùng ở BranchSelector.tsx (click ra ngoài để đóng,
// panel absolute căn theo trigger).
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/notifications/summary")
      .then((res) => (res.ok ? res.json() : Promise.reject("failed")))
      .then((data) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }

  // Tải sẵn khi vào trang để hiện đúng số badge ngay, không phải đợi bấm mở mới thấy.
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-notification-bell]")) setOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  const total = summary?.total ?? 0;

  return (
    <div className="relative" data-notification-bell>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) load();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#e8edf5] bg-white transition-all hover:border-primary/50 hover:shadow-md"
        aria-label="Thông báo"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted80">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {total > 9 ? "9+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[#e8edf5] bg-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="border-b border-[#e8edf5] bg-gradient-to-r from-[#fafbff] to-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted48">Thông báo{total > 0 ? ` (${total})` : ""}</p>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-ink-muted48">Đang tải...</p>
            ) : !summary || summary.items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-muted48">Không có thông báo nào.</p>
            ) : (
              summary.items.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 border-b border-[#f1f4fa] px-4 py-3 transition hover:bg-primary/5 last:border-0"
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      item.type === "overdue" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      {item.type === "overdue" ? (
                        <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>
                      ) : (
                        <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>
                      )}
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-xs text-ink-muted48">{item.detail}</p>
                  </div>
                </Link>
              ))
            )}
          </div>

          {summary && summary.total > summary.items.length ? (
            <div className="border-t border-[#e8edf5] bg-gradient-to-r from-[#fafbff] to-white px-4 py-2 text-center text-xs text-ink-muted48">
              Còn {summary.total - summary.items.length} thông báo khác
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
