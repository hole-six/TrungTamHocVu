"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from "lucide-react";

// Thông báo nổi dùng chung cho toàn hệ thống.
//
// Vì sao cần: những thao tác BỊ HỆ THỐNG NGĂN vì mâu thuẫn dữ liệu (điểm danh cho học
// viên không thuộc buổi đó, chấm công vào kỳ đã khóa, đổi trạng thái không hợp lệ...)
// trước đây hoặc hiện bằng window.alert (chặn cả trình duyệt, xấu, không copy được),
// hoặc chỉ hiện chữ nhỏ trong form mà người dùng không nhìn thấy — nên họ tưởng bấm
// không ăn và bấm lại nhiều lần. Toast "ngăn cấm" phải nổi rõ và tự đứng lại đủ lâu
// để đọc hết lý do.
type ToastKind = "error" | "success" | "warning" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string; title?: string; ms: number };

type ToastApi = {
  /** Thao tác bị ngăn vì mâu thuẫn nghiệp vụ — đứng lâu, phải đọc được hết lý do. */
  blocked: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLE: Record<ToastKind, { box: string; accent: string; iconBox: string; icon: ReactNode; label: string }> = {
  error: {
    box: "border-rose-200 text-rose-950",
    accent: "bg-rose-500",
    iconBox: "bg-rose-50 text-rose-600",
    icon: <ShieldAlert className="h-5 w-5" strokeWidth={2.3} />,
    label: "Không thực hiện được",
  },
  warning: {
    box: "border-amber-200 text-amber-950",
    accent: "bg-amber-500",
    iconBox: "bg-amber-50 text-amber-600",
    icon: <AlertTriangle className="h-5 w-5" strokeWidth={2.3} />,
    label: "Cần lưu ý",
  },
  success: {
    box: "border-emerald-200 text-emerald-950",
    accent: "bg-emerald-500",
    iconBox: "bg-emerald-50 text-emerald-600",
    icon: <CheckCircle2 className="h-5 w-5" strokeWidth={2.3} />,
    label: "Đã xong",
  },
  info: {
    box: "border-sky-200 text-sky-950",
    accent: "bg-sky-500",
    iconBox: "bg-sky-50 text-sky-600",
    icon: <Info className="h-5 w-5" strokeWidth={2.3} />,
    label: "Thông báo",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const remove = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, message: string, title?: string, ms = 6000) => {
      const id = Date.now() + Math.random();
      setItems((current) => [...current.slice(-3), { id, kind, message, title, ms }]);
      window.setTimeout(() => remove(id), ms);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      // Lỗi do mâu thuẫn nghiệp vụ đứng 10 giây: câu giải thích thường dài (nói rõ vì
      // sao bị chặn và phải làm gì), 3-4 giây không đủ đọc.
      blocked: (m, t) => push("error", m, t ?? "Thao tác bị ngăn", 10000),
      error: (m, t) => push("error", m, t),
      success: (m, t) => push("success", m, t, 4000),
      warning: (m, t) => push("warning", m, t),
      info: (m, t) => push("info", m, t, 4000),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min(440px,calc(100vw-2rem))] flex-col gap-2">
              {items.map((item) => {
                const style = KIND_STYLE[item.kind];
                return (
                  <div
                    key={item.id}
                    role="alert"
                    className={`pointer-events-auto relative overflow-hidden rounded-2xl border bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.45)] ${style.box}`}
                  >
                    <div className={`absolute inset-y-0 left-0 w-1 ${style.accent}`} />
                    <div className="flex items-start gap-3 px-4 py-3 pl-5">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.iconBox}`}>{style.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-extrabold leading-5">{item.title ?? style.label}</p>
                        <p className="mt-1 whitespace-pre-line text-sm font-medium leading-5 text-slate-600">{item.message}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        aria-label="Đóng thông báo"
                        className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <X className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                    <div className="h-0.5 bg-slate-100">
                      <div
                        className={`h-full origin-left ${style.accent}`}
                        style={{ animation: `toastProgress ${item.ms}ms linear forwards` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

// Không ném lỗi khi thiếu Provider: nhiều component được dùng lại ở nơi chưa bọc
// Provider (vd trang in ấn) — thà không hiện toast còn hơn làm sập cả màn hình.
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return (
    ctx ?? {
      blocked: (m) => console.warn("[toast:blocked]", m),
      error: (m) => console.warn("[toast:error]", m),
      success: (m) => console.info("[toast:success]", m),
      warning: (m) => console.warn("[toast:warning]", m),
      info: (m) => console.info("[toast:info]", m),
    }
  );
}
