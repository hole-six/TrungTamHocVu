"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ExceptionItem = {
  studentId: string;
  classId: string;
  studentName: string;
  studentCode: string;
  className: string;
  billingModel: string;
  reason: string;
};

type ExceptionPayload = {
  periodId: string;
  periodName: string;
  exceptionCount: number;
  exceptions: ExceptionItem[];
};

export default function BillingPeriodExceptionQueue({ periodId }: { periodId: string }) {
  const [data, setData] = useState<ExceptionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/billing-periods/${periodId}/generation-exceptions`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Không tải được exception queue.");
        }
        return response.json();
      })
      .then((payload: ExceptionPayload) => setData(payload))
      .catch((fetchError: Error) => {
        if (fetchError.name !== "AbortError") setError(fetchError.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [periodId]);

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Exception queue</p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">Ca cần kiểm tra thủ công</h2>
          <p className="mt-1 text-sm text-ink-muted48">Những ca này được hệ thống chặn lại để tránh sinh sai học phí.</p>
        </div>
        <button type="button" onClick={() => setExpanded((current) => !current)} className="btn-ghost">
          {expanded ? "Thu gọn" : "Mở danh sách"}
        </button>
      </div>

      {loading ? <p className="mt-4 text-sm text-ink-muted48">Đang tải exception queue...</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] px-4 py-3">
              <p className="text-xs text-ink-muted48">Ngoại lệ hiện tại</p>
              <p className="mt-1 text-lg font-semibold text-red-600">{data.exceptionCount}</p>
            </div>
            <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] px-4 py-3">
              <p className="text-xs text-ink-muted48">Kỳ đang xem</p>
              <p className="mt-1 text-lg font-semibold text-ink">{data.periodName}</p>
            </div>
            <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] px-4 py-3">
              <p className="text-xs text-ink-muted48">Nguyên tắc</p>
              <p className="mt-1 text-sm font-medium text-ink">Ca nguy hiểm thì chặn, không tự động đoán.</p>
            </div>
          </div>

          {expanded ? (
            <div className="mt-4 space-y-3">
              {data.exceptions.map((item, index) => (
                <div key={`${item.studentId}-${item.classId}-${index}`} className="rounded-2xl border border-[#f6d67b] bg-[#fff8e8] px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold text-ink">
                        <Link href={`/students/${item.studentId}?tab=hocphi`} className="text-primary hover:underline">
                          {item.studentName}
                        </Link>{" "}
                        <span className="text-ink-muted48">({item.studentCode})</span>
                      </p>
                      <p className="mt-1 text-sm text-ink-muted80">
                        {item.className} · Mode {item.billingModel}
                      </p>
                      <p className="mt-2 text-sm text-[#8a5a00]">{item.reason}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/students/${item.studentId}?tab=hocphi`} className="btn-secondary">
                        Mở học phí HV
                      </Link>
                      <Link href={`/students/${item.studentId}`} className="btn-ghost">
                        Hồ sơ học viên
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

              {data.exceptions.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-[#e8f8f1] px-4 py-4 text-sm text-[#0f7a4f]">
                  Hiện tại không có ngoại lệ nguy hiểm trong kỳ này.
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
