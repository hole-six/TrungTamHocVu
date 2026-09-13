"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import { formatVnd } from "@/lib/export-utils";

const RECEIPT_GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng form nhập kho?",
    items: [
      "Dùng khi kho vừa nhận thêm sách/giáo trình thực tế và cần cộng tồn.",
      "Mỗi lần nhập kho nên phản ánh đúng một đợt nhập thật để sau này đối chiếu giá nhập rõ ràng.",
      "Giá nhập theo đợt có thể khác nhau, nên không nên nghĩ chỉ có một giá cố định mãi mãi.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách nhập đúng",
    items: [
      "Nhập đúng số lượng vừa nhận về.",
      "Nhập đúng giá nhập / đơn vị của đợt này, vì hệ thống dùng nó để lưu lịch sử vốn.",
      "Ghi chú nên nêu ngắn gọn nguồn nhập hoặc bối cảnh đợt hàng nếu cần đối soát sau.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ gặp",
    items: [
      "Nhập nhầm số lượng làm tồn kho lệch.",
      "Nhập nhầm giá nhập thành giá bán.",
      "Gộp nhiều đợt nhập khác giá vào một lần ghi nhận duy nhất khiến lịch sử vốn khó đọc.",
    ],
    tone: "warning" as const,
  },
];

export default function ReceiptForm({
  bookId,
  bookName,
  bookCode,
  onHand,
  defaultUnitPrice,
  onDone,
  triggerClassName = "btn-ghost",
}: {
  bookId: string;
  bookName?: string;
  bookCode?: string | null;
  onHand?: number;
  defaultUnitPrice: number;
  onDone?: () => void;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState(String(defaultUnitPrice));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const price = Math.max(0, Number(unitPrice) || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (qty <= 0) {
      setError("Nhập số lượng lớn hơn 0.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/books/${bookId}/stock-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "RECEIPT", quantity: qty, unitPrice: price, notes }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể nhập kho.");
      return;
    }
    setQuantity("");
    setNotes("");
    setOpen(false);
    onDone?.();
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        Nhập kho
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Nhập kho"
        description="Ghi nhận một đợt sách mới về, đúng số lượng và giá nhập của đợt này."
        guide={<FormGuide title="Hướng dẫn nhập kho sách" summary="Đây là form cộng tồn kho khi có đợt sách mới về. Điều quan trọng nhất là đúng số lượng và đúng giá nhập của chính đợt đó." sections={RECEIPT_GUIDE_SECTIONS} position="inline" />}
      >
        <form onSubmit={submit} className="space-y-5">
          {/* Đang nhập cho SÁCH NÀO — trước đây form không ghi tên sách, mở nhầm drawer là nhập nhầm đầu sách. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Sách nhập kho</p>
              <p className="mt-0.5 truncate text-base font-bold text-[#0f1729]">{bookName ?? "—"}</p>
              {bookCode && bookCode.trim() !== "0" ? <p className="font-mono text-xs text-[#64748b]">{bookCode}</p> : null}
            </div>
            {onHand != null ? (
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Tồn kho</p>
                <p className="text-base font-bold tabular-nums text-[#0f1729]">
                  {onHand}
                  {qty > 0 ? <span className="text-[#64748b]"> → {onHand + qty}</span> : null}
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-group">
              <span className="label-sm">Số lượng nhập</span>
              <input type="number" required min="1" placeholder="VD: 20" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
            </label>
            <label className="form-group">
              <span className="label-sm">Giá nhập / cuốn</span>
              <input type="number" required min="0" className="input" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
              <span className="form-hint">{formatVnd(price)} · có thể khác giá bán và khác nhau theo từng đợt</span>
            </label>
            <label className="form-group sm:col-span-2">
              <span className="label-sm">Ghi chú</span>
              <input placeholder="VD: nhập từ NXB, đợt tháng 9..." className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#e2e8f0] px-4 py-3">
            <span className="text-sm text-[#475569]">Thành tiền đợt nhập</span>
            <span className="text-lg font-black tabular-nums text-[#0f1729]">{formatVnd(qty * price)}</span>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Đang lưu..." : qty > 0 ? `Nhập ${qty} cuốn vào kho` : "Nhập kho"}
          </button>
        </form>
      </ResponsiveDrawer>
    </>
  );
}
