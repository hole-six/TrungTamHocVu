"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, ClipboardCheck, Loader2 } from "lucide-react";

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
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#dbe7ff] bg-white text-[#334155] shadow-sm transition-all hover:border-primary/50 hover:text-primary hover:shadow-md"
        aria-label="Thông báo"
      >
        <Bell className="h-5 w-5" strokeWidth={2.25} />
        {total > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-extrabold text-white shadow-sm">
            {total > 9 ? "9+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(390px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#dbe7ff] bg-white shadow-[0_24px_70px_-30px_rgba(15,23,42,0.55)] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="border-b border-[#e8edf5] bg-[#f8fbff] px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Trung tâm thông báo</p>
                <h3 className="mt-0.5 text-base font-black text-[#0f1729]">
                  {total > 0 ? `${total} việc cần xử lý` : "Không có việc mới"}
                </h3>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                {summary?.requirementCount ? (
                  <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">{summary.requirementCount} quy chế</span>
                ) : null}
                {summary?.overdueCount ? (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">{summary.overdueCount} quá hạn</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm font-semibold text-[#64748b]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải thông báo...
              </div>
            ) : !summary || summary.items.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" strokeWidth={2.3} />
                </span>
                <p className="mt-3 text-sm font-bold text-[#0f1729]">Mọi thứ đang ổn</p>
                <p className="mt-1 text-sm font-medium text-[#64748b]">Chưa có thông báo cần xử lý.</p>
              </div>
            ) : (
              summary.items.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-start gap-3 border-b border-[#f1f4fa] px-4 py-3.5 transition hover:bg-[#f8fbff] last:border-0"
                >
                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      item.type === "overdue" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {item.type === "overdue" ? (
                      <AlertTriangle className="h-5 w-5" strokeWidth={2.25} />
                    ) : (
                      <ClipboardCheck className="h-5 w-5" strokeWidth={2.25} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-extrabold text-[#0f1729]">{item.title}</p>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${item.type === "overdue" ? "bg-amber-500" : "bg-rose-500"}`} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[#64748b]">{item.detail}</p>
                  </div>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-[#94a3b8] transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))
            )}
          </div>

          {summary && summary.total > summary.items.length ? (
            <div className="border-t border-[#e8edf5] bg-[#f8fbff] px-4 py-2.5 text-center text-sm font-semibold text-[#64748b]">
              Còn {summary.total - summary.items.length} thông báo khác
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
