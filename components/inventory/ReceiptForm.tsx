"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";
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

export default function ReceiptForm({ bookId, defaultUnitPrice }: { bookId: string; defaultUnitPrice: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState(String(defaultUnitPrice));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/books/${bookId}/stock-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "RECEIPT", quantity: Number(quantity), unitPrice: Number(unitPrice), notes }),
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
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost">
        Nhập kho
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Nhập kho"
        description="Ghi nhận một đợt nhập mới và lưu đúng giá nhập."
        guide={<FormGuide title="Hướng dẫn nhập kho sách" summary="Đây là form cộng tồn kho khi có đợt sách mới về. Điều quan trọng nhất là đúng số lượng và đúng giá nhập của chính đợt đó." sections={RECEIPT_GUIDE_SECTIONS} position="inline" />}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[120px_180px_minmax(0,1fr)]">
            <input type="number" required placeholder="Số lượng" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <label className="form-group">
              <span className="label-sm">Giá nhập / đơn vị</span>
              <input type="number" required min="0" placeholder="Giá nhập" className="input" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
              <p className="form-hint">{unitPrice ? formatVnd(Number(unitPrice) || 0) : ""}</p>
            </label>
            <input placeholder="Ghi chú" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p className="text-xs text-ink-muted48">Giá nhập có thể khác giá bán và có thể khác nhau theo từng đợt.</p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Đang lưu..." : "Nhập kho"}
          </button>
        </form>
      </SlideOver>
    </>
  );
}
