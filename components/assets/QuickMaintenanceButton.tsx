"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

export default function QuickMaintenanceButton({
  assetId,
  assetName,
  compact = false,
}: {
  assetId: string;
  assetName: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/assets/${assetId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "MAINTENANCE",
        amount,
        notes,
      }),
    });

    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể lưu bảo dưỡng.");
      return;
    }

    setAmount("");
    setNotes("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex min-w-[96px] items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
            : "inline-flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
        }
      >
        Bảo dưỡng
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Ghi nhận bảo dưỡng"
        description={`Nhập chi phí bảo dưỡng cho tài sản ${assetName}. Khoản này sẽ tự cộng vào tiền bảo dưỡng, tổng giá trị tài sản và tự sinh phiếu chi ở sổ quỹ.`}
        widthClassName="max-w-xl"
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Tài sản</p>
            <p className="mt-2 text-lg font-semibold text-ink">{assetName}</p>
          </div>

          <label className="form-group">
            <span className="label">Số tiền bảo dưỡng</span>
            <input
              required
              type="number"
              min={1}
              step={1000}
              className="input"
              placeholder="Ví dụ: 250000"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <p className="form-hint">{amount ? `Sẽ ghi nhận ${formatVnd(Number(amount) || 0)} vào chi phí bảo dưỡng.` : "Nhập đúng số tiền thực tế đã chi."}</p>
          </label>

          <label className="form-group">
            <span className="label">Ghi chú</span>
            <textarea
              rows={4}
              className="input resize-none"
              placeholder="Ví dụ: thay bánh xe, sửa chân bàn, vệ sinh máy lạnh..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex flex-wrap gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Xác nhận bảo dưỡng"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
