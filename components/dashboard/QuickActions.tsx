"use client";

import { useRouter } from "next/navigation";

type QuickAction = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  color?: "primary" | "success" | "warning" | "danger" | "info";
  badge?: string | number;
  disabled?: boolean;
};

type QuickActionsProps = {
  actions: QuickAction[];
  columns?: 2 | 3 | 4;
  title?: string;
};

const colorClasses = {
  primary: "from-sky-400 to-blue-600 hover:from-sky-500 hover:to-blue-700",
  success: "from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700",
  warning: "from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700",
  danger: "from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700",
  info: "from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700",
};

export default function QuickActions({
  actions,
  columns = 3,
  title = "Thao tác nhanh",
}: QuickActionsProps) {
  const router = useRouter();

  const handleClick = (action: QuickAction) => {
    if (action.disabled) return;
    if (action.onClick) {
      action.onClick();
    } else if (action.href) {
      router.push(action.href);
    }
  };

  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className="rounded-xl border border-[#e8edf5] bg-white overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#e8edf5] px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-ink">{title}</h3>
        </div>
      </div>

      {/* Actions Grid */}
      <div className={`grid ${gridCols[columns]} gap-4 p-6`}>
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleClick(action)}
            disabled={action.disabled}
            className={`group relative flex flex-col items-center gap-3 rounded-xl border border-[#e8edf5] bg-gradient-to-br from-white to-[#fafbff] p-6 transition-all hover:shadow-lg hover:border-primary/30 ${
              action.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            {/* Badge */}
            {action.badge && (
              <span className="absolute top-2 right-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">
                {action.badge}
              </span>
            )}

            {/* Icon */}
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${
                colorClasses[action.color || "primary"]
              } text-white shadow-md transition-transform group-hover:scale-110`}
            >
              {action.icon}
            </div>

            {/* Label */}
            <div className="text-center">
              <p className="text-sm font-semibold text-ink">
                {action.label}
              </p>
              {action.description && (
                <p className="mt-1 text-xs text-ink-muted48">
                  {action.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
