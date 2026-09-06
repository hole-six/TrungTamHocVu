"use client";

import { useState } from "react";

const CUSTOM_VALUE = "__custom__";

// Chọn 1 giá trị từ danh sách ĐÃ CÓ, hoặc gõ giá trị mới — dùng cho những trường vừa
// muốn thống nhất tên gọi (tránh "A1" / "a1" / "A 1" thành 3 nhóm khác nhau) vừa không
// thể liệt kê cứng trước. Cố tình KHÔNG dùng <datalist>: trình duyệt chỉ gợi ý khi người
// dùng đã gõ và không có nút sổ, nên nhìn vào không biết hệ thống đang có sẵn những gì.
export default function PickOrCreateSelect({
  value,
  onChange,
  options,
  emptyLabel,
  createLabel,
  createPlaceholder,
  backLabel = "Chọn có sẵn",
  className = "input",
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  /** Nhãn của lựa chọn "để trống" (giá trị ""). */
  emptyLabel: string;
  /** Nhãn của lựa chọn mở ô nhập giá trị mới. */
  createLabel: string;
  createPlaceholder: string;
  backLabel?: string;
  className?: string;
}) {
  const [customMode, setCustomMode] = useState(() => value !== "" && !options.includes(value));

  if (customMode) {
    return (
      <div className="flex gap-2">
        <input
          className={className}
          autoFocus
          placeholder={createPlaceholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            setCustomMode(false);
            onChange("");
          }}
          className="btn-ghost-sm whitespace-nowrap"
        >
          {backLabel}
        </button>
      </div>
    );
  }

  return (
    <select
      className={className}
      value={value}
      onChange={(event) => {
        if (event.target.value === CUSTOM_VALUE) {
          setCustomMode(true);
          onChange("");
          return;
        }
        onChange(event.target.value);
      }}
    >
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
      <option value={CUSTOM_VALUE}>{createLabel}</option>
    </select>
  );
}
