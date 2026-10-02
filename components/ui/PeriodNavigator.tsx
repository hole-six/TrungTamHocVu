"use client";

// THANH THỜI GIAN DÙNG CHUNG CHO TOÀN HỆ THỐNG.
//
// Một kiểu chọn thời gian duy nhất cho mọi màn có dữ liệu theo ngày: lịch, bảng điều
// hành, chấm công, học phí, sổ quỹ, data tuyển sinh... Trước đây mỗi màn một kiểu nên
// người dùng phải học lại cách lọc ở từng chỗ.
//
//   ◀  TUẦN 40/2026  ▶     [Tuần] [Tháng]     Tuần trước · Tuần này · Tuần sau
//      28/09 – 04/10/2026
//
// Ghi thẳng vào URL (mode/week/month) nên chia sẻ được đường dẫn và bấm Back được.
// Trang nào cần thêm cặp from/to của riêng nó thì khai `rangeParams` — thanh này ghi
// luôn, khỏi phải sửa phần lọc sẵn có của trang đó.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { currentKey, resolvePeriod, type PeriodMode } from "@/lib/period-range";

export default function PeriodNavigator({
  rangeParams,
  className = "",
  showModeToggle = true,
  label,
  resetParams = [],
  children,
}: {
  /** Tên tham số from/to của trang, nếu trang đó đang lọc theo khoảng ngày sẵn có. */
  rangeParams?: { from: string; to: string };
  className?: string;
  /** Trang chỉ chạy theo tuần (vd thời khoá biểu) thì tắt nút đổi Tuần/Tháng. */
  showModeToggle?: boolean;
  /** Nhãn cho biết đang lọc theo ngày gì, vd "Ngày thu chi", "Data nhận". */
  label?: string;
  /** Param cần xoá kèm khi đổi khoảng (vd về trang 1, bỏ lọc chéo). */
  resetParams?: string[];
  /** Ô chọn khoảng ngày tự do, đặt cuối thanh — xem TopDateRangeFilter. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const period = resolvePeriod({
    mode: searchParams.get("mode"),
    week: searchParams.get("week"),
    month: searchParams.get("month"),
  });

  function go(mode: PeriodMode, key: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", mode);
    next.set(mode === "month" ? "month" : "week", key);
    // Bỏ khoá của chế độ kia để URL không giữ hai mốc mâu thuẫn nhau.
    next.delete(mode === "month" ? "week" : "month");

    if (rangeParams) {
      const resolved = resolvePeriod({ mode, week: mode === "week" ? key : null, month: mode === "month" ? key : null });
      next.set(rangeParams.from, resolved.start.toISOString().slice(0, 10));
      next.set(rangeParams.to, resolved.end.toISOString().slice(0, 10));
    }
    // Đổi khoảng thời gian thì về trang đầu, nếu không sẽ đứng ở trang 5 của dữ liệu cũ.
    for (const param of resetParams) next.delete(param);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const unit = period.mode === "month" ? "Tháng" : "Tuần";
  const quick = [
    { label: `${unit} trước`, key: period.prevKey },
    { label: `${unit} này`, key: currentKey(period.mode), highlight: true },
    { label: `${unit} sau`, key: period.nextKey },
  ];

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-2xl border border-[#e3ecf6] bg-white px-3 py-2 sm:gap-3 sm:px-4 ${className}`}
      data-period-navigator
    >
      {label ? (
        <span className="px-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#94a3b8]">{label}</span>
      ) : null}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => go(period.mode, period.prevKey)}
          aria-label={`${unit} trước`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dbe7f5] text-[#475569] transition hover:border-primary/50 hover:text-primary"
        >
          ‹
        </button>
        <div className="min-w-[9.5rem] px-2 text-center">
          <p className="whitespace-nowrap text-sm font-black tracking-tight text-[#0f1729]">
            {period.label}
            {period.isCurrent ? <span className="ml-1.5 text-[10px] font-black text-primary">• nay</span> : null}
          </p>
          <p className="whitespace-nowrap text-[11px] font-semibold text-ink-muted48">
            {period.rangeLabel}
            {period.weeksInYear ? <span className="text-[#aebbcc]"> · năm {period.weeksInYear} tuần</span> : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => go(period.mode, period.nextKey)}
          aria-label={`${unit} sau`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dbe7f5] text-[#475569] transition hover:border-primary/50 hover:text-primary"
        >
          ›
        </button>
      </div>

      {showModeToggle ? (
        <div className="flex items-center gap-0.5 rounded-xl bg-[#f1f5fb] p-0.5">
          {(["week", "month"] as PeriodMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => go(mode, currentKey(mode))}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                period.mode === mode ? "bg-white text-[#0f1729] shadow-sm" : "text-[#64748b] hover:text-[#0f1729]"
              }`}
            >
              {mode === "week" ? "Tuần" : "Tháng"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {quick.map((item) => {
          const active = item.key === period.key;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => go(period.mode, item.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : item.highlight
                    ? "border-[#dbe7f5] bg-white text-[#334155] hover:border-primary/40 hover:text-primary"
                    : "border-transparent bg-[#f4f7fb] text-[#64748b] hover:bg-[#e9eff8] hover:text-[#0f1729]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {children}
    </div>
  );
}
