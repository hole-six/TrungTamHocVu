"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CASH_TXN_STATUS_LABEL } from "@/lib/server/cash-rules";

type Category = { id: string; type: string; name: string };

type Transaction = {
  id: string;
  txnDate: string;
  type: "THU" | "CHI";
  amount: number;
  description: string | null;
  detail: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  handledByName: string | null;
  isDerived: boolean;
};

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function CashTransactionRow({
  transaction,
  categories,
  canManageCashbook,
}: {
  transaction: Transaction;
  categories: Category[];
  canManageCashbook: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: transaction.description ?? "",
    detail: transaction.detail ?? "",
    categoryId: transaction.categoryId ?? "",
    notes: transaction.notes ?? "",
  });

  const canEdit = canManageCashbook && !transaction.isDerived && transaction.status !== "VOIDED";

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

  return (
    <>
      <tr className={transaction.status === "VOIDED" ? "opacity-50" : ""}>
        <td>{formatDate(transaction.txnDate)}</td>
        <td>
          <span className={transaction.type === "THU" ? "badge-green" : "badge-red"}>{transaction.type === "THU" ? "Thu" : "Chi"}</span>
        </td>
        <td className="text-ink-muted80">{transaction.categoryName ?? "Chưa phân loại"}</td>
        <td>
          <div className="space-y-1">
            <p className="font-medium text-ink">{transaction.description ?? "Chưa có diễn giải"}</p>
            <p className="text-xs text-ink-muted48">
              {transaction.handledByName ? `Người xử lý: ${transaction.handledByName}` : "Chưa rõ người xử lý"}
            </p>
          </div>
        </td>
        <td className="text-right font-semibold text-emerald-600">{transaction.type === "THU" ? formatVnd(transaction.amount) : "—"}</td>
        <td className="text-right font-semibold text-rose-600">{transaction.type === "CHI" ? formatVnd(transaction.amount) : "—"}</td>
        <td><span className="badge-gray">{CASH_TXN_STATUS_LABEL[transaction.status] ?? transaction.status}</span></td>
        <td>
          <button type="button" onClick={() => setExpanded((current) => !current)} className="text-xs font-semibold text-primary">
            {expanded ? "Thu gọn" : "Xem thêm"}
          </button>
        </td>
      </tr>

      {expanded ? (
        <tr>
          <td colSpan={8} className="bg-[#f9fbff] px-5 py-4">
            {!editing ? (
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
                    <button type="button" onClick={() => setEditing(true)} className="btn-ghost mt-4 text-xs">
                      Sửa thông tin phiếu
                    </button>
                  ) : null}

                  {transaction.isDerived ? (
                    <p className="mt-4 text-xs text-ink-muted48">Phiếu này sinh tự động từ nghiệp vụ gốc nên không sửa trực tiếp tại sổ quỹ.</p>
                  ) : null}
                </div>
              </div>
            ) : (
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
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
