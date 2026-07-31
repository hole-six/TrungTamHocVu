"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type SlideOverProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
};

export default function SlideOver({
  open,
  title,
  description,
  onClose,
  children,
  widthClassName = "max-w-2xl",
}: SlideOverProps) {
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

  // Portal thẳng ra document.body — nếu render lồng trong 1 phần tử có
  // :hover{transform:...} (vd .card ở các bảng danh sách), transform trên tổ tiên
  // sẽ biến nó thành containing block cho position:fixed bên trong, khiến panel bị
  // giật vị trí lúc hover/rời chuột khỏi phần tử đó. Portal loại bỏ khả năng này.
  return createPortal(
    <div className="slideover-root" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="slideover-backdrop" onClick={onClose} aria-label="Đóng" />
      <div className={`slideover-panel ${widthClassName}`}>
        <div className="slideover-header">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
            {description ? <p className="mt-2 text-sm leading-6 text-ink-muted80">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost-sm">
            Đóng
          </button>
        </div>
        <div className="slideover-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
