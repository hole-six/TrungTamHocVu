/**
 * Premium Progress Bar with Gradient
 * Animated, beautiful progress visualization
 */

type ProgressBarProps = {
  percentage: number;
  label?: string;
  showPercentage?: boolean;
  variant?: "default" | "success" | "warning" | "danger";
  height?: "sm" | "md" | "lg";
};

const VARIANT_GRADIENTS = {
  default: "from-blue-500 via-cyan-500 to-teal-500",
  success: "from-emerald-500 via-green-500 to-teal-500",
  warning: "from-amber-500 via-orange-500 to-red-500",
  danger: "from-red-500 via-rose-500 to-pink-500",
};

const HEIGHT_STYLES = {
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
};

export default function PremiumProgressBar({
  percentage,
  label,
  showPercentage = true,
  variant = "success",
  height = "lg",
}: ProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const gradient = VARIANT_GRADIENTS[variant];
  const heightClass = HEIGHT_STYLES[height];

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-3">
          {label && (
            <span className="text-sm font-bold text-[#3d4b6e]">{label}</span>
          )}
          {showPercentage && (
            <span className="text-lg font-black text-[#0f1729]">
              {clampedPercentage}%
            </span>
          )}
        </div>
      )}

      <div className={`relative overflow-hidden rounded-full bg-gradient-to-r from-gray-100 to-gray-200 ${heightClass}`}>
        {/* Progress Fill */}
        <div
          className={`
            absolute inset-y-0 left-0 rounded-full 
            bg-gradient-to-r ${gradient}
            shadow-lg transition-all duration-1000 ease-out
          `}
          style={{
            width: `${clampedPercentage}%`,
            animation: "slideIn 1s ease-out",
          }}
        >
          {/* Shine Effect */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            style={{
              animation: "shimmer 2s infinite",
            }}
          />
        </div>

        {/* Milestone Markers */}
        {[25, 50, 75].map((milestone) => (
          <div
            key={milestone}
            className="absolute top-0 bottom-0 w-px bg-white/40"
            style={{ left: `${milestone}%` }}
          />
        ))}
      </div>

      {/* Milestone Labels */}
      <div className="flex justify-between mt-2 px-1">
        <span className="text-xs font-semibold text-gray-400">0%</span>
        <span className="text-xs font-semibold text-gray-400">25%</span>
        <span className="text-xs font-semibold text-gray-400">50%</span>
        <span className="text-xs font-semibold text-gray-400">75%</span>
        <span className="text-xs font-semibold text-gray-400">100%</span>
      </div>
    </div>
  );
}
