"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number | string;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  id?: string;
  name?: string;
  autoFocus?: boolean;
};

function parseDigits(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return 0;
  return Number(digitsOnly);
}

function formatDigits(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";
  return Math.trunc(value).toLocaleString("vi-VN");
}

// Ô nhập tiền VNĐ: gõ 100000 tự hiển thị 100.000, nhưng luôn bắn ra số nguyên
// thuần (không dấu chấm) qua onChange để phần business logic không phải tự parse lại.
export default function CurrencyInput({
  value,
  onChange,
  className,
  placeholder,
  disabled,
  required,
  min,
  max,
  id,
  name,
  autoFocus,
}: Props) {
  const numericValue = typeof value === "number" ? value : parseDigits(String(value));
  const [display, setDisplay] = useState(() => formatDigits(numericValue));

  useEffect(() => {
    setDisplay(formatDigits(numericValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericValue]);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        id={id}
        name={name}
        autoFocus={autoFocus}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className={className ?? "input pr-9"}
        value={display}
        onChange={(event) => {
          const next = parseDigits(event.target.value);
          const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next));
          setDisplay(formatDigits(clamped));
          onChange(clamped);
        }}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted48">
        đ
      </span>
    </div>
  );
}
