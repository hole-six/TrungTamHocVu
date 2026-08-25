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
      className="w-full min-w-0 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-xs font-normal normal-case text-[#111827] placeholder:text-[#9ca3af] focus:border-primary focus:outline-none"
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
      className="w-full min-w-0 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-xs font-normal normal-case text-[#111827] focus:border-primary focus:outline-none"
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
        className="w-full min-w-0 rounded-md border border-[#e5e7eb] bg-white px-1.5 py-1 text-xs font-normal normal-case text-[#111827] focus:border-primary focus:outline-none"
      />
      <span className="text-[10px] text-[#9ca3af]">–</span>
      <input
        type={type}
        defaultValue={valueTo}
        placeholder={type === "number" ? placeholder ?? "Đến" : undefined}
        onBlur={(event) => onChange?.(paramKeyTo, event.target.value || null)}
        onClick={(event) => event.stopPropagation()}
        className="w-full min-w-0 rounded-md border border-[#e5e7eb] bg-white px-1.5 py-1 text-xs font-normal normal-case text-[#111827] focus:border-primary focus:outline-none"
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
        <th key={column.key} className="px-6 py-2 text-left align-top">
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
            <RangeFilterCell
              paramKeyFrom={column.filter.paramKeyFrom}
              paramKeyTo={column.filter.paramKeyTo}
              type="date"
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
