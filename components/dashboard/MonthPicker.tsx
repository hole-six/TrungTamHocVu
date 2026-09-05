"use client";

import { useRouter } from "next/navigation";

type Props = {
  value: string; // "" = Tổng hợp (mặc định), "YYYY-MM" = đúng 1 tháng
  options: { value: string; label: string }[];
};

// Bộ lọc tháng cho Tổng quan — không chọn thì tự tổng hợp (snapshot/tất cả), chọn 1
// tháng thì mọi số liệu (data tuyển sinh, doanh thu, dòng tiền, học viên mới/nghỉ)
// lọc đúng tháng đó. Xem lib/server/reporting.ts (getReportsDashboardData) để biết
// cụ thể chỗ nào lọc theo tháng, chỗ nào vẫn luôn là snapshot hiện tại.
export default function MonthPicker({ value, options }: Props) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={(e) => router.push(e.target.value ? `/dashboard?month=${e.target.value}` : "/dashboard")}
      className="h-10 rounded-xl border border-[#e5eaf7] bg-white px-3 text-xs font-bold text-[#0f1729] shadow-sm outline-none cursor-pointer sm:h-11 sm:px-4 sm:text-sm"
    >
      <option value="">Tổng hợp (tất cả)</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
