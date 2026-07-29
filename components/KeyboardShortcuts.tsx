"use client";

import { useEffect, useCallback, useState } from "react";

export type ShortcutAction = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Command key on Mac
  description: string;
  action: () => void;
  preventDefault?: boolean;
};

type KeyboardShortcutsProps = {
  shortcuts: ShortcutAction[];
  enabled?: boolean;
  showHelp?: boolean;
};

export default function KeyboardShortcuts({
  shortcuts,
  enabled = true,
  showHelp = true,
}: KeyboardShortcutsProps) {
  const [showHelpModal, setShowHelpModal] = useState(false);

  const matchesShortcut = useCallback(
    (event: KeyboardEvent, shortcut: ShortcutAction): boolean => {
      const key = event.key.toLowerCase();
      const targetKey = shortcut.key.toLowerCase();

      return (
        key === targetKey &&
        !!event.ctrlKey === !!shortcut.ctrl &&
        !!event.shiftKey === !!shortcut.shift &&
        !!event.altKey === !!shortcut.alt &&
        !!event.metaKey === !!shortcut.meta
      );
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check for help shortcut (Ctrl+? or Ctrl+/)
      if ((event.ctrlKey || event.metaKey) && (event.key === "?" || event.key === "/")) {
        event.preventDefault();
        setShowHelpModal((prev) => !prev);
        return;
      }

      // Check all shortcuts
      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action();
          break;
        }
      }
    },
    [enabled, shortcuts, matchesShortcut]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const getKeyDisplay = (shortcut: ShortcutAction): string => {
    const parts: string[] = [];
    
    if (shortcut.ctrl) parts.push("Ctrl");
    if (shortcut.meta) parts.push("⌘");
    if (shortcut.alt) parts.push("Alt");
    if (shortcut.shift) parts.push("Shift");
    parts.push(shortcut.key.toUpperCase());
    
    return parts.join(" + ");
  };

  if (!showHelp) return null;

  return (
    <>
      {/* Help Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl border p-6 shadow-2xl mx-4"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  ⌨️ Phím tắt
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  Các phím tắt giúp làm việc nhanh hơn
                </p>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="btn-icon"
                aria-label="Đóng"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Shortcuts list */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {shortcuts.length === 0 ? (
                <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                  <p className="text-sm">Chưa có phím tắt nào được định nghĩa</p>
                </div>
              ) : (
                shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border"
                    style={{
                      backgroundColor: "var(--bg-muted)",
                      borderColor: "var(--border-secondary)",
                    }}
                  >
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {shortcut.description}
                    </span>
                    <kbd className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 shadow-sm">
                      {getKeyDisplay(shortcut)}
                    </kbd>
                  </div>
                ))
              )}

              {/* Default shortcuts */}
              <div className="pt-4 mt-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                  Phím tắt hệ thống
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4 p-2 rounded text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Hiển thị trợ giúp</span>
                    <kbd className="inline-flex items-center gap-1 rounded bg-white dark:bg-gray-800 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                      Ctrl + ?
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-2 rounded text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Đóng modal/dialog</span>
                    <kbd className="inline-flex items-center gap-1 rounded bg-white dark:bg-gray-800 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                      ESC
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                💡 Nhấn <strong>Ctrl + ?</strong> bất cứ lúc nào để xem phím tắt
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Hook to use keyboard shortcuts in any component
export function useKeyboardShortcut(
  shortcut: Omit<ShortcutAction, "description">,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const targetKey = shortcut.key.toLowerCase();

      const matches =
        key === targetKey &&
        !!event.ctrlKey === !!shortcut.ctrl &&
        !!event.shiftKey === !!shortcut.shift &&
        !!event.altKey === !!shortcut.alt &&
        !!event.metaKey === !!shortcut.meta;

      if (matches) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, shortcut]);
}

// Common shortcuts preset
export const commonShortcuts = {
  save: (action: () => void): ShortcutAction => ({
    key: "s",
    ctrl: true,
    description: "Lưu thay đổi",
    action,
  }),
  search: (action: () => void): ShortcutAction => ({
    key: "k",
    ctrl: true,
    description: "Tìm kiếm",
    action,
  }),
  create: (action: () => void): ShortcutAction => ({
    key: "n",
    ctrl: true,
    description: "Tạo mới",
    action,
  }),
  delete: (action: () => void): ShortcutAction => ({
    key: "Delete",
    description: "Xóa",
    action,
  }),
  edit: (action: () => void): ShortcutAction => ({
    key: "e",
    ctrl: true,
    description: "Chỉnh sửa",
    action,
  }),
  cancel: (action: () => void): ShortcutAction => ({
    key: "Escape",
    description: "Hủy / Đóng",
    action,
    preventDefault: false,
  }),
  refresh: (action: () => void): ShortcutAction => ({
    key: "r",
    ctrl: true,
    description: "Làm mới dữ liệu",
    action,
  }),
  selectAll: (action: () => void): ShortcutAction => ({
    key: "a",
    ctrl: true,
    description: "Chọn tất cả",
    action,
  }),
  print: (action: () => void): ShortcutAction => ({
    key: "p",
    ctrl: true,
    description: "In",
    action,
  }),
  export: (action: () => void): ShortcutAction => ({
    key: "e",
    ctrl: true,
    shift: true,
    description: "Xuất dữ liệu",
    action,
  }),
};
