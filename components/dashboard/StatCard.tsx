"use client";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    direction: "up" | "down" | "neutral";
  };
  color?: "primary" | "success" | "warning" | "danger" | "info";
  loading?: boolean;
  onClick?: () => void;
};

const colorClasses = {
  primary: "from-sky-400 to-blue-600",
  success: "from-emerald-500 to-teal-600",
  warning: "from-amber-500 to-orange-600",
  danger: "from-red-500 to-rose-600",
  info: "from-cyan-500 to-blue-600",
};

const trendColors = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
  neutral: "text-gray-600 bg-gray-50",
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = "primary",
  loading = false,
  onClick,
}: StatCardProps) {
  return (
    <div
      className={`rounded-xl border border-[#e8edf5] bg-gradient-to-br from-white to-[#fafbff] p-6 shadow-sm transition-all hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted48">
            {title}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
              {value}
            </p>
          )}
          {subtitle && (
            <p className="mt-1 text-xs text-ink-muted48">{subtitle}</p>
          )}
          
          {trend && !loading && (
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
                  trendColors[trend.direction]
                }`}
              >
                {trend.direction === "up" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                )}
                {trend.direction === "down" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
                {trend.direction === "neutral" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
                {trend.value > 0 ? "+" : ""}{trend.value}%
              </span>
              <span className="text-xs text-ink-muted48">{trend.label}</span>
            </div>
          )}
        </div>

        {icon && (
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${colorClasses[color]} text-white shadow-md`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
