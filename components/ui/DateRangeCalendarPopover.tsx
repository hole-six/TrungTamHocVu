"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_LABELS = ["Th 1", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "Th 8", "Th 9", "Th 10", "Th 11", "Th 12"];

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromIso(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatShort(value: string) {
  const date = fromIso(value);
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(date);
  result.setDate(date.getDate() + diff);
  return result;
}

function buildMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeekMonday(firstOfMonth);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    days.push(day);
  }
  return days;
}

type QuickPreset = { label: string; range: () => [Date, Date] };

function buildQuickPresets(): QuickPreset[] {
  const today = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  };
  return [
    { label: "Hôm nay", range: () => { const d = today(); return [d, d]; } },
    { label: "Hôm qua", range: () => { const d = today(); const y = new Date(d); y.setDate(d.getDate() - 1); return [y, y]; } },
    { label: "Tuần này", range: () => { const d = today(); const start = startOfWeekMonday(d); const end = new Date(start); end.setDate(start.getDate() + 6); return [start, end]; } },
    { label: "Tháng này", range: () => { const d = today(); return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)]; } },
    { label: "Tháng trước", range: () => { const d = today(); return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)]; } },
  ];
}

function MonthGrid({
  year,
  month,
  label,
  draftFrom,
  draftTo,
  hoverDate,
  onHover,
  onPick,
}: {
  year: number;
  month: number;
  label: string;
  draftFrom: Date | null;
  draftTo: Date | null;
  hoverDate: Date | null;
  onHover: (date: Date | null) => void;
  onPick: (date: Date) => void;
}) {
  const days = buildMonthGrid(year, month);
  const rangeEnd = draftTo ?? (draftFrom && hoverDate && hoverDate.getTime() > draftFrom.getTime() ? hoverDate : null);

  function isInRange(day: Date) {
    if (!draftFrom || !rangeEnd) return false;
    const time = day.getTime();
    const start = Math.min(draftFrom.getTime(), rangeEnd.getTime());
    const end = Math.max(draftFrom.getTime(), rangeEnd.getTime());
    return time > start && time < end;
  }

  function isEndpoint(day: Date) {
    return (draftFrom && day.getTime() === draftFrom.getTime()) || (draftTo && day.getTime() === draftTo.getTime());
  }

  return (
    <div className="flex-1 min-w-[240px]">
      <p className="mb-2 text-center text-sm font-semibold text-ink">{label}</p>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] font-semibold text-ink-muted48">
        {WEEKDAY_LABELS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const inMonth = day.getMonth() === month;
          const endpoint = isEndpoint(day);
          const inRange = !endpoint && isInRange(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={!inMonth}
              onMouseEnter={() => onHover(day)}
              onClick={() => onPick(day)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm transition ${
                !inMonth
                  ? "text-transparent cursor-default"
                  : endpoint
                    ? "bg-primary font-bold text-white"
                    : inRange
                      ? "bg-primary/10 text-primary"
                      : "text-ink hover:bg-[#f1f4fa]"
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangeCalendarPopover({
  valueFrom,
  valueTo,
  onApply,
  onClearAll,
  placeholder = "Khoảng ngày...",
  triggerClassName,
}: {
  valueFrom: string;
  valueTo: string;
  onApply: (from: string | null, to: string | null) => void;
  /** Khi có, nút "Xóa" xóa TOÀN BỘ filter đang áp dụng (không chỉ khoảng ngày này) và
   *  có tác dụng ngay, không cần bấm "Áp dụng" thêm — dùng cho trang có nhiều filter
   *  cùng lúc (vd Sổ quỹ) muốn 1 nút "Xóa" reset sạch. Không truyền thì giữ hành vi cũ
   *  (chỉ xóa draft ngày, vẫn cần "Áp dụng"). */
  onClearAll?: () => void;
  placeholder?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [draftFrom, setDraftFrom] = useState<Date | null>(fromIso(valueFrom));
  const [draftTo, setDraftTo] = useState<Date | null>(fromIso(valueTo));
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [viewYear, setViewYear] = useState(() => (fromIso(valueFrom) ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (fromIso(valueFrom) ?? new Date()).getMonth());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(fromIso(valueFrom));
    setDraftTo(fromIso(valueTo));
    const anchor = fromIso(valueFrom) ?? new Date();
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth());

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverWidth = 680;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 12) left = Math.max(12, window.innerWidth - popoverWidth - 12);
      setPosition({ top: rect.bottom + 6, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, valueFrom, valueTo]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pickDay(day: Date) {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo(null);
      return;
    }
    if (day.getTime() < draftFrom.getTime()) {
      setDraftFrom(day);
      setDraftTo(null);
      return;
    }
    setDraftTo(day);
  }

  function applyPreset(preset: QuickPreset) {
    const [start, end] = preset.range();
    setDraftFrom(start);
    setDraftTo(end);
    setViewYear(start.getFullYear());
    setViewMonth(start.getMonth());
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const nextMonthDate = new Date(viewYear, viewMonth + 1, 1);
  const hasValue = Boolean(valueFrom || valueTo);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={
          triggerClassName ??
          "flex w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-left text-sm normal-case focus:border-primary focus:outline-none"
        }
      >
        <span className={`truncate ${hasValue ? "font-medium text-[#111827]" : "text-[#9ca3af]"}`}>
          {hasValue ? `${formatShort(valueFrom) || "…"} – ${formatShort(valueTo) || "…"}` : placeholder}
        </span>
        <span className="shrink-0 text-[#9ca3af]">📅</span>
      </button>

      {mounted && open && position
        ? createPortal(
            <div
              ref={popoverRef}
              style={{ position: "fixed", top: position.top, left: position.left, width: 680 }}
              className="z-[200] flex overflow-hidden rounded-2xl border border-[#e2e6ee] bg-white shadow-xl"
            >
              <div className="w-32 shrink-0 border-r border-[#eef0f5] bg-[#fafbfc] p-2">
                {buildQuickPresets().map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="block w-full rounded-lg px-2.5 py-2 text-left text-sm text-ink-muted80 hover:bg-white hover:text-primary"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-3">
                <div className="flex items-center justify-between px-1">
                  <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg px-2 py-1 text-ink-muted48 hover:bg-[#f1f4fa]">
                    ‹
                  </button>
                  <span className="text-xs font-semibold text-ink-muted48">
                    {MONTH_LABELS[viewMonth]} {viewYear}
                  </span>
                  <span className="text-xs font-semibold text-ink-muted48">
                    {MONTH_LABELS[nextMonthDate.getMonth()]} {nextMonthDate.getFullYear()}
                  </span>
                  <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg px-2 py-1 text-ink-muted48 hover:bg-[#f1f4fa]">
                    ›
                  </button>
                </div>

                <div className="mt-2 flex gap-4" onMouseLeave={() => setHoverDate(null)}>
                  <MonthGrid
                    year={viewYear}
                    month={viewMonth}
                    label=""
                    draftFrom={draftFrom}
                    draftTo={draftTo}
                    hoverDate={hoverDate}
                    onHover={setHoverDate}
                    onPick={pickDay}
                  />
                  <MonthGrid
                    year={nextMonthDate.getFullYear()}
                    month={nextMonthDate.getMonth()}
                    label=""
                    draftFrom={draftFrom}
                    draftTo={draftTo}
                    hoverDate={hoverDate}
                    onHover={setHoverDate}
                    onPick={pickDay}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#eef0f5] pt-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftFrom(null);
                        setDraftTo(null);
                        if (onClearAll) {
                          onClearAll();
                          setOpen(false);
                        }
                      }}
                      className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Xóa
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset(buildQuickPresets()[0])}
                      className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-ink-muted80 hover:bg-[#f1f4fa]"
                    >
                      Hôm nay
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-ink-muted80 hover:bg-[#f1f4fa]">
                      Đóng
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onApply(draftFrom ? toIso(draftFrom) : null, draftTo ? toIso(draftTo) : draftFrom ? toIso(draftFrom) : null);
                        setOpen(false);
                      }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
