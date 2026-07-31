"use client";
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
  const visibleActions = actions.filter((action) => !action.show || action.show(row));

  return (
    <tr
      className={`group transition-colors ${onClick ? "cursor-pointer hover:bg-primary/5" : ""} ${selected ? "bg-primary/10" : ""}`}
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
          <div className="flex items-center justify-end gap-2">
            {visibleActions.map((action, idx) => {
              const variantClasses = {
                primary: "border-primary/15 bg-primary/5 text-primary hover:bg-primary/10",
                secondary: "border-[#d9e3f7] bg-white text-ink-muted64 hover:bg-[#f8fbff]",
                danger: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
              };

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void action.onClick(row);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${variantClasses[action.variant || "secondary"]}`}
                  title={action.label}
                >
                  {action.icon ? <span className="flex h-4 w-4 items-center justify-center">{action.icon}</span> : null}
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </td>
      ) : null}
    </tr>
  );
}
