"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import DatePicker from "@/components/ui/DatePicker";

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(value: string) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date();
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const next = new Date(base);
  next.setDate(base.getDate() + diff);
  return toYmd(next);
}

type CalendarFiltersProps = {
  initialWeek: string;
  initialQuery: string;
  initialStatus: string;
  initialTimePreset: string;
};

export default function CalendarFilters({
  initialWeek,
  initialQuery,
  initialStatus,
  initialTimePreset,
}: CalendarFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [week, setWeek] = useState(initialWeek);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [timePreset, setTimePreset] = useState(initialTimePreset || "all");

  const quickPresets = useMemo(
    () => [
      { id: "all", label: "Toàn ngày" },
      { id: "morning", label: "Ca sáng" },
      { id: "afternoon", label: "Ca chiều" },
      { id: "evening", label: "Ca tối" },
    ],
    [],
  );

  function pushFilters(next: { week?: string; query?: string; status?: string; timePreset?: string }) {
    const params = new URLSearchParams();
    const resolvedWeek = next.week ?? week;
    const resolvedQuery = next.query ?? query;
    const resolvedStatus = next.status ?? status;
    const resolvedTimePreset = next.timePreset ?? timePreset;

    if (resolvedWeek) params.set("week", startOfWeek(resolvedWeek));
    if (resolvedQuery.trim()) params.set("q", resolvedQuery.trim());
    if (resolvedStatus) params.set("status", resolvedStatus);
    if (resolvedTimePreset && resolvedTimePreset !== "all") params.set("timePreset", resolvedTimePreset);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="rounded-[30px] border border-[#e4ebf8] bg-white p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Bộ lọc lịch</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">Lọc đúng tuần, đúng ca, đúng buổi cần xử lý</h2>
          <p className="mt-1 text-sm text-ink-muted48">
            Chọn một ngày bất kỳ trong tuần, tìm theo lớp hoặc người dạy, rồi bóc riêng ca sáng, chiều hoặc tối.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quickPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setTimePreset(preset.id);
                pushFilters({ timePreset: preset.id });
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                timePreset === preset.id ? "bg-primary text-white shadow-sm" : "bg-[#f4f8ff] text-ink-muted80 hover:bg-[#e9f1ff]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_220px_220px]">
        <label className="space-y-2">
          <span className="label-sm">Tuần cần xem</span>
          <DatePicker
            value={week}
            onChange={(value) => {
              setWeek(value);
              pushFilters({ week: value });
            }}
            placeholder="Chọn ngày trong tuần"
          />
        </label>

        <label className="space-y-2">
          <span className="label-sm">Tìm lớp, mã lớp, phòng, giáo viên</span>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") pushFilters({ query });
            }}
            placeholder="Ví dụ: Cambridge A1, P.102, Minh Anh..."
          />
        </label>

        <label className="space-y-2">
          <span className="label-sm">Trạng thái buổi</span>
          <select
            className="input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              pushFilters({ status: event.target.value });
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PLANNED">Dự kiến</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="COMPLETED">Đã hoàn thành</option>
            <option value="RESCHEDULED">Đã dời lịch</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button type="button" onClick={() => pushFilters({ query })} className="btn-primary flex-1">
            {isPending ? "Đang lọc..." : "Lọc lịch"}
          </button>
          <button
            type="button"
            onClick={() => {
              const today = toYmd(new Date());
              setWeek(today);
              setQuery("");
              setStatus("");
              setTimePreset("all");
              startTransition(() => {
                router.push(`${pathname}?week=${startOfWeek(today)}`);
              });
            }}
            className="btn-ghost"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
