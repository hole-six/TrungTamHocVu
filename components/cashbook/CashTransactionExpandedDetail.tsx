"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CASH_TXN_STATUS_LABEL } from "@/lib/server/cash-rules";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { formatVnd } from "@/lib/export-utils";

type Category = { id: string; type: string; name: string };

export type CashTransactionForDetail = {
  id: string;
  type: "THU" | "CHI";
  amount: number;
  description: string | null;
  detail: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  status: string;
  categoryId: string | null;
  isDerived: boolean;
};

/**
 * Nội dung mở rộng của 1 dòng sổ quỹ khi bấm "Xem thêm" — chi tiết chứng từ, sửa
 * thông tin phiếu tại chỗ, hủy phiếu. Trước đây đây là 1 phần của CashTransactionRow
 * (viết tay riêng cho bảng desktop VÀ lặp lại 1 lần nữa cho card mobile) — giờ tách
 * riêng để dùng chung qua DataTableResponsive's `renderExpanded`, chỉ viết 1 lần.
 */
export default function CashTransactionExpandedDetail({
  transaction,
  categories,
  canManageCashbook,
}: {
  transaction: CashTransactionForDetail;
  categories: Category[];
  canManageCashbook: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: transaction.description ?? "",
    detail: transaction.detail ?? "",
    categoryId: transaction.categoryId ?? "",
    notes: transaction.notes ?? "",
  });

  const canEdit = canManageCashbook && !transaction.isDerived && transaction.status !== "VOIDED";

  async function voidTransaction() {
    setVoidError(null);
    const response = await fetch(`/api/cash-transactions/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "VOIDED" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setVoidError(data.error ?? "Không thể hủy phiếu.");
      return;
    }
    router.refresh();
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/cash-transactions/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không lưu được.");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-[#e7eef7] bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="form-group">
            <span className="label-sm">Diễn giải ngắn</span>
            <input className="input" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="form-group">
            <span className="label-sm">Danh mục</span>
            <select className="input" value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
              <option value="">Chưa chọn</option>
              {categories.filter((category) => category.type === transaction.type).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-group">
          <span className="label-sm">Diễn giải chi tiết</span>
          <input className="input" value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} />
        </label>

        <label className="form-group">
          <span className="label-sm">Ghi chú nội bộ</span>
          <textarea className="input resize-none" rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </label>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary text-xs">
            {loading ? "Đang lưu..." : "Lưu chỉnh sửa"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="btn-ghost text-xs">
            Hủy
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-[#e7eef7] bg-white p-4 text-sm">
        <h4 className="font-semibold text-ink">Thông tin chi tiết dòng tiền</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Diễn giải chi tiết</p>
            <p className="mt-1 text-ink-muted80">{transaction.detail || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Tệp đính kèm</p>
            <p className="mt-1 text-ink-muted80">
              {transaction.attachmentUrl ? (
                <a href={transaction.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Xem tệp
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Ghi chú nội bộ</p>
            <p className="mt-1 text-ink-muted80">{transaction.notes || "—"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e7eef7] bg-white p-4 text-sm">
        <h4 className="font-semibold text-ink">Tình trạng chứng từ</h4>
        <ul className="mt-3 space-y-2 text-ink-muted80">
          <li>Loại giao dịch: {transaction.type === "THU" ? "Tiền đi vào quỹ" : "Tiền đi ra khỏi quỹ"}</li>
          <li>Trạng thái: {CASH_TXN_STATUS_LABEL[transaction.status] ?? transaction.status}</li>
          <li>Nguồn phát sinh: {transaction.isDerived ? "Tự sinh từ nghiệp vụ khác" : "Nhập tay trực tiếp"}</li>
        </ul>

        {canEdit ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)} className="btn-ghost text-xs">
              Sửa thông tin phiếu
            </button>
            <ConfirmActionButton
              title="Xác nhận hủy phiếu?"
              description={`Hủy phiếu ${transaction.type === "THU" ? "thu" : "chi"} "${transaction.description ?? ""}" (${formatVnd(transaction.amount)}). Phiếu đã hủy sẽ không còn tính vào tổng thu/chi nhưng vẫn giữ lại để đối soát.`}
              confirmLabel="Hủy phiếu"
              tone="danger"
              className="btn-ghost text-xs text-red-600"
              onConfirm={voidTransaction}
            >
              Hủy phiếu
            </ConfirmActionButton>
          </div>
        ) : null}

        {voidError ? <p className="mt-2 text-xs text-red-600">{voidError}</p> : null}

        {transaction.isDerived ? (
          <p className="mt-4 text-xs text-ink-muted48">Phiếu này sinh tự động từ nghiệp vụ gốc nên không sửa/hủy trực tiếp tại sổ quỹ.</p>
        ) : null}
      </div>
    </div>
  );
}
