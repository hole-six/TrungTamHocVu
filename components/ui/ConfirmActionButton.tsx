"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type ConfirmActionButtonProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  className?: string;
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
};

export default function ConfirmActionButton({
  children,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  className,
  disabled,
  onConfirm,
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    try {
      setLoading(true);
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        tone={tone}
        loading={loading}
        onConfirm={handleConfirm}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
      />
    </>
  );
}
