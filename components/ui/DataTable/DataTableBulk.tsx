"use client";

import { useState } from "react";
import type { BulkAction } from "./DataTable";

type DataTableBulkProps<T> = {
  selectedCount: number;
  actions: BulkAction<T>[];
  selectedRows: T[];
  onClearSelection: () => void;
};

export default function DataTableBulk<T>({
  selectedCount,
  actions,
  selectedRows,
  onClearSelection,
}: DataTableBulkProps<T>) {
  const [showConfirm, setShowConfirm] = useState<{
    action: BulkAction<T>;
    show: boolean;
  } | null>(null);

  const handleAction = (action: BulkAction<T>) => {
    if (action.confirmMessage) {
      setShowConfirm({ action, show: true });
    } else {
      action.onClick(selectedRows);
      onClearSelection();
    }
  };

  const confirmAction = () => {
    if (showConfirm) {
      showConfirm.action.onClick(selectedRows);
      onClearSelection();
      setShowConfirm(null);
    }
  };

  const variantClasses = {
    primary: "btn-primary",
    secondary: "btn-ghost",
    danger: "bg-red-600 text-white hover:bg-red-700 border-red-600",
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-xl border-2 border-primary/30 bg-primary/5 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">
            {selectedCount}
          </div>
          <p className="text-sm font-semibold text-ink">
            {selectedCount} mục đã chọn
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Actions */}
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleAction(action)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                variantClasses[action.variant || "secondary"]
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}

          {/* Clear selection */}
          <button
            onClick={onClearSelection}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#e8edf5] bg-white text-ink-muted64 transition-all hover:bg-[#f1f5f9] hover:border-primary/50"
            title="Bỏ chọn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirm?.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#e8edf5] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 className="font-display text-lg font-bold text-ink mb-2">
              Xác nhận thao tác
            </h3>
            <p className="text-sm text-ink-muted64 mb-6">
              {showConfirm.action.confirmMessage}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="btn-ghost flex-1"
              >
                Hủy
              </button>
              <button
                onClick={confirmAction}
                className={`flex-1 ${
                  variantClasses[showConfirm.action.variant || "primary"]
                }`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
