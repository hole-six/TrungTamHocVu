"use client";

type DataPoint = {
  label: string;
  value: number;
};

type SimpleLineChartProps = {
  data: DataPoint[];
  title?: string;
  height?: number;
  color?: string;
  showDots?: boolean;
  showGrid?: boolean;
  formatValue?: (value: number) => string;
};

export default function SimpleLineChart({
  data,
  title,
  height = 200,
  color = "#3b82f6",
  showDots = true,
  showGrid = true,
  formatValue = (v) => v.toString(),
}: SimpleLineChartProps) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const min = Math.min(...data.map((d) => d.value)) || 0;
  const range = max - min || 1;

  const chartWidth = 100;
  const chartHeight = height - 60;
  const stepX = chartWidth / (data.length - 1 || 1);

  // Generate SVG path
  const points = data.map((point, i) => {
    const x = i * stepX;
    const y = chartHeight - ((point.value - min) / range) * chartHeight;
    return { x, y, value: point.value };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Generate area path (filled under line)
  const areaPathD = `${pathD} L ${points[points.length - 1].x} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <div className="rounded-xl border border-[#e8edf5] bg-white overflow-hidden">
      {title && (
        <div className="border-b border-[#e8edf5] px-6 py-4">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
        </div>
      )}

      <div className="p-6">
        <div style={{ height: `${height}px` }}>
          <svg
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            {showGrid && (
              <g>
                {[0, 25, 50, 75, 100].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={(y / 100) * chartHeight}
                    x2={chartWidth}
                    y2={(y / 100) * chartHeight}
                    stroke="#e5e7eb"
                    strokeWidth="0.5"
                  />
                ))}
              </g>
            )}

            {/* Area fill */}
            <path
              d={areaPathD}
              fill={color}
              fillOpacity="0.1"
            />

            {/* Line */}
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dots */}
            {showDots &&
              points.map((point, i) => (
                <g key={i}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="white"
                    stroke={color}
                    strokeWidth="2"
                  />
                </g>
              ))}
          </svg>

          {/* Labels */}
          <div className="flex justify-between mt-3">
            {data.map((item, i) => (
              <div key={i} className="flex-1 text-center">
                <p className="text-xs text-ink-muted64 truncate">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
