"use client";
import { useState, type ReactNode } from "react";
import type { Column, Action } from "./DataTable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type DataTableRowProps<T> = {
  row: T;
  columns: Column<T>[];
  actions: Action<T>[];
  selectable: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onClick?: () => void;
  renderExpanded?: (row: T) => ReactNode;
};

export default function DataTableRow<T extends Record<string, any>>({
  row,
  columns,
  actions,
  selectable,
  selected,
  onSelect,
  onClick,
  renderExpanded,
}: DataTableRowProps<T>) {
  const visibleActions = actions.filter((action) => !action.show || action.show(row));
  const [pendingAction, setPendingAction] = useState<Action<T> | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const totalColumnCount = columns.length + (selectable ? 1 : 0) + (visibleActions.length > 0 || renderExpanded ? 1 : 0);

  async function runAction(action: Action<T>) {
    await action.onClick(row);
  }

  async function handleActionClick(action: Action<T>) {
    if (action.confirmMessage) {
      setPendingAction(action);
      return;
    }
    await runAction(action);
  }

  async function handleConfirm() {
    if (!pendingAction) return;
    setConfirmLoading(true);
    try {
      await runAction(pendingAction);
      setPendingAction(null);
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <>
    <tr
      data-dt="row"
      className={`group bg-white transition-colors ${onClick ? "cursor-pointer hover:bg-[#fafafa]" : "hover:bg-[#fafafa]"} ${selected ? "bg-primary/5" : ""}`}
    >
      {selectable ? (
        <td className="w-12 px-6 py-3 align-middle">
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
            className={`px-6 py-3 align-middle text-sm ${
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

      {visibleActions.length > 0 || renderExpanded ? (
        <td data-dt="actions-cell" className="px-6 py-3 text-right align-middle">
          <div className="flex flex-nowrap items-center justify-end gap-2">
            {renderExpanded ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((current) => !current);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d9e3f7] bg-white px-3 py-2 text-xs font-semibold text-ink-muted64 transition-all hover:bg-[#f8fbff]"
              >
                {expanded ? "Thu gọn" : "Xem thêm"}
              </button>
            ) : null}
            {visibleActions.map((action, idx) => {
              const variantClasses = {
                primary: "border-primary/15 bg-primary/5 text-primary hover:bg-primary/10",
                secondary: "border-[#d9e3f7] bg-white text-ink-muted64 hover:bg-[#f8fbff]",
                danger: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
              };

              const iconOnly = action.iconOnly && action.icon;
              return (
                <button
                  data-dt-action={action.variant || "secondary"}
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleActionClick(action);
                  }}
                  className={`inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-xl border font-semibold transition-all ${
                    iconOnly ? "p-2" : "px-3 py-2 text-xs"
                  } ${variantClasses[action.variant || "secondary"]}`}
                  title={action.label}
                  aria-label={action.label}
                >
                  {action.icon ? <span className="flex h-4 w-4 items-center justify-center">{action.icon}</span> : null}
                  {iconOnly ? null : <span>{action.label}</span>}
                </button>
              );
            })}
          </div>
        </td>
      ) : null}

      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction?.confirmTitle || "Xác nhận thao tác"}
        description={pendingAction?.confirmMessage}
        confirmLabel={pendingAction?.label}
        tone={pendingAction?.variant === "danger" ? "danger" : "default"}
        loading={confirmLoading}
        onConfirm={handleConfirm}
        onClose={() => {
          if (!confirmLoading) setPendingAction(null);
        }}
      />
    </tr>
    {expanded && renderExpanded ? (
      <tr data-dt="row-expanded">
        <td colSpan={totalColumnCount} className="bg-white px-5 py-4 border-t border-[#f3f4f6]">
          {renderExpanded(row)}
        </td>
      </tr>
    ) : null}
    </>
  );
}
