import type { ReactNode } from "react";
import StatTile, { type StatTileProps } from "@/components/ui/StatTile/StatTile";
import BackButton from "@/components/ui/BackButton";

export type PageHeroProps = {
  /** Link "quay lại danh sách" phía trên tiêu đề — bỏ trống nếu trang không cần. */
  backHref?: string;
  backLabel?: ReactNode;
  /** Chữ hiển thị trong khung avatar tròn góc trái (thường là chữ cái đầu tên). Bỏ trống để ẩn avatar. */
  avatarLabel?: string;
  /** Icon thay avatar chữ, nếu trang muốn dùng icon thay vì chữ cái đầu. */
  avatarIcon?: ReactNode;
  /** Pill trạng thái nổi bật nhất (vd "ĐANG HỌC"/"ĐÃ NGHỈ") — hiển thị phía trên tiêu đề. */
  statusPill?: ReactNode;
  title: string;
  /** Hàng badge phụ dưới tiêu đề (mã học viên, tên lớp, cảnh báo nợ...) — mỗi badge tự style, PageHero chỉ xếp hàng. */
  badges?: ReactNode;
  /** Dòng mô tả phụ dưới badges (thường là thông tin liên hệ/tổng quan ngắn). */
  meta?: ReactNode;
  /** Khu vực nút hành động bên phải (SpotlightTour, nút thêm/sửa, liên kết nhanh...). */
  actions?: ReactNode;
  /** Dải tile số liệu tóm tắt bên dưới hero — dùng StatTile chung, để trống nếu trang không cần. */
  stats?: (StatTileProps & { key: string })[];
  tone?: "primary" | "neutral";
  /** data-tour cho SpotlightTour, gắn vào khối avatar + tiêu đề (không phải toàn bộ hero). */
  identityDataTour?: string;
};

/**
 * Header "gradient hero" dùng chung cho mọi trang chi tiết (học viên, lớp, lead, báo cáo...).
 * Trước đây mỗi trang tự copy-paste lại markup này bằng hex cứng (bg-gradient-to-br
 * from-[#f97316] to-[#ea580c]...) — PageHero gộp về 1 component, dùng token
 * var(--gradient-primary) có sẵn trong app/globals.css, sửa 1 chỗ là đồng bộ toàn hệ thống.
 */
export default function PageHero({
  backHref,
  backLabel = "Quay lại",
  avatarLabel,
  avatarIcon,
  statusPill,
  title,
  badges,
  meta,
  actions,
  stats,
  tone = "primary",
  identityDataTour,
}: PageHeroProps) {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-hairline bg-gradient-to-b from-white to-canvas-pearl p-4 sm:p-6 md:p-8 shadow-sm">
      {backHref ? (
        <BackButton
          href={backHref}
          className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:w-4 sm:h-4">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>{backLabel}</span>
        </BackButton>
      ) : null}

      <div className={`flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start lg:justify-between ${backHref ? "mt-4 sm:mt-6" : ""}`}>
        <div className="flex items-start gap-3 sm:gap-4" data-tour={identityDataTour}>
          {avatarLabel || avatarIcon ? (
            <div
              className="flex h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl text-lg sm:text-xl md:text-2xl font-black text-white shadow-lg"
              style={{ background: tone === "primary" ? "var(--gradient-primary)" : "var(--gradient-blue, #64748b)" }}
            >
              {avatarIcon ?? avatarLabel}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {statusPill ? <div className="mb-1.5 sm:mb-2">{statusPill}</div> : null}
            <h1 className="mb-2 sm:mb-3 text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-ink">{title}</h1>
            {badges ? <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">{badges}</div> : null}
            {meta ? <p className="mt-2 sm:mt-3 truncate text-xs sm:text-sm text-ink-muted48">{meta}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div> : null}
      </div>

      {stats && stats.length > 0 ? (
        <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {stats.map(({ key, ...tile }) => (
            <StatTile key={key} tone="soft" {...tile} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
