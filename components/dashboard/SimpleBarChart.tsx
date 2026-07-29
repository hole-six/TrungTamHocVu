"use client";

type DataPoint = {
  label: string;
  value: number;
  color?: string;
};

type SimpleBarChartProps = {
  data: DataPoint[];
  title?: string;
  height?: number;
  showValues?: boolean;
  maxValue?: number;
  formatValue?: (value: number) => string;
};

export default function SimpleBarChart({
  data,
  title,
  height = 200,
  showValues = true,
  maxValue,
  formatValue = (v) => v.toString(),
}: SimpleBarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value)) || 1;
  const colors = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b",
    "#ef4444", "#06b6d4", "#10b981", "#f97316", "#6366f1",
  ];

  return (
    <div className="rounded-xl border border-[#e8edf5] bg-white overflow-hidden">
      {title && (
        <div className="border-b border-[#e8edf5] px-6 py-4">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
        </div>
      )}
      
      <div className="p-6">
        <div className="flex items-end justify-between gap-2" style={{ height: `${height}px` }}>
          {data.map((item, index) => {
            const barHeight = (item.value / max) * 100;
            const color = item.color || colors[index % colors.length];

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                {/* Value Label */}
                {showValues && (
                  <div className="text-xs font-semibold text-ink whitespace-nowrap">
                    {formatValue(item.value)}
                  </div>
                )}

                {/* Bar */}
                <div className="relative w-full flex items-end" style={{ height: `${height - 40}px` }}>
                  <div
                    className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80"
                    style={{
                      height: `${barHeight}%`,
                      backgroundColor: color,
                      minHeight: item.value > 0 ? "8px" : "0",
                    }}
                  />
                </div>

                {/* Label */}
                <div className="text-xs text-ink-muted64 text-center max-w-full truncate">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
