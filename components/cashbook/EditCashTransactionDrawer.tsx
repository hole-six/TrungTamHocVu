"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { CASH_TXN_STATUS_LABEL } from "@/lib/server/cash-rules";
import { formatVnd, formatDate } from "@/lib/export-utils";

type Category = { id: string; type: string; name: string };

type CashTransaction = {
  id: string;
  type: "THU" | "CHI";
  amount: number;
  txnDate: string;
  description: string | null;
  detail: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  status: string;
  categoryId: string | null;
  isDerived: boolean;
};

type EditCashTransactionDrawerProps = {
  transaction: CashTransaction;
  categories: Category[];
  canManage: boolean;
  trigger: React.ReactNode;
};

export default function EditCashTransactionDrawer({ transaction, categories, canManage, trigger }: EditCashTransactionDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: transaction.description ?? "",
    detail: transaction.detail ?? "",
    categoryId: transaction.categoryId ?? "",
    notes: transaction.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canEdit = canManage && !transaction.isDerived && transaction.status !== "VOIDED";

  async function handleSave(event: React.FormEvent) {
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

    setOpen(false);
    router.refresh();
  }

  async function handleVoid() {
    const response = await fetch(`/api/cash-transactions/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "VOIDED" }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "Không thể hủy phiếu.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  function handleClose() {
    setOpen(false);
    setForm({
      description: transaction.description ?? "",
      detail: transaction.detail ?? "",
      categoryId: transaction.categoryId ?? "",
      notes: transaction.notes ?? "",
    });
    setError(null);
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>

      <ResponsiveDrawer open={open} onClose={handleClose} title="Chi tiết giao dịch" widthClassName="max-w-2xl">
        <div className="space-y-6">
          {/* Thông tin cơ bản - chỉ đọc */}
          <div className="rounded-xl border border-hairline bg-[#f8fafc] p-4">
            <h3 className="text-sm font-semibold text-ink">Thông tin phiếu</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-ink-muted48">Ngày giao dịch</p>
                <p className="mt-1 font-medium text-ink">{formatDate(transaction.txnDate)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted48">Loại phiếu</p>
                <p className="mt-1">
                  <span className={transaction.type === "THU" ? "badge-green" : "badge-red"}>
                    {transaction.type === "THU" ? "Thu vào" : "Chi ra"}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-muted48">Số tiền</p>
                <p className={`mt-1 text-lg font-bold ${transaction.type === "THU" ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatVnd(transaction.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-muted48">Trạng thái</p>
                <p className="mt-1">
                  <span className="badge-gray">{CASH_TXN_STATUS_LABEL[transaction.status] ?? transaction.status}</span>
                  {transaction.isDerived ? <span className="ml-2 badge-purple">Tự động</span> : null}
                </p>
              </div>
            </div>
          </div>

          {/* Form chỉnh sửa */}
          {canEdit ? (
            <form onSubmit={handleSave} className="space-y-4">
              <label className="form-group">
                <span className="label">Diễn giải ngắn</span>
                <input
                  placeholder="Nội dung thu/chi ngắn gọn"
                  className="input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <p className="hint">Hiển thị trong bảng giao dịch chính.</p>
              </label>

              <label className="form-group">
                <span className="label">Danh mục</span>
                <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Chưa chọn danh mục</option>
                  {categories
                    .filter((cat) => cat.type === transaction.type)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
                <p className="hint">Phân loại giao dịch để dễ đối soát.</p>
              </label>

              <label className="form-group">
                <span className="label">Diễn giải chi tiết</span>
                <input
                  placeholder="Thông tin đầy đủ hơn về giao dịch"
                  className="input"
                  value={form.detail}
                  onChange={(e) => setForm({ ...form, detail: e.target.value })}
                />
              </label>

              <label className="form-group">
                <span className="label">Ghi chú nội bộ</span>
                <textarea
                  placeholder="Ghi chú riêng cho quản lý, không hiện ra ngoài"
                  className="input resize-none"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              {transaction.attachmentUrl ? (
                <div className="form-group">
                  <span className="label">Tệp đính kèm</span>
                  <a
                    href={transaction.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    📎 Xem tệp đính kèm
                  </a>
                </div>
              ) : null}

              {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

              <div className="flex items-center justify-between gap-3 border-t border-hairline pt-4">
                <ConfirmActionButton
                  title="Xác nhận hủy phiếu?"
                  description={`Hủy phiếu ${transaction.type === "THU" ? "thu" : "chi"} "${transaction.description ?? ""}" (${formatVnd(transaction.amount)}). Phiếu đã hủy sẽ không còn tính vào tổng thu/chi nhưng vẫn giữ lại để đối soát.`}
                  confirmLabel="Hủy phiếu"
                  tone="danger"
                  className="btn-ghost text-red-600"
                  onConfirm={handleVoid}
                >
                  Hủy phiếu
                </ConfirmActionButton>

                <div className="flex gap-3">
                  <button type="button" onClick={handleClose} className="btn-ghost">
                    Đóng
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                {transaction.isDerived
                  ? "Phiếu này sinh tự động từ nghiệp vụ gốc nên không sửa/hủy trực tiếp tại sổ quỹ."
                  : "Phiếu đã hủy không thể chỉnh sửa."}
              </p>
              <div className="space-y-2 text-sm text-amber-800">
                <div>
                  <span className="text-xs text-amber-600">Diễn giải:</span>
                  <p className="font-medium">{transaction.description || "—"}</p>
                </div>
                {transaction.detail ? (
                  <div>
                    <span className="text-xs text-amber-600">Chi tiết:</span>
                    <p>{transaction.detail}</p>
                  </div>
                ) : null}
                {transaction.notes ? (
                  <div>
                    <span className="text-xs text-amber-600">Ghi chú:</span>
                    <p>{transaction.notes}</p>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end pt-3">
                <button type="button" onClick={handleClose} className="btn-ghost">
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </ResponsiveDrawer>
    </>
  );
}
