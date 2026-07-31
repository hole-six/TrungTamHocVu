"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, PLACEMENT_TEST_STATUSES, PLACEMENT_TEST_STATUS_LABEL } from "@/lib/server/lead-rules";

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromYmd(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function LeadTestFilters({
  q,
  meetFrom,
  meetTo,
  testStatus,
  leadStatus,
  missingTestCount,
}: {
  q: string;
  meetFrom: string;
  meetTo: string;
  testStatus: string;
  leadStatus: string;
  missingTestCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [qDraft, setQDraft] = useState(q);

  const range: DateRange = { from: fromYmd(meetFrom), to: fromYmd(meetTo) };
  const hasFilters = Boolean(q || meetFrom || meetTo || testStatus || leadStatus);

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: qDraft || null });
  }

  return (
    <div className="card space-y-4">
      <form onSubmit={submitSearch} className="flex items-center gap-2">
        <input
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          placeholder="Tìm theo tên, mã, SĐT, tên phụ huynh..."
          className="input flex-1"
        />
        <button type="submit" className="btn-primary shrink-0">
          Tìm
        </button>
      </form>

      <div className="flex flex-wrap items-end gap-3 border-t border-hairline pt-4">
        <div>
          <p className="mb-1 text-xs font-medium text-ink-muted48">Lọc theo ngày gặp</p>
          <DateRangePicker
            value={range}
            onChange={(r) => updateParams({ meetFrom: r.from ? toYmd(r.from) : null, meetTo: r.to ? toYmd(r.to) : null })}
            label="Tất cả thời gian"
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-ink-muted48">Tình trạng test</p>
          <select value={testStatus} onChange={(e) => updateParams({ testStatus: e.target.value || null })} className="input">
            <option value="">Tất cả</option>
            <option value="NONE">Chưa hẹn test ({missingTestCount})</option>
            {PLACEMENT_TEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PLACEMENT_TEST_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-ink-muted48">Trạng thái lead</p>
          <select value={leadStatus} onChange={(e) => updateParams({ leadStatus: e.target.value || null })} className="input">
            <option value="">Tất cả</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQDraft("");
              updateParams({ q: null, meetFrom: null, meetTo: null, testStatus: null, leadStatus: null });
            }}
            className="text-xs text-ink-muted48 underline hover:text-primary"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>
    </div>
  );
}
