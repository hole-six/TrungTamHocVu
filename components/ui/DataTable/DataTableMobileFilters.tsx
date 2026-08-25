"use client";

import { useState } from "react";
import type { Column } from "./DataTable";

type DataTableMobileFiltersProps<T> = {
  columns: Column<T>[];
  values: Record<string, string>;
  onChange?: (paramKey: string, value: string | null) => void;
};

// Mobile không có <thead> để gắn hàng lọc như bản desktop (DataTableFilterRow) — dùng
// cùng nguồn columns/values/onChange, chỉ đổi cách hiển thị thành panel thu gọn xếp dọc.
export default function DataTableMobileFilters<T>({ columns, values, onChange }: DataTableMobileFiltersProps<T>) {
  const filterable = columns.filter((column) => column.filter);
  const [open, setOpen] = useState(false);
  const activeCount = filterable.filter((column) => {
    const f = column.filter!;
    if (f.type === "text" || f.type === "select") return Boolean(values[f.paramKey]);
    return Boolean(values[f.paramKeyFrom] || values[f.paramKeyTo]);
  }).length;

  if (filterable.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-[#111827]"
      >
        <span className="flex items-center gap-2">
          Bộ lọc
          {activeCount > 0 ? (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary">
              {activeCount}
            </span>
          ) : null}
        </span>
        <svg
          className={`h-4 w-4 text-[#6b7280] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[#e5e7eb] px-4 py-3">
          {filterable.map((column) => {
            const f = column.filter!;
            return (
              <label key={column.key} className="block">
                <span className="mb-1 block text-xs font-semibold text-[#6b7280]">{column.label}</span>
                {f.type === "text" ? (
                  <input
                    type="text"
                    defaultValue={values[f.paramKey] ?? ""}
                    placeholder={f.placeholder ?? "Lọc..."}
                    onBlur={(event) => onChange?.(f.paramKey, event.target.value || null)}
                    className="input"
                  />
                ) : f.type === "select" ? (
                  <select
                    value={values[f.paramKey] ?? ""}
                    onChange={(event) => onChange?.(f.paramKey, event.target.value || null)}
                    className="input"
                  >
                    <option value="">{f.placeholder ?? "Tất cả"}</option>
                    {f.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type={f.type === "dateRange" ? "date" : "number"}
                      defaultValue={values[f.paramKeyFrom] ?? ""}
                      onBlur={(event) => onChange?.(f.paramKeyFrom, event.target.value || null)}
                      className="input"
                    />
                    <span className="text-xs text-[#9ca3af]">–</span>
                    <input
                      type={f.type === "dateRange" ? "date" : "number"}
                      defaultValue={values[f.paramKeyTo] ?? ""}
                      onBlur={(event) => onChange?.(f.paramKeyTo, event.target.value || null)}
                      className="input"
                    />
                  </div>
                )}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
