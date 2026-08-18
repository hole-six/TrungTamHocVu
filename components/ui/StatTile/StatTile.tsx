import type { ReactNode } from "react";

export type StatTileTone = "default" | "soft" | "primary";

export type StatTileProps = {
  /** Icon SVG/ReactNode hiển thị trong khung tròn góc trên — bỏ trống nếu tile không cần icon. */
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /**
   * "default": card trắng + khung icon nổi (dùng cho lưới KPI đầu trang).
   * "soft": nền nhạt, không khung icon (dùng cho tile phụ trong 1 khối lớn hơn, vd "Hành trình học").
   * "primary": nền gradient cam, chữ trắng — dùng khi cần 1 tile nổi bật nhất trong lưới.
   */
  tone?: StatTileTone;
  /** data-tour cho SpotlightTour, nếu tile này cần được hướng dẫn. */
  dataTour?: string;
  className?: string;
};

const TONE_CLASS: Record<StatTileTone, string> = {
  default:
    "border border-hairline bg-white shadow-sm hover:shadow-lg hover:-translate-y-1",
  soft: "border border-hairline bg-[#f8faff]",
  primary: "border border-transparent text-white shadow-lg hover:shadow-xl hover:-translate-y-1",
};

/**
 * Tile số liệu dùng chung cho toàn hệ thống (lưới KPI đầu trang, khối tóm tắt trong
 * trang chi tiết...). Trước đây mỗi trang tự viết lại markup này (icon SVG hand-inline,
 * bg/hover riêng) — StatTile gộp thành 1 nơi để sửa 1 chỗ là đồng bộ toàn hệ thống.
 */
export default function StatTile({ icon, label, value, hint, tone = "default", dataTour, className = "" }: StatTileProps) {
  return (
    <div
      data-tour={dataTour}
      className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 transition-all duration-300 ${TONE_CLASS[tone]} ${className}`}
      style={tone === "primary" ? { background: "var(--gradient-primary)" } : undefined}
    >
      {icon ? (
        <div
          className={`mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl ${
            tone === "primary" ? "bg-white/20" : "border border-hairline bg-white shadow-md"
          }`}
        >
          {icon}
        </div>
      ) : null}
      <p
        className={`mb-0.5 sm:mb-1 text-[10px] sm:text-xs font-bold uppercase tracking-wide ${
          tone === "primary" ? "text-white/80" : "text-ink-muted48"
        }`}
      >
        {label}
      </p>
      <p className={`mb-0.5 sm:mb-1 text-lg sm:text-xl md:text-2xl font-black ${tone === "primary" ? "text-white" : "text-ink"}`}>
        {value}
      </p>
      {hint ? (
        <p className={`truncate text-[10px] sm:text-xs font-semibold ${tone === "primary" ? "text-white/80" : "text-ink-muted48"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
