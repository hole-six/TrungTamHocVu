"use client";

import { SHIFT_PRESETS, matchPresetKey, shiftDays, shiftHours, type ShiftTimes } from "@/lib/timesheet-shifts";

// Chọn CA LÀM VIỆC: bấm ca mẫu hoặc gõ thẳng giờ từ–đến. Bỏ trống một ca = hôm đó không
// làm ca đó (vd chỉ làm buổi sáng).
export default function ShiftPicker({
  value,
  onChange,
  compact,
}: {
  value: ShiftTimes;
  onChange: (next: ShiftTimes) => void;
  compact?: boolean;
}) {
  const hours = shiftHours(value);
  const presetKey = matchPresetKey(value);

  function set(key: keyof ShiftTimes, next: string) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {SHIFT_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onChange(preset.times)}
            className={`rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${
              presetKey === preset.key
                ? "border-[#0f1729] bg-[#0f1729] text-white"
                : "border-[#e2e8f0] bg-white text-[#0f1729] hover:border-[#0f1729]"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        <label className="space-y-1">
          <span className="label-sm">Sáng — vào</span>
          <input type="time" className="input" value={value.checkInAm} onChange={(event) => set("checkInAm", event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="label-sm">Sáng — ra</span>
          <input type="time" className="input" value={value.checkOutAm} onChange={(event) => set("checkOutAm", event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="label-sm">Chiều — vào</span>
          <input type="time" className="input" value={value.checkInPm} onChange={(event) => set("checkInPm", event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="label-sm">Chiều — ra</span>
          <input type="time" className="input" value={value.checkOutPm} onChange={(event) => set("checkOutPm", event.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Tổng giờ trong ngày</span>
        <span className="text-sm font-bold tabular-nums text-[#0f1729]">
          {hours.toFixed(2)} giờ · {shiftDays(hours).toFixed(2)} công
        </span>
      </div>
      {hours <= 0 ? <p className="text-xs text-[#b45309]">Chưa có giờ nào — nhập ít nhất một ca (vào và ra).</p> : null}
    </div>
  );
}
