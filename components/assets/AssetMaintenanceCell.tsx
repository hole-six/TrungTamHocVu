"use client";

import { useState } from "react";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import { MAINTENANCE_STATUS_LABEL, type MaintenanceStatus } from "@/lib/server/asset-rules";
import { formatVnd } from "@/lib/export-utils";

type MaintenanceEntry = {
  id: string;
  txnDate: string;
  amount: number;
  notes: string | null;
};

const STATUS_BADGE_CLASS: Record<MaintenanceStatus, string> = {
  OVERDUE: "border-rose-200 bg-rose-50 text-rose-700",
  DUE_SOON: "border-amber-200 bg-amber-50 text-amber-700",
  OK: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NOT_SCHEDULED: "border-slate-200 bg-slate-50 text-slate-500",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function AssetMaintenanceCell({
  assetName,
  intervalMonths,
  status,
  nextDue,
  history,
}: {
  assetName: string;
  intervalMonths: number | null;
  status: MaintenanceStatus;
  nextDue: string | null;
  history: MaintenanceEntry[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block text-left">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE_CLASS[status]}`}>
          {MAINTENANCE_STATUS_LABEL[status]}
        </span>
        {nextDue ? (
          <p className="mt-1 text-xs text-ink-muted48">Hạn: {formatDate(nextDue)}</p>
        ) : intervalMonths ? null : (
          <p className="mt-1 text-xs text-ink-muted48">{history.length > 0 ? `${history.length} lần bảo dưỡng` : "Chưa bảo dưỡng lần nào"}</p>
        )}
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Lịch sử bảo dưỡng"
        description={`${assetName}${intervalMonths ? ` — chu kỳ ${intervalMonths} tháng/lần` : " — chưa đặt lịch định kỳ"}`}
        widthClassName="max-w-xl"
      >
        <div className="space-y-3">
          {nextDue ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${STATUS_BADGE_CLASS[status]}`}>
              <p className="font-semibold">{MAINTENANCE_STATUS_LABEL[status]}</p>
              <p className="mt-0.5 text-xs">Hạn bảo dưỡng kế tiếp: {formatDate(nextDue)}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Tài sản này chưa đặt chu kỳ bảo dưỡng định kỳ. Vào &quot;Sửa thông tin tài sản&quot; để đặt lịch.
            </div>
          )}

          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted48">Chưa có lần bảo dưỡng nào được ghi nhận.</p>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-hairline bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">{formatDate(entry.txnDate)}</p>
                    <p className="text-sm font-semibold text-amber-700">{formatVnd(entry.amount)}</p>
                  </div>
                  {entry.notes ? <p className="mt-1 text-xs text-ink-muted48">{entry.notes}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      </ResponsiveDrawer>
    </>
  );
}
