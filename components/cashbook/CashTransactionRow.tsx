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

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/cash-transactions/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không lưu được.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <>
      <tr className={transaction.status === "VOIDED" ? "opacity-40" : ""}>
        <td>{formatDate(transaction.txnDate)}</td>
        <td>
          <span className={transaction.type === "THU" ? "badge-blue" : "badge-gray"}>{transaction.type === "THU" ? "Thu" : "Chi"}</span>
        </td>
        <td className="text-ink-muted80">{transaction.categoryName ?? "—"}</td>
        <td className="text-ink-muted80">{transaction.description ?? "—"}</td>
        <td className="font-medium">{formatVnd(transaction.amount)}</td>
        <td><span className="badge-gray">{CASH_TXN_STATUS_LABEL[transaction.status] ?? transaction.status}</span></td>
        <td>
          <button onClick={() => setExpanded((v) => !v)} className="text-xs text-primary">
            {expanded ? "Thu gọn" : "Chi tiết"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-canvas-parchment/30 px-4 py-3">
            {!editing ? (
              <div className="space-y-1 text-xs text-ink-muted80">
                <p><span className="text-ink-muted48">Diễn giải chi tiết: </span>{transaction.detail ?? "—"}</p>
                <p><span className="text-ink-muted48">Người thu/chi: </span>{transaction.handledByName ?? "—"}</p>
                <p><span className="text-ink-muted48">Tệp đính kèm: </span>{transaction.attachmentUrl ? <a href={transaction.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary">Xem tệp</a> : "—"}</p>
                <p><span className="text-ink-muted48">Ghi chú: </span>{transaction.notes ?? "—"}</p>
                {canEdit && (
                  <button onClick={() => setEditing(true)} className="btn-ghost mt-2 text-xs">
                    Sửa
                  </button>
                )}
                {transaction.isDerived && (
                  <p className="text-ink-muted48">Phiếu này sinh tự động từ nghiệp vụ khác — sửa ở nghiệp vụ gốc.</p>
                )}
              </div>
            ) : (
              <form onSubmit={save} className="space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-ink-muted48">Diễn giải</span>
                    <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-ink-muted48">Danh mục</span>
                    <select className="input" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
                      <option value="">— Không chọn —</option>
                      {categories.filter((c) => c.type === transaction.type).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="space-y-1 block">
                  <span className="text-xs font-medium text-ink-muted48">Diễn giải chi tiết</span>
                  <input className="input" value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} />
                </label>
                <label className="space-y-1 block">
                  <span className="text-xs font-medium text-ink-muted48">Ghi chú</span>
                  <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </label>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="btn-primary text-xs">
                    {loading ? "Đang lưu..." : "Lưu"}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} className="btn-ghost text-xs">
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
