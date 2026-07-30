"use client";

import { useState } from "react";
import type { Column, Action } from "./DataTable";

type DataTableRowProps<T> = {
  row: T;
  columns: Column<T>[];
  actions: Action<T>[];
  selectable: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onClick?: () => void;
};

export default function DataTableRow<T extends Record<string, any>>({
  row,
  columns,
  actions,
  selectable,
  selected,
  onSelect,
  onClick,
}: DataTableRowProps<T>) {
  const [showActions, setShowActions] = useState(false);
  const visibleActions = actions.filter((action) => !action.show || action.show(row));

  return (
    <tr
      className={`group transition-colors ${onClick ? "cursor-pointer hover:bg-primary/5" : ""} ${selected ? "bg-primary/10" : ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {selectable ? (
        <td className="w-12 px-4 py-3 align-middle">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
            className="h-4 w-4 rounded border-2 border-[#cbd5e1] text-primary focus:ring-2 focus:ring-primary/20"
          />
        </td>
      ) : null}

      {columns.map((column) => {
        const value = row[column.key];
        const content = column.render ? column.render(value, row) : value;

        return (
          <td
            key={column.key}
            className={`px-4 py-3 align-middle text-sm ${
              column.align === "center"
                ? "text-center"
                : column.align === "right"
                  ? "text-right"
                  : ""
            } ${column.className || ""}`}
            onClick={onClick}
          >
            {content}
          </td>
        );
      })}

      {actions.length > 0 ? (
        <td className="px-4 py-3 text-right align-middle">
          <div
            className={`flex items-center justify-end gap-2 transition-opacity ${
              showActions || selected ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
            }`}
          >
            {visibleActions.map((action, idx) => {
              const variantClasses = {
                primary: "text-primary hover:bg-primary/10",
                secondary: "text-ink-muted64 hover:bg-[#f1f5f9]",
                danger: "text-red-600 hover:bg-red-50",
              };

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void action.onClick(row);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${variantClasses[action.variant || "secondary"]}`}
                  title={action.label}
                >
                  {action.icon || (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="1"/>
                      <circle cx="12" cy="5" r="1"/>
                      <circle cx="12" cy="19" r="1"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </td>
      ) : null}
    </tr>
  );
}
