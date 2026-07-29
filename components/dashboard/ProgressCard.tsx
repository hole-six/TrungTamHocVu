"use client";

type ProgressCardProps = {
  title: string;
  current: number;
  total: number;
  description?: string;
  color?: string;
  showPercentage?: boolean;
  icon?: React.ReactNode;
  subtitle?: string;
};

export default function ProgressCard({
  title,
  current,
  total,
  description,
  color = "#3b82f6",
  showPercentage = true,
  icon,
  subtitle,
}: ProgressCardProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const isComplete = current >= total;

  return (
    <div className="rounded-xl border border-[#e8edf5] bg-gradient-to-br from-white to-[#fafbff] p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-ink-muted48">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-md"
            style={{ backgroundColor: color }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Progress Stats */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-display text-3xl font-bold text-ink">
          {current}
        </span>
        <span className="text-sm text-ink-muted48">/ {total}</span>
        {showPercentage && (
          <span
            className="ml-auto text-sm font-bold"
            style={{ color: isComplete ? "#10b981" : color }}
          >
            {percentage}%
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: isComplete ? "#10b981" : color,
          }}
        />
      </div>

      {description && (
        <p className="mt-3 text-xs text-ink-muted64">{description}</p>
      )}

      {isComplete && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Hoàn thành
        </div>
      )}
    </div>
  );
}
