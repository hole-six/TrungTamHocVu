"use client";

import { useTransition, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromYmd(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

type Category = { id: string; name: string; type: string };

export default function CashbookFilters({
  initialFromDate,
  initialToDate,
  initialType,
  initialSearch,
  initialCategoryId,
  categories,
}: {
  initialFromDate: string;
  initialToDate: string;
  initialType: string;
  initialSearch: string;
  initialCategoryId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialSearch);

  const range: DateRange = { from: fromYmd(initialFromDate), to: fromYmd(initialToDate) };

  function pushFilters(next: { fromDate?: string; toDate?: string; type?: string; search?: string; categoryId?: string }) {
    const params = new URLSearchParams();
    const resolvedFromDate = next.fromDate ?? initialFromDate;
    const resolvedToDate = next.toDate ?? initialToDate;
    const resolvedType = next.type ?? initialType;
    const resolvedSearch = next.search !== undefined ? next.search : initialSearch;
    const resolvedCategoryId = next.categoryId !== undefined ? next.categoryId : initialCategoryId;

    if (resolvedFromDate) params.set("fromDate", resolvedFromDate);
    if (resolvedToDate) params.set("toDate", resolvedToDate);
    if (resolvedType) params.set("type", resolvedType);
    if (resolvedSearch) params.set("search", resolvedSearch);
    if (resolvedCategoryId) params.set("categoryId", resolvedCategoryId);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    pushFilters({ search: searchValue });
  }

  return (
    <div className="rounded-[24px] border border-hairline bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted48" strokeWidth={2.5} />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Tìm theo nội dung..."
            className="input w-full pl-9"
          />
        </form>

        {/* Date Range */}
        <div className="min-w-[220px]">
          <DateRangePicker
            value={range}
            onChange={(next) => {
              pushFilters({
                fromDate: next.from ? toYmd(next.from) : "",
                toDate: next.to ? toYmd(next.to) : "",
              });
            }}
            label="Chọn khoảng ngày"
          />
        </div>

        {/* Type Filter */}
        <select
          value={initialType}
          onChange={(event) => pushFilters({ type: event.target.value })}
          className="input w-auto min-w-[160px]"
        >
          <option value="">Tất cả giao dịch</option>
          <option value="THU">Chỉ thu vào</option>
          <option value="CHI">Chỉ chi ra</option>
        </select>

        {/* Category Filter */}
        <select
          value={initialCategoryId}
          onChange={(event) => pushFilters({ categoryId: event.target.value })}
          className="input w-auto min-w-[160px]"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        {isPending && <span className="text-xs font-medium text-ink-muted48">Đang lọc...</span>}
      </div>
    </div>
  );
}
