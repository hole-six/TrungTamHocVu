"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TourStep = {
  /** CSS selector for the element to highlight, e.g. '[data-tour="assets-new-button"]' */
  target: string;
  title: string;
  description: string;
  /** Preferred side for the tooltip. Falls back automatically if there isn't room. */
  placement?: "top" | "bottom" | "left" | "right";
};

type Rect = { top: number; left: number; width: number; height: number };

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_GAP = 16;

function measure(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// Vị trí tooltip: thử đúng hướng ưu tiên trước, nếu tràn viewport thì lật sang hướng
// đối diện — cùng tinh thần với usePopupPosition (DateRangePicker.tsx) nhưng đủ 4
// hướng vì spotlight có thể nằm ở bất kỳ đâu trên màn hình, không chỉ phía dưới 1 ô input.
function computeTooltipPosition(rect: Rect, preferred: TourStep["placement"], tooltipHeight: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const order: NonNullable<TourStep["placement"]>[] =
    preferred === "top"
      ? ["top", "bottom", "right", "left"]
      : preferred === "left"
        ? ["left", "right", "bottom", "top"]
        : preferred === "right"
          ? ["right", "left", "bottom", "top"]
          : ["bottom", "top", "right", "left"];

  for (const side of order) {
    if (side === "bottom" && rect.top + rect.height + TOOLTIP_GAP + tooltipHeight <= vh) {
      return { side, top: rect.top + rect.height + TOOLTIP_GAP, left: clampLeft(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, vw) };
    }
    if (side === "top" && rect.top - TOOLTIP_GAP - tooltipHeight >= 0) {
      return { side, top: rect.top - TOOLTIP_GAP - tooltipHeight, left: clampLeft(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, vw) };
    }
    if (side === "right" && rect.left + rect.width + TOOLTIP_GAP + TOOLTIP_WIDTH <= vw) {
      return { side, top: clampTop(rect.top + rect.height / 2 - tooltipHeight / 2, vh, tooltipHeight), left: rect.left + rect.width + TOOLTIP_GAP };
    }
    if (side === "left" && rect.left - TOOLTIP_GAP - TOOLTIP_WIDTH >= 0) {
      return { side, top: clampTop(rect.top + rect.height / 2 - tooltipHeight / 2, vh, tooltipHeight), left: rect.left - TOOLTIP_GAP - TOOLTIP_WIDTH };
    }
  }
  // Không hướng nào vừa (màn hình quá nhỏ) — ghim giữa màn hình để luôn đọc được.
  return { side: "bottom" as const, top: Math.max(8, vh / 2 - tooltipHeight / 2), left: clampLeft(vw / 2 - TOOLTIP_WIDTH / 2, vw) };
}

function clampLeft(left: number, vw: number) {
  return Math.min(Math.max(8, left), vw - TOOLTIP_WIDTH - 8);
}
function clampTop(top: number, vh: number, tooltipHeight: number) {
  return Math.min(Math.max(8, top), vh - tooltipHeight - 8);
}

function TourOverlay({
  steps,
  stepIndex,
  onNext,
  onPrev,
  onClose,
}: {
  steps: TourStep[];
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(140);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const step = steps[stepIndex];

  useLayoutEffect(() => {
    const target = document.querySelector(step.target);
    if (!target) {
      // Phần tử không tồn tại — thường do bị ẩn theo phân quyền (vd cột "Thao tác" chỉ
      // hiện với vai trò có quyền sửa/xóa). Tự nhảy qua bước này thay vì hiện overlay
      // trống không chỉ vào đâu cả.
      onNext();
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    // Đợi 1 nhịp để scrollIntoView kịp chạy trước khi đo lại vị trí thật.
    const t = setTimeout(() => setRect(measure(step.target)), 260);
    return () => clearTimeout(t);
  }, [step.target, onNext]);

  useEffect(() => {
    function recompute() {
      setRect(measure(step.target));
    }
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [step.target]);

  useLayoutEffect(() => {
    if (tooltipRef.current) setTooltipHeight(tooltipRef.current.offsetHeight);
  }, [stepIndex, rect]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") onNext();
      else if (e.key === "ArrowLeft") onPrev();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, onNext, onPrev]);

  if (!rect) return null;

  const spot = {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
  const tooltipPos = computeTooltipPosition(rect, step.placement, tooltipHeight);
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={step.title}>
      {/* Lớp tối bao toàn màn hình, "thủng lỗ" đúng vị trí spotlight bằng box-shadow —
          không cần SVG mask, không đụng vào layout thật của phần tử đang highlight. */}
      <div
        className="pointer-events-none absolute rounded-2xl ring-2 ring-[#f97316] transition-all duration-300 ease-out"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          boxShadow: "0 0 0 9999px rgba(15,23,42,0.72)",
        }}
      />
      {/* Click nền tối = đóng, giống hành vi overlay quen thuộc trong app (ResponsiveDrawer). */}
      <button
        type="button"
        aria-label="Đóng hướng dẫn"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        style={{ background: "transparent" }}
      />

      <div
        ref={tooltipRef}
        className="absolute w-80 rounded-2xl border border-[#e4ebf8] bg-white p-5 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.5)] transition-[top,left] duration-300 ease-out"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#f97316]">
            Bước {stepIndex + 1}/{steps.length}
          </span>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-[#94a3b8] hover:text-[#475569]">
            Bỏ qua
          </button>
        </div>
        <h3 className="mt-2 font-display text-base font-bold text-[#0f172a]">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-[#475569]">{step.description}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === stepIndex ? "w-4 bg-[#f97316]" : "w-1.5 bg-[#e2e8f0]"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {!isFirst ? (
              <button type="button" onClick={onPrev} className="rounded-xl border border-[#e2e8f0] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]">
                Trước
              </button>
            ) : null}
            <button type="button" onClick={onNext} className="rounded-xl bg-[#f97316] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#ea580c]">
              {isLast ? "Xong" : "Tiếp theo"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Nút "Xem hướng dẫn" + overlay spotlight tự chứa (self-contained) — đặt `data-tour="..."`
 * lên các phần tử cần chỉ ra trong form, rồi truyền đúng danh sách selector đó vào `steps`.
 * Không tự chạy khi vào trang (tránh làm phiền) — người dùng bấm nút mới bắt đầu.
 */
export default function SpotlightTour({ steps, label = "Xem hướng dẫn" }: { steps: TourStep[]; label?: string }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);
  const close = useCallback(() => setActive(false), []);
  const next = useCallback(() => {
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [steps.length]);
  const prev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);
  const isLastStep = stepIndex >= steps.length - 1;
  const advance = isLastStep ? close : next;

  if (steps.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-[#235f9d] transition hover:bg-[#f7fbff]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {label}
      </button>
      {active ? <TourOverlay steps={steps} stepIndex={stepIndex} onNext={advance} onPrev={prev} onClose={close} /> : null}
    </>
  );
}
