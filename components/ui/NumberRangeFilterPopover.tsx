"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function formatCompact(value: string) {
  const num = Number(value);
  if (!value || Number.isNaN(num)) return "";
  return num.toLocaleString("vi-VN");
}

export default function NumberRangeFilterPopover({
  valueFrom,
  valueTo,
  onApply,
  placeholder = "Khoảng...",
  unit,
  triggerClassName,
}: {
  valueFrom: string;
  valueTo: string;
  onApply: (from: string | null, to: string | null) => void;
  placeholder?: string;
  unit?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [draftFrom, setDraftFrom] = useState(valueFrom);
  const [draftTo, setDraftTo] = useState(valueTo);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(valueFrom);
    setDraftTo(valueTo);

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverWidth = 260;
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

  const hasValue = Boolean(valueFrom || valueTo);
  const label = hasValue
    ? `${formatCompact(valueFrom) || "…"} – ${formatCompact(valueTo) || "…"}${unit ? ` ${unit}` : ""}`
    : placeholder;

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
        <span className={`truncate ${hasValue ? "font-medium text-[#111827]" : "text-[#9ca3af]"}`}>{label}</span>
        <span className="shrink-0 text-[#9ca3af]">⇅</span>
      </button>

      {mounted && open && position
        ? createPortal(
            <div
              ref={popoverRef}
              style={{ position: "fixed", top: position.top, left: position.left, width: 260 }}
              className="z-[200] rounded-2xl border border-[#e2e6ee] bg-white p-3 shadow-xl"
            >
              <div className="flex items-center gap-2">
                <label className="flex-1">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Từ</span>
                  <input
                    type="number"
                    value={draftFrom}
                    onChange={(event) => setDraftFrom(event.target.value)}
                    autoFocus
                    className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-sm normal-case text-[#111827] focus:border-primary focus:outline-none"
                  />
                </label>
                <span className="mt-4 shrink-0 text-[#9ca3af]">–</span>
                <label className="flex-1">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Đến</span>
                  <input
                    type="number"
                    value={draftTo}
                    onChange={(event) => setDraftTo(event.target.value)}
                    className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-sm normal-case text-[#111827] focus:border-primary focus:outline-none"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[#eef0f5] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setDraftFrom("");
                    setDraftTo("");
                  }}
                  className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  Xóa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApply(draftFrom || null, draftTo || null);
                    setOpen(false);
                  }}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  Áp dụng
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
