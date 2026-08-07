"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import DatePicker from "@/components/ui/DatePicker";
import { formatVnd } from "@/lib/export-utils";

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng form này?",
    items: [
      "Dùng khi tài sản phát sinh chi phí sửa chữa, thay linh kiện, bảo trì định kỳ hoặc vệ sinh có tốn tiền.",
      "Mục tiêu là ghi nhận đúng số tiền đã chi, không phải đổi giá gốc ban đầu của tài sản.",
      "Sau khi lưu, tiền bảo dưỡng sẽ được tách riêng để bạn nhìn ra tổng giá trị gốc và tổng chi phí đã đổ vào tài sản.",
    ],
    tone: "info" as const,
  },
  {
    title: "Hệ thống sẽ tự làm gì?",
    items: [
      "Tự tạo một giao dịch bảo dưỡng cho tài sản này.",
      "Tự cộng số tiền vào mục chi phí bảo dưỡng của tài sản.",
      "Tự cộng tiền đó vào tổng giá trị hiện tại của tài sản.",
      "Tự sinh một phiếu chi tương ứng ở sổ quỹ để kế toán/quản lý đối chiếu được.",
    ],
    tone: "success" as const,
  },
  {
    title: "Những điều cần tránh",
    items: [
      "Không nhập tiền dự kiến, chỉ nhập khoản đã chi thực tế.",
      "Không dùng form này để mua thêm tài sản mới. Mua mới phải thêm tài sản hoặc nhập mới số lượng đúng luồng.",
      "Nếu chưa chi tiền mà mới lên kế hoạch sửa, chưa nên ghi nhận ở đây để tránh sai số quỹ.",
    ],
    tone: "warning" as const,
  },
];

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
  const [txnDate, setTxnDate] = useState(todayYmd);
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
        txnDate,
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
    setTxnDate(todayYmd());
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

      <ResponsiveDrawer 
        open={open}
        onClose={() => setOpen(false)}
        title="Ghi nhận bảo dưỡng"
        description={`Nhập chi phí bảo dưỡng thực tế cho tài sản ${assetName}. Hệ thống sẽ tự nối khoản này sang giá trị tài sản và sổ quỹ.`}
        widthClassName="max-w-xl"
        guide={<FormGuide title="Hướng dẫn ghi nhận bảo dưỡng" summary="Đây là luồng dành cho người vận hành khi tài sản vừa phát sinh chi phí sửa chữa hoặc bảo trì. Chỉ cần nhập đúng số tiền thật đã chi là hệ thống sẽ làm phần còn lại." sections={GUIDE_SECTIONS} position="inline" />}
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Tài sản</p>
            <p className="mt-2 text-lg font-semibold text-ink">{assetName}</p>
          </div>

          <label className="form-group">
            <span className="label">Số tiền bảo dưỡng</span>
            <input required type="number" min={1} className="input" placeholder="Ví dụ: 250000" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <p className="form-hint">{amount ? `Sẽ ghi nhận ${formatVnd(Number(amount) || 0)} vào chi phí bảo dưỡng.` : "Nhập đúng số tiền thực tế đã chi."}</p>
          </label>

          <label className="form-group">
            <span className="label">Ngày bảo dưỡng thực tế</span>
            <DatePicker value={txnDate} onChange={setTxnDate} />
            <p className="form-hint">Nếu nhập trễ so với ngày sửa thật, hãy chọn đúng ngày đã sửa để lịch bảo dưỡng tính đúng hạn kế tiếp.</p>
          </label>

          <label className="form-group">
            <span className="label">Ghi chú</span>
            <textarea rows={4} className="input resize-none" placeholder="Ví dụ: thay bánh xe, sửa chân bàn, vệ sinh máy lạnh..." value={notes} onChange={(event) => setNotes(event.target.value)} />
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
      </ResponsiveDrawer>
    </>
  );
}
