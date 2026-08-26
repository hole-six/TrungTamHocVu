"use client";

import { useEffect, useRef, useState } from "react";
import type { Column } from "./DataTable";
import DateRangeCalendarPopover from "@/components/ui/DateRangeCalendarPopover";
import NumberRangeFilterPopover from "@/components/ui/NumberRangeFilterPopover";

type DataTableFilterRowProps<T> = {
  columns: Column<T>[];
  values: Record<string, string>;
  onChange?: (paramKey: string, value: string | null, extra?: Record<string, string | null>) => void;
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
  onChange?: (paramKey: string, value: string | null, extra?: Record<string, string | null>) => void;
}) {
  return (
    <DateRangeCalendarPopover
      valueFrom={valueFrom}
      valueTo={valueTo}
      // Áp dụng cả 2 đầu ngày trong 1 lần gọi onChange duy nhất (kèm `extra`) — gọi
      // onChange 2 lần liên tiếp cho paramKeyFrom rồi paramKeyTo sẽ đua nhau: mỗi lần
      // updateParams() đều đọc lại searchParams cũ (chưa kịp cập nhật từ lần gọi trước),
      // nên lần gọi thứ 2 ghi đè mất thay đổi của lần gọi thứ 1 trên URL.
      onApply={(from, to) => onChange?.(paramKeyFrom, from, { [paramKeyTo]: to })}
    />
  );
}

function RangeFilterCell({
  paramKeyFrom,
  paramKeyTo,
  placeholder,
  valueFrom,
  valueTo,
  onChange,
}: {
  paramKeyFrom: string;
  paramKeyTo: string;
  placeholder?: string;
  valueFrom: string;
  valueTo: string;
  onChange?: (paramKey: string, value: string | null, extra?: Record<string, string | null>) => void;
}) {
  return (
    <NumberRangeFilterPopover
      valueFrom={valueFrom}
      valueTo={valueTo}
      unit={placeholder}
      // Cùng lý do với DateRangeFilterCell — gộp cả 2 đầu vào 1 lần gọi onChange thay vì
      // gọi 2 lần liên tiếp (mỗi lần đọc lại searchParams cũ, lần sau ghi đè mất lần trước).
      onApply={(from, to) => onChange?.(paramKeyFrom, from, { [paramKeyTo]: to })}
    />
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
