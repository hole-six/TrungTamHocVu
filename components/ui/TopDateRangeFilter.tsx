"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import DateRangeCalendarPopover from "@/components/ui/DateRangeCalendarPopover";

// BỘ LỌC KHOẢNG NGÀY ĐẶT Ở ĐẦU TRANG.
//
// Bảng nào cũng có một cột ngày quan trọng nhất (ngày nhận data, ngày thu tiền, ngày
// xuất sách, ngày nhập học...). Trước đây muốn lọc theo ngày phải mò xuống hàng lọc nhỏ
// dưới tiêu đề cột; ở đây đưa hẳn lên đầu trang, cạnh các nút chính, kèm sẵn các mốc
// hay dùng (hôm nay / tuần này / tháng này / tháng trước) trong chính lịch đó.
//
// Chỉ đổi URL rồi để trang server tự lọc — không giữ state riêng, nên bấm back/refresh
// hay gửi link cho người khác đều ra đúng cùng một khoảng ngày.
export default function TopDateRangeFilter({
  label,
  fromParam,
  toParam,
  resetParams = [],
  fallbackFrom = "",
  fallbackTo = "",
  className = "",
}: {
  /** Nhãn ngắn cho biết đang lọc theo ngày gì, vd "Data nhận", "Ngày thu". */
  label: string;
  fromParam: string;
  toParam: string;
  /** Param cần xóa kèm khi đổi khoảng ngày (vd về trang 1, bỏ lọc chéo). */
  resetParams?: string[];
  /** Khoảng ngày trang đang áp dụng khi URL chưa có param (vd Sổ quỹ mặc định đầu tháng
   *  → hôm nay). Không có thì ô lọc ghi "Tất cả thời gian" trong khi danh sách thật ra
   *  đang bị giới hạn — nhìn là hiểu sai ngay. */
  fallbackFrom?: string;
  fallbackTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const valueFrom = searchParams.get(fromParam) ?? fallbackFrom;
  const valueTo = searchParams.get(toParam) ?? fallbackTo;

  function apply(from: string | null, to: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (from) next.set(fromParam, from);
    else next.delete(fromParam);
    if (to) next.set(toParam, to);
    else next.delete(toParam);
    for (const param of resetParams) next.delete(param);
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  // "Đang lọc" = người dùng TỰ chọn khoảng ngày, khác với khoảng mặc định của trang.
  const active = Boolean(searchParams.get(fromParam) || searchParams.get(toParam));

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl border bg-white p-1 ${
        active ? "border-[#1d4ed8]" : "border-[#e5eaf7]"
      } ${isPending ? "opacity-60" : ""} ${className}`}
    >
      <span className="px-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#94a3b8]">{label}</span>
      <DateRangeCalendarPopover
        valueFrom={valueFrom}
        valueTo={valueTo}
        onApply={apply}
        placeholder="Tất cả thời gian"
        // Nút xóa khoảng ngày đã nằm sẵn trong chính ô này (dấu ✕), không thêm nút thứ 2.
        triggerClassName={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${
          active ? "bg-[#1d4ed8] text-white [&_span]:text-white" : "text-[#475569] hover:bg-[#f1f5f9]"
        }`}
      />
    </div>
  );
}
