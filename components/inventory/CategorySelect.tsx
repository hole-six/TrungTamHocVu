"use client";

import { useState } from "react";

const CUSTOM_VALUE = "__custom__";

// Chọn từ danh mục sẵn có để tránh gõ lệch tên (vd "Everybody Up" vs "everybody up")
// làm dữ liệu danh mục bị phân mảnh — vẫn cho thêm danh mục mới khi thật sự cần.
export default function CategorySelect({
  value,
  onChange,
  categoryOptions,
  className = "input",
}: {
  value: string;
  onChange: (next: string) => void;
  categoryOptions: string[];
  className?: string;
}) {
  const [customMode, setCustomMode] = useState(() => value !== "" && !categoryOptions.includes(value));

  if (customMode) {
    return (
      <div className="flex gap-2">
        <input
          className={className}
          autoFocus
          placeholder="Nhập tên danh mục mới"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            setCustomMode(false);
            onChange("");
          }}
          className="btn-ghost whitespace-nowrap px-3 text-xs"
        >
          Chọn có sẵn
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
      <option value="">Sách khác (chưa xếp danh mục)</option>
      {categoryOptions.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
      <option value={CUSTOM_VALUE}>+ Danh mục mới...</option>
    </select>
  );
}
