import Link from "next/link";

export type CreditStats = {
  total: number;
  available: number;
  consumed: number;
  absence: number;
  paidCatchup: number;
  weakStudent: number;
  withdrawalRemaining: number;
};

// Hàng chip lọc + đếm, cùng kiểu với /students (viên tròn, chip đang chọn tô đặc, chip
// không chọn nền trắng + số có màu theo mức độ khẩn). Thay cho 6 ô thống kê to chiếm
// nguyên 1 hàng ngang mà không bấm được — giờ mỗi con số vừa là số liệu vừa là bộ lọc.
export default function CreditFilterChips({
  stats,
  statusParam,
  typeParam,
}: {
  stats: CreditStats;
  statusParam: string;
  typeParam: string;
}) {
  // Chip trạng thái đổi `status` và CỐ TÌNH xóa `type`, chip loại đổi `type` và giữ
  // nguyên `status` — nếu giữ cả hai thì bấm 1 chip loại khi đang ở "Đã bổ trợ" sẽ ra
  // bảng rỗng dù chip đó hiện số > 0 (số của chip loại đếm buổi CÒN PHẢI XẾP).
  function href(patch: { status?: string | null; type?: string | null }) {
    const params = new URLSearchParams();
    const status = patch.status !== undefined ? patch.status : statusParam;
    const type = patch.type !== undefined ? patch.type : typeParam;
    if (status && status !== "AVAILABLE") params.set("status", status);
    if (type) params.set("type", type);
    const query = params.toString();
    return query ? `/session-credits?${query}` : "/session-credits";
  }

  const items: { label: string; value: number; href: string; active: boolean; activeClass: string; idleValueClass: string }[] = [
    {
      label: "Tất cả",
      value: stats.total,
      href: href({ status: "ALL", type: null }),
      active: statusParam === "ALL" && !typeParam,
      activeClass: "bg-primary text-white",
      idleValueClass: "text-primary",
    },
    {
      label: "Còn phải xếp",
      value: stats.available,
      href: href({ status: "AVAILABLE", type: null }),
      active: statusParam === "AVAILABLE" && !typeParam,
      activeClass: "bg-rose-500 text-white",
      idleValueClass: "text-rose-700",
    },
    {
      label: "Đã bổ trợ",
      value: stats.consumed,
      href: href({ status: "CONSUMED", type: null }),
      active: statusParam === "CONSUMED" && !typeParam,
      activeClass: "bg-emerald-500 text-white",
      idleValueClass: "text-emerald-700",
    },
    {
      label: "Vắng cần bài",
      value: stats.absence,
      href: href({ type: typeParam === "ABSENCE" ? null : "ABSENCE" }),
      active: typeParam === "ABSENCE",
      activeClass: "bg-amber-500 text-white",
      idleValueClass: "text-amber-700",
    },
    {
      label: "Đầu khóa",
      value: stats.paidCatchup,
      href: href({ type: typeParam === "PAID_CATCHUP" ? null : "PAID_CATCHUP" }),
      active: typeParam === "PAID_CATCHUP",
      activeClass: "bg-sky-500 text-white",
      idleValueClass: "text-sky-700",
    },
    {
      label: "HS yếu",
      value: stats.weakStudent,
      href: href({ type: typeParam === "WEAK_STUDENT" ? null : "WEAK_STUDENT" }),
      active: typeParam === "WEAK_STUDENT",
      activeClass: "bg-violet-500 text-white",
      idleValueClass: "text-violet-700",
    },
    {
      label: "Số dư lớp cũ",
      value: stats.withdrawalRemaining,
      href: href({ type: typeParam === "WITHDRAWAL_REMAINING" ? null : "WITHDRAWAL_REMAINING" }),
      active: typeParam === "WITHDRAWAL_REMAINING",
      activeClass: "bg-teal-500 text-white",
      idleValueClass: "text-teal-700",
    },
  ];

  return (
    <>
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
            item.active ? `${item.activeClass} border-transparent` : "border-[#dbe7ff] bg-white text-ink hover:border-primary/30"
          }`}
        >
          <span>{item.label}</span>
          <span className={item.active ? "text-white" : item.idleValueClass}>{item.value}</span>
        </Link>
      ))}
    </>
  );
}
