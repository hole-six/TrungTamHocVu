"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type DateRange = { from: Date | null; to: Date | null };

export const WEEKDAY_LABEL = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const MONTH_LABEL = [
  "Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12",
];

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function isSameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isBetween(d: Date, from: Date, to: Date) {
  return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
}
function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=CN..6=T7
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function formatVn(d: Date | null) {
  if (!d) return "";
  return d.toLocaleDateString("vi-VN");
}

// Vị trí popup được tính bằng getBoundingClientRect() của nút bấm rồi render qua
// portal vào document.body (position: fixed) — không render lồng trong DOM của
// trang nữa. Làm vậy để popup luôn nổi trên MỌI thứ khác (bảng dữ liệu, cột dính
// sticky...) mà không phải đoán z-index/stacking-context của từng nơi dùng lại.
export function usePopupPosition(open: boolean, triggerRef: React.RefObject<HTMLElement>, popupWidth: number) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    function compute() {
      const rect = triggerRef.current!.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - popupWidth - 8);
      setPos({ top: rect.bottom + 8, left: Math.max(8, left) });
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [open, triggerRef, popupWidth]);

  return pos;
}

// Danh sách preset chuẩn dùng chung mọi nơi trong hệ thống cần lọc theo ngày/khoảng
// ngày — mọi thao tác nghiệp vụ ở đây đều gắn với dữ liệu thật (hẹn test, buổi học,
// thu chi...) nên trực quan hóa khoảng thời gian được ưu tiên hơn việc gõ tay ngày.
function getPresets(): { label: string; range: () => DateRange }[] {
  return [
    {
      label: "Hôm nay",
      range: () => {
        const t = startOfDay(new Date());
        return { from: t, to: t };
      },
    },
    {
      label: "Hôm qua",
      range: () => {
        const t = startOfDay(new Date());
        const y = new Date(t);
        y.setDate(y.getDate() - 1);
        return { from: y, to: y };
      },
    },
    {
      label: "Tuần này",
      range: () => {
        const from = startOfWeekMonday(new Date());
        const to = new Date(from);
        to.setDate(to.getDate() + 6);
        return { from, to };
      },
    },
    {
      label: "Tháng này",
      range: () => {
        const now = new Date();
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
      },
    },
    {
      label: "Tháng trước",
      range: () => {
        const now = new Date();
        return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0) };
      },
    },
  ];
}

export function MonthGrid({
  monthDate,
  from,
  to,
  hover,
  onPick,
  onHover,
}: {
  monthDate: Date;
  from: Date | null;
  to: Date | null;
  hover: Date | null;
  onPick: (d: Date) => void;
  onHover: (d: Date | null) => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = startOfDay(new Date());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const previewTo = to ?? hover;

  return (
    <div className="w-60 shrink-0">
      <p className="text-center text-sm font-semibold text-ink">
        {MONTH_LABEL[month]} {year}
      </p>
      <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-medium text-ink-muted48">
        {WEEKDAY_LABEL.map((w) => (
          <span key={w} className="flex h-6 items-center justify-center">
            {w}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const inRange = from && previewTo && isBetween(d, from < previewTo ? from : previewTo, from < previewTo ? previewTo : from);
          const isStart = isSameDay(d, from);
          const isEnd = isSameDay(d, to);
          const isToday = isSameDay(d, today);
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => onHover(d)}
              onClick={() => onPick(d)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors ${
                isStart || isEnd
                  ? "bg-primary text-white font-semibold"
                  : inRange
                    ? "bg-primary/10 text-primary"
                    : isToday
                      ? "border border-primary/60 text-ink font-semibold"
                      : "text-ink hover:bg-ink/5"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const POPUP_WIDTH = 672;

export default function DateRangePicker({
  value,
  onChange,
  label = "Chọn khoảng ngày",
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [hover, setHover] = useState<Date | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = value.from ?? new Date();
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
    // Popup dùng position:fixed theo tọa độ lúc mở — cuộn trang sẽ làm nó lệch khỏi
    // nút bấm, nên đóng luôn khi người dùng cuộn thay vì tính lại vị trí liên tục.
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
    if (open) setDraft(value);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickDay(d: Date) {
    if (!draft.from || (draft.from && draft.to)) {
      setDraft({ from: d, to: null });
    } else if (d < draft.from) {
      setDraft({ from: d, to: draft.from });
    } else {
      setDraft({ from: draft.from, to: d });
    }
  }

  function applyPreset(range: DateRange) {
    setDraft(range);
  }

  function apply() {
    onChange(draft.from && !draft.to ? { from: draft.from, to: draft.from } : draft);
    setOpen(false);
  }

  const secondMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
  const rangeLabel = value.from ? (isSameDay(value.from, value.to) ? formatVn(value.from) : `${formatVn(value.from)} – ${formatVn(value.to)}`) : label;

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen((v) => !v)} className="input flex items-center gap-2 text-left">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-muted48">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className={value.from ? "text-ink" : "text-ink-muted48"}>{rangeLabel}</span>
      </button>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popupRef}
              style={{ position: "fixed", top: pos.top, left: pos.left, width: POPUP_WIDTH }}
              className="z-[9999] flex rounded-xl border border-hairline bg-white shadow-2xl"
            >
              <div className="w-32 shrink-0 space-y-0.5 border-r border-hairline p-3">
                {getPresets().map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.range())}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink-muted80 hover:bg-primary/5 hover:text-primary"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="p-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    className="rounded p-1 text-ink-muted48 hover:bg-ink/5"
                  >
                    ‹
                  </button>
                  <span className="text-xs text-ink-muted48">
                    {formatVn(draft.from)} {draft.to ? `→ ${formatVn(draft.to)}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    className="rounded p-1 text-ink-muted48 hover:bg-ink/5"
                  >
                    ›
                  </button>
                </div>
                <div className="mt-2 flex gap-4" onMouseLeave={() => setHover(null)}>
                  <MonthGrid monthDate={viewMonth} from={draft.from} to={draft.to} hover={hover} onPick={pickDay} onHover={setHover} />
                  <MonthGrid monthDate={secondMonth} from={draft.from} to={draft.to} hover={hover} onPick={pickDay} onHover={setHover} />
                </div>

                <div className="mt-3 flex justify-end gap-2 border-t border-hairline pt-3">
                  <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">
                    Đóng
                  </button>
                  <button type="button" onClick={apply} disabled={!draft.from} className="btn-primary text-xs">
                    Áp dụng
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
