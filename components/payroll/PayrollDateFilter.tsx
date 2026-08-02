"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromYmd(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function PayrollDateFilter({
  initialFromDate,
  initialToDate,
}: {
  initialFromDate: string;
  initialToDate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const range: DateRange = { from: fromYmd(initialFromDate), to: fromYmd(initialToDate) };

  function pushFilters(next: DateRange) {
    const params = new URLSearchParams();
    if (next.from) params.set("fromDate", toYmd(next.from));
    if (next.to) params.set("toDate", toYmd(next.to));

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-hairline bg-white px-4 py-3 shadow-sm">
      <div className="min-w-[220px]">
        <DateRangePicker value={range} onChange={pushFilters} label="Chọn khoảng ngày" />
      </div>

      {isPending ? <span className="text-xs font-medium text-ink-muted48">Đang lọc...</span> : null}
    </div>
  );
}
