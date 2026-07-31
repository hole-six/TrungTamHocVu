"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MonthGrid, formatVn, startOfDay, usePopupPosition } from "@/components/ui/DateRangePicker";

// Ô chọn 1 ngày dùng chung style lịch với DateRangePicker — thay cho <input type="date">
// gốc của trình duyệt (xấu, không đồng bộ giao diện). Popup render qua portal vào
// document.body giống DateRangePicker để không bao giờ bị các phần tử khác (bảng,
// modal...) đè lên do xung đột z-index/stacking-context giữa các nơi dùng lại.
function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromYmd(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const POPUP_WIDTH = 256;

export default function DatePicker({
  value,
  onChange,
  placeholder = "Chọn ngày",
  allowClear = true,
}: {
  value: string; // yyyy-mm-dd, giống value của <input type="date"> để dễ thay thế tại chỗ
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromYmd(value);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const pos = usePopupPosition(open, triggerRef, POPUP_WIDTH);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    function onScroll() {
      setOpen(false);
    }
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) setViewMonth(new Date((selected ?? new Date()).getFullYear(), (selected ?? new Date()).getMonth(), 1));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen((v) => !v)} className="input flex w-full items-center gap-2 text-left">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-muted48">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className={selected ? "text-ink" : "text-ink-muted48"}>{selected ? formatVn(selected) : placeholder}</span>
      </button>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popupRef}
              style={{ position: "fixed", top: pos.top, left: pos.left, width: POPUP_WIDTH }}
              className="z-[9999] rounded-xl border border-hairline bg-white p-3 shadow-2xl"
            >
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  className="rounded p-1 text-ink-muted48 hover:bg-ink/5"
                >
                  ‹
                </button>
                <span className="text-xs font-semibold text-ink-muted80">{selected ? formatVn(selected) : "Chưa chọn ngày"}</span>
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  className="rounded p-1 text-ink-muted48 hover:bg-ink/5"
                >
                  ›
                </button>
              </div>
              <div className="mt-2">
                <MonthGrid
                  monthDate={viewMonth}
                  from={selected}
                  to={selected}
                  hover={null}
                  onPick={(d) => {
                    onChange(toYmd(startOfDay(d)));
                    setOpen(false);
                  }}
                  onHover={() => {}}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange(toYmd(new Date()));
                    setOpen(false);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Hôm nay
                </button>
                {allowClear && value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    className="text-xs text-ink-muted48 hover:text-red-600 hover:underline"
                  >
                    Xóa ngày
                  </button>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
