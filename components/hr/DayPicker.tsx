"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// Điều hướng ngày cho Sổ ngày: lùi/tiến 1 ngày, nhảy về hôm nay, hoặc chọn thẳng ngày.
export default function DayPicker({
  date,
  prevDate,
  nextDate,
  todayDate,
}: {
  date: string;
  prevDate: string;
  nextDate: string;
  todayDate: string;
}) {
  const router = useRouter();
  const base = "/timesheets/day?date=";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={base + prevDate} className="rounded-lg border border-[#dbe7ff] bg-white px-3 py-2 text-sm font-bold text-[#0f1729] hover:bg-[#f8faff]">
        ‹
      </Link>
      <input
        type="date"
        value={date}
        onChange={(event) => {
          if (event.target.value) router.push(base + event.target.value);
        }}
        className="input h-[38px] w-[160px] py-0"
      />
      <Link href={base + nextDate} className="rounded-lg border border-[#dbe7ff] bg-white px-3 py-2 text-sm font-bold text-[#0f1729] hover:bg-[#f8faff]">
        ›
      </Link>
      {date !== todayDate ? (
        <Link href={base + todayDate} className="rounded-lg border border-[#dbe7ff] bg-white px-3 py-2 text-sm font-bold text-[#2563eb] hover:bg-[#f8faff]">
          Hôm nay
        </Link>
      ) : null}
    </div>
  );
}
