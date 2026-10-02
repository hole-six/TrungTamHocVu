"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SEARCH_DEBOUNCE_MS = 400;

type CalendarFiltersProps = {
  initialQuery: string;
  initialTimePreset: string;
  initialView: string;
};

const TIME_PRESET_LABEL: Record<string, string> = {
  morning: "Sáng",
  afternoon: "Chiều",
  evening: "Tối",
};

export default function CalendarFilters({
  initialQuery,
  initialTimePreset,
  initialView,
}: CalendarFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [timePreset, setTimePreset] = useState(initialTimePreset || "all");
  const [view, setView] = useState(initialView || "list");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const quickPresets = useMemo(
    () => [
      { id: "all", label: "Cả ngày" },
      { id: "morning", label: "Sáng" },
      { id: "afternoon", label: "Chiều" },
      { id: "evening", label: "Tối" },
    ],
    [],
  );

  function pushFilters(next: { query?: string; timePreset?: string; view?: string }) {
    // GIỮ NGUYÊN các tham số khác đang có trên URL (mode/week/month của thanh thời gian
    // dùng chung). Trước đây hàm này dựng lại URL từ số 0 nên mỗi lần gõ tìm kiếm là
    // thổi bay mốc thời gian đang xem.
    const params = new URLSearchParams(searchParams.toString());
    const resolvedQuery = next.query ?? query;
    const resolvedTimePreset = next.timePreset ?? timePreset;
    const resolvedView = next.view ?? view;

    if (resolvedQuery.trim()) params.set("q", resolvedQuery.trim());
    else params.delete("q");
    if (resolvedTimePreset && resolvedTimePreset !== "all") params.set("timePreset", resolvedTimePreset);
    else params.delete("timePreset");
    if (resolvedView && resolvedView !== "list") params.set("view", resolvedView);
    else params.delete("view");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushFilters({ query: value }), SEARCH_DEBOUNCE_MS);
  }

  function clearQuery() {
    setQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushFilters({ query: "" });
  }

  function clearTimePreset() {
    setTimePreset("all");
    pushFilters({ timePreset: "all" });
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasQuery = query.trim().length > 0;
  const hasTimePreset = timePreset !== "all";

  return (
    <div className="rounded-[18px] border border-[#dce7f3] bg-white p-3 shadow-[0_8px_24px_rgba(39,72,120,0.06)]">
      <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto_auto] xl:items-center">
        <div className="flex min-h-[44px] items-center gap-3 rounded-[12px] border border-[#dce7f3] bg-white px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[#7b8da5]" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="h-[42px] min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-[#18304f] outline-none placeholder:text-[#98a7bb]"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Tìm lớp, phòng, giáo viên..."
          />
          {isPending ? <span className="shrink-0 text-xs font-medium text-ink-muted48">Đang lọc...</span> : null}
          {hasQuery ? (
            <button
              type="button"
              onClick={clearQuery}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label="Xóa từ khóa tìm kiếm"
              title="Xóa từ khóa"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <div className="inline-flex rounded-[11px] border border-[#dce7f3] bg-white p-1">
            <button
              type="button"
              onClick={() => {
                setView("list");
                pushFilters({ view: "list" });
              }}
              className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${
                view === "list" ? "bg-[#eaf4ff] text-[#1389e8]" : "text-[#5d7290] hover:text-primary"
              }`}
              title="Xem dạng danh sách, mỗi buổi 1 dòng"
            >
              Danh sách
            </button>
            <button
              type="button"
              onClick={() => {
                setView("grid");
                pushFilters({ view: "grid" });
              }}
              className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${
                view === "grid" ? "bg-[#eaf4ff] text-[#1389e8]" : "text-[#5d7290] hover:text-primary"
              }`}
              title="Xem dạng lưới theo tuần"
            >
              Lưới
            </button>
          </div>
          {quickPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setTimePreset(preset.id);
                pushFilters({ timePreset: preset.id });
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                timePreset === preset.id
                  ? "border border-transparent bg-[linear-gradient(135deg,#1389e8,#087bd7)] text-white shadow-[0_7px_16px_rgba(19,137,232,0.22)]"
                  : "border border-[#dce7f3] bg-white text-[#18304f] hover:border-primary/30"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {hasTimePreset ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#eef3f9] pt-3">
          <button
            type="button"
            onClick={clearTimePreset}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"
          >
            Ca {TIME_PRESET_LABEL[timePreset]}
            <span aria-hidden>×</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
