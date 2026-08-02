/**
 * Premium KPI Card Component
 * Beautiful, animated card for displaying key metrics
 */

type KPICardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "danger" | "warning" | "primary";
  trend?: { value: number; label: string };
};

const VARIANT_STYLES = {
  default: {
    bg: "bg-white",
    border: "border-[#e5eaf7]",
    titleColor: "text-[#6b7aa1]",
    valueColor: "text-[#0f1729]",
    iconBg: "bg-gradient-to-br from-[#f5f8ff] to-[#eff3ff]",
    iconColor: "text-[#667eea]",
  },
  success: {
    bg: "bg-gradient-to-br from-emerald-50 to-green-50",
    border: "border-emerald-200",
    titleColor: "text-emerald-700",
    valueColor: "text-emerald-900",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-500",
    iconColor: "text-white",
  },
  danger: {
    bg: "bg-gradient-to-br from-red-50 to-rose-50",
    border: "border-red-200",
    titleColor: "text-red-700",
    valueColor: "text-red-900",
    iconBg: "bg-gradient-to-br from-red-500 to-rose-500",
    iconColor: "text-white",
  },
  warning: {
    bg: "bg-gradient-to-br from-amber-50 to-orange-50",
    border: "border-amber-200",
    titleColor: "text-amber-700",
    valueColor: "text-amber-900",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
    iconColor: "text-white",
  },
  primary: {
    bg: "bg-gradient-to-br from-[#667eea] to-[#764ba2]",
    border: "border-purple-300",
    titleColor: "text-white/80",
    valueColor: "text-white",
    iconBg: "bg-white/20",
    iconColor: "text-white",
  },
};

export default function PremiumKPICard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
  trend,
}: KPICardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`
        group relative overflow-hidden rounded-3xl border-2 p-6
        transition-all duration-300 cursor-pointer
        hover:scale-[1.02] hover:shadow-xl
        ${styles.bg} ${styles.border}
      `}
      style={{
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      {/* Background Decoration */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-white/20 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black uppercase tracking-[0.12em] ${styles.titleColor} mb-3`}>
            {title}
          </p>
          <p className={`text-3xl font-black tracking-tight ${styles.valueColor} mb-2`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-sm font-semibold ${styles.titleColor}`}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`text-xs font-bold ${
                  trend.value > 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {trend.value > 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>

        {icon && (
          <div
            className={`
              flex h-14 w-14 items-center justify-center rounded-2xl
              ${styles.iconBg} ${styles.iconColor}
              shadow-lg transition-transform duration-300
              group-hover:scale-110 group-hover:rotate-6
            `}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
