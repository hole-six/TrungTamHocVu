"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Cụm Nhân sự là MỘT việc, không phải 3 việc rời: hồ sơ nhân viên → chấm công của họ →
// lương trả cho công đó. Trước đây tách thành 3 mục menu riêng, người dùng phải tự nhớ
// thứ tự và tự đi vòng giữa các trang. Gom về một thanh tab dùng chung, giữ nguyên
// route riêng của từng tab (mỗi trang vẫn tự lấy dữ liệu ở server) — không phải gộp
// code vào một file khổng lồ, nhưng nhìn và dùng thì là một khung duy nhất.
const HR_TABS = [
  { href: "/employees", label: "Hồ sơ nhân sự", hint: "Thông tin, đơn giá, hợp đồng" },
  { href: "/timesheets", label: "Chấm công", hint: "Ngày công theo tháng" },
  { href: "/timesheets/day", label: "Sổ ngày", hint: "Toàn cảnh 1 ngày" },
  { href: "/payroll", label: "Lương", hint: "Tính lương, phiếu lương" },
];

export default function HrTabs({ allowed }: { allowed?: string[] }) {
  const pathname = usePathname();
  // Mỗi vai trò chỉ được vào một phần cụm này (vd Giáo vụ chỉ có Chấm công, Giáo viên
  // chỉ xem được Lương của mình) — chỉ hiện tab họ thực sự vào được, tránh bấm vào rồi
  // ăn màn báo không có quyền.
  const tabs = allowed
    ? HR_TABS.filter((tab) => allowed.includes(tab.href) || (tab.href === "/timesheets/day" && allowed.includes("/timesheets")))
    : HR_TABS;
  if (tabs.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[#dbe7ff] bg-[#f8faff] p-1.5">
      {tabs.map((tab) => {
        // /timesheets/day là tab riêng — không để tab "Chấm công" cũng sáng theo tiền tố.
        const isActive = tab.href === "/timesheets"
          ? pathname === "/timesheets"
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 rounded-xl px-4 py-2.5 text-center transition ${
              isActive ? "bg-primary text-white shadow-sm" : "text-[#0f1729] hover:bg-white"
            }`}
          >
            <span className="block text-sm font-bold">{tab.label}</span>
            <span className={`block text-[11px] ${isActive ? "text-white/80" : "text-[#64748b]"}`}>{tab.hint}</span>
          </Link>
        );
      })}
    </div>
  );
}
