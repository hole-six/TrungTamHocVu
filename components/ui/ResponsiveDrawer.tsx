"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ResponsiveDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
  guide?: React.ReactNode;
};

// Tailwind's JIT scanner chỉ nhận diện được class ĐỨNG NGUYÊN VĂN trong source —
// ghép chuỗi kiểu `md:${widthClassName}` KHÔNG bao giờ sinh ra CSS thật (bug thực tế
// đã xác nhận: panel luôn full-width trên desktop bất kể widthClassName truyền gì).
// Map cứng ra literal đầy đủ để Tailwind quét thấy, không cần sửa 17+ nơi đang gọi
// ResponsiveDrawer với widthClassName="max-w-*".
const WIDTH_MD_CLASS: Record<string, string> = {
  "max-w-md": "md:max-w-md",
  "max-w-lg": "md:max-w-lg",
  "max-w-xl": "md:max-w-xl",
  "max-w-2xl": "md:max-w-2xl",
  "max-w-3xl": "md:max-w-3xl",
  "max-w-4xl": "md:max-w-4xl",
  "max-w-5xl": "md:max-w-5xl",
  "max-w-6xl": "md:max-w-6xl",
  "max-w-7xl": "md:max-w-7xl",
};

export default function ResponsiveDrawer({
  open,
  title,
  description,
  onClose,
  children,
  widthClassName = "max-w-2xl",
  guide,
}: ResponsiveDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="slideover-root" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="slideover-backdrop" onClick={onClose} aria-label="Đóng" />
      {/* Mobile: Full screen, Desktop: Drawer from right */}
      <div className={`slideover-panel w-full max-w-full ${WIDTH_MD_CLASS[widthClassName] ?? "md:max-w-2xl"}`}>
        <div className="slideover-header flex-wrap gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-ink truncate">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm leading-5 sm:leading-6 text-ink-muted80">
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {guide}
            <button type="button" onClick={onClose} className="btn-ghost-sm touch-manipulation">
              Đóng
            </button>
          </div>
        </div>
        <div className="slideover-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
