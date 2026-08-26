"use client";

import { useEffect, useRef, useState } from "react";
import type { Column } from "./DataTable";

type DataTableFilterRowProps<T> = {
  columns: Column<T>[];
  values: Record<string, string>;
  onChange?: (paramKey: string, value: string | null) => void;
  selectable?: boolean;
  hasActionsColumn?: boolean;
};

const FILTER_DEBOUNCE_MS = 400;

function TextFilterCell({
  paramKey,
  placeholder,
  value,
  onChange,
}: {
  paramKey: string;
  placeholder?: string;
  value: string;
  onChange?: (paramKey: string, value: string | null) => void;
}) {
  const [local, setLocal] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setLocal(value), [value]);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function handleChange(next: string) {
    setLocal(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange?.(paramKey, next || null), FILTER_DEBOUNCE_MS);
  }

  return (
    <input
      type="text"
      value={local}
      placeholder={placeholder ?? "Lọc..."}
      onChange={(event) => handleChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-sm font-normal normal-case text-[#111827] placeholder:text-[#9ca3af] focus:border-primary focus:outline-none"
    />
  );
}

function SelectFilterCell({
  paramKey,
  placeholder,
  options,
  value,
  onChange,
}: {
  paramKey: string;
  placeholder?: string;
  options: { label: string; value: string }[];
  value: string;
  onChange?: (paramKey: string, value: string | null) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange?.(paramKey, event.target.value || null)}
      onClick={(event) => event.stopPropagation()}
      className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-sm font-normal normal-case text-[#111827] focus:border-primary focus:outline-none"
    >
      <option value="">{placeholder ?? "Tất cả"}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function formatShortDate(iso: string) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [, month, day] = parts;
  return `${day}/${month}`;
}

// Gộp 2 ô ngày rời thành 1 nút gọn, chỉ mở rộng thành 2 ô "Từ/Đến" khi bấm vào —
// đỡ chiếm diện tích cột so với luôn hiện sẵn 2 input date cạnh nhau. Mở rộng NGAY
// TRONG ô (không dùng popover nổi) để tránh bị `overflow-x-auto` của bảng cha cắt mất.
function DateRangeFilterCell({
  paramKeyFrom,
  paramKeyTo,
  valueFrom,
  valueTo,
  onChange,
}: {
  paramKeyFrom: string;
  paramKeyTo: string;
  valueFrom: string;
  valueTo: string;
  onChange?: (paramKey: string, value: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasValue = Boolean(valueFrom || valueTo);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setExpanded(true);
        }}
        className="flex w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-left text-sm normal-case focus:border-primary focus:outline-none"
      >
        <span className={`truncate ${hasValue ? "font-medium text-[#111827]" : "text-[#9ca3af]"}`}>
          {hasValue ? `${formatShortDate(valueFrom) || "…"} – ${formatShortDate(valueTo) || "…"}` : "Khoảng ngày..."}
        </span>
        <span className="shrink-0 text-[#9ca3af]">📅</span>
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-primary/40 bg-white p-1.5 shadow-sm">
      <div className="flex items-center gap-1">
        <input
          type="date"
          defaultValue={valueFrom}
          onBlur={(event) => onChange?.(paramKeyFrom, event.target.value || null)}
          onClick={(event) => event.stopPropagation()}
          className="w-full min-w-0 rounded-md border border-[#d1d5db] bg-white px-1.5 py-1 text-xs normal-case text-[#111827] focus:border-primary focus:outline-none"
        />
        <span className="shrink-0 text-[10px] text-[#9ca3af]">–</span>
        <input
          type="date"
          defaultValue={valueTo}
          onBlur={(event) => onChange?.(paramKeyTo, event.target.value || null)}
          onClick={(event) => event.stopPropagation()}
          className="w-full min-w-0 rounded-md border border-[#d1d5db] bg-white px-1.5 py-1 text-xs normal-case text-[#111827] focus:border-primary focus:outline-none"
        />
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onChange?.(paramKeyFrom, null);
            onChange?.(paramKeyTo, null);
          }}
          className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
        >
          Xóa
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(false);
          }}
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          Xong
        </button>
      </div>
    </div>
  );
}

function RangeFilterCell({
  paramKeyFrom,
  paramKeyTo,
  type,
  placeholder,
  valueFrom,
  valueTo,
  onChange,
}: {
  paramKeyFrom: string;
  paramKeyTo: string;
  type: "date" | "number";
  placeholder?: string;
  valueFrom: string;
  valueTo: string;
  onChange?: (paramKey: string, value: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type={type}
        defaultValue={valueFrom}
        placeholder={type === "number" ? placeholder ?? "Từ" : undefined}
        onBlur={(event) => onChange?.(paramKeyFrom, event.target.value || null)}
        onClick={(event) => event.stopPropagation()}
        className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2 py-1.5 text-sm font-normal normal-case text-[#111827] focus:border-primary focus:outline-none"
      />
      <span className="text-[10px] text-[#9ca3af]">–</span>
      <input
        type={type}
        defaultValue={valueTo}
        placeholder={type === "number" ? placeholder ?? "Đến" : undefined}
        onBlur={(event) => onChange?.(paramKeyTo, event.target.value || null)}
        onClick={(event) => event.stopPropagation()}
        className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2 py-1.5 text-sm font-normal normal-case text-[#111827] focus:border-primary focus:outline-none"
      />
    </div>
  );
}

export default function DataTableFilterRow<T>({
  columns,
  values,
  onChange,
  selectable,
  hasActionsColumn,
}: DataTableFilterRowProps<T>) {
  return (
    <tr className="border-b border-[#e5e7eb] bg-[#fafbfc]">
      {selectable ? <th className="px-6 py-2" /> : null}

      {columns.map((column) => (
        <th key={column.key} className="px-2 py-2 text-left align-top">
          {!column.filter ? null : column.filter.type === "text" ? (
            <TextFilterCell
              paramKey={column.filter.paramKey}
              placeholder={column.filter.placeholder}
              value={values[column.filter.paramKey] ?? ""}
              onChange={onChange}
            />
          ) : column.filter.type === "select" ? (
            <SelectFilterCell
              paramKey={column.filter.paramKey}
              placeholder={column.filter.placeholder}
              options={column.filter.options}
              value={values[column.filter.paramKey] ?? ""}
              onChange={onChange}
            />
          ) : column.filter.type === "dateRange" ? (
            <DateRangeFilterCell
              paramKeyFrom={column.filter.paramKeyFrom}
              paramKeyTo={column.filter.paramKeyTo}
              valueFrom={values[column.filter.paramKeyFrom] ?? ""}
              valueTo={values[column.filter.paramKeyTo] ?? ""}
              onChange={onChange}
            />
          ) : (
            <RangeFilterCell
              paramKeyFrom={column.filter.paramKeyFrom}
              paramKeyTo={column.filter.paramKeyTo}
              type="number"
              placeholder={column.filter.placeholder}
              valueFrom={values[column.filter.paramKeyFrom] ?? ""}
              valueTo={values[column.filter.paramKeyTo] ?? ""}
              onChange={onChange}
            />
          )}
        </th>
      ))}

      {hasActionsColumn ? <th className="px-6 py-2" /> : null}
    </tr>
  );
}
