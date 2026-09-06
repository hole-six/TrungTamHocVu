"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import { Section, Stat } from "@/components/ui/DetailDrawerParts";
import ReceiptForm from "@/components/inventory/ReceiptForm";
import IssueBookForm from "@/components/inventory/IssueBookForm";
import BookEditForm from "@/components/inventory/BookEditForm";
import { STOCK_TXN_TYPE_LABEL } from "@/lib/server/inventory-rules";
import { formatVnd } from "@/lib/export-utils";

type StockTxn = {
  id: string;
  txnDate: string;
  type: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  notes: string | null;
};

type BookIssue = {
  id: string;
  issueDate: string;
  quantity: number;
  amount: number;
  studentId: string;
  student: { fullName: string; studentCode: string } | null;
  class: { className: string } | null;
};

type BookDetail = {
  id: string;
  bookCode: string | null;
  name: string;
  category: string | null;
  purchasePrice: number;
  unitPrice: number;
  usageStatus: string | null;
  notes: string | null;
  stockTransactions: StockTxn[];
  bookIssues: BookIssue[];
};

type Balance = { received: number; returned: number; adjusted: number; issued: number; onHand: number };

/** Tiền tính từ aggregate toàn bộ dòng ở server — KHÔNG cộng lại từ 2 mảng bên dưới vì
 *  chúng chỉ là 30 dòng gần nhất. */
type Totals = { receiptCost: number; issueRevenue: number; profit: number };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

// Chi tiết 1 đầu sách — trước đây là trang riêng /inventory/[id]: bấm "Xem" là rời khỏi
// danh mục, xem xong phải bấm quay lại rồi tìm lại đúng dòng cũ. Cùng lối với drawer
// học viên/lớp học: các Section gập mở, đúng 1 lớp khung, không lồng thẻ trong thẻ.
export default function BookDetailDrawer({
  bookId,
  open,
  onClose,
  categoryOptions,
  canUpdateInventory,
  canCreateIssue,
}: {
  bookId: string | null;
  open: boolean;
  onClose: () => void;
  categoryOptions: string[];
  canUpdateInventory: boolean;
  canCreateIssue: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<BookDetail | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookId) return;
    setError(null);
    const res = await fetch(`/api/books/${bookId}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Không tải được thông tin sách.");
      return;
    }
    setData(json.item);
    setBalance(json.balance);
    setTotals(json.totals);
  }, [bookId]);

  useEffect(() => {
    if (!open || !bookId) return;
    setData(null);
    setBalance(null);
    setTotals(null);
    void load();
  }, [open, bookId, load]);

  if (!open || !bookId) return null;

  const receiptCost = totals?.receiptCost ?? 0;
  const issueRevenue = totals?.issueRevenue ?? 0;
  const profit = totals?.profit ?? 0;
  const lowStock = (balance?.onHand ?? 0) <= 5;

  return (
    <ResponsiveDrawer open={open} onClose={onClose} title={data?.name ?? "Đang tải..."} widthClassName="max-w-3xl">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!data || !balance ? (
        error ? null : <p className="text-sm text-[#94a3b8]">Đang tải...</p>
      ) : (
        <div className="space-y-4">
          {/* Danh tính: mã sách, danh mục, tình trạng — 1 dòng, không lặp lại tên sách */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {data.bookCode ? (
              <span className="rounded-md border border-[#e2e8f0] bg-[#f8faff] px-2 py-1 font-mono font-bold text-[#475569]">{data.bookCode}</span>
            ) : null}
            <span className="rounded-md border border-[#e2e8f0] bg-white px-2 py-1 font-semibold text-[#475569]">
              {data.category ?? "Chưa xếp danh mục"}
            </span>
            {lowStock ? <span className="rounded-md bg-[#b45309] px-2 py-1 font-bold text-white">Sắp hết hàng</span> : null}
            {data.usageStatus ? <span className="text-[#64748b]">{data.usageStatus}</span> : null}
          </div>

          {/* Hai con số thật sự cần khi mở 1 đầu sách: còn bao nhiêu và lãi/lỗ bao nhiêu */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Tồn kho</p>
              <p className={`mt-1 text-3xl font-black ${balance.onHand < 0 ? "text-[#dc2626]" : "text-[#0f1729]"}`}>{balance.onHand}</p>
              <p className="mt-0.5 text-sm text-[#64748b]">
                Đã nhập {balance.received + balance.returned + balance.adjusted} · đã xuất {balance.issued}
              </p>
            </div>
            <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Lợi nhuận ước tính</p>
              <p className={`mt-1 text-3xl font-black ${profit < 0 ? "text-[#dc2626]" : "text-[#0f1729]"}`}>{formatVnd(profit)}</p>
              <p className="mt-0.5 text-sm text-[#64748b]">
                Thu {formatVnd(issueRevenue)} · nhập {formatVnd(receiptCost)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canUpdateInventory ? <ReceiptForm bookId={data.id} defaultUnitPrice={data.purchasePrice} /> : null}
            {canCreateIssue ? <IssueBookForm bookId={data.id} /> : null}
          </div>

          <Section title="Thông tin sách" hint={`${formatVnd(data.unitPrice)}/cuốn`} defaultOpen>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Stat label="Giá nhập">{formatVnd(data.purchasePrice)}</Stat>
              <Stat label="Giá bán">{formatVnd(data.unitPrice)}</Stat>
              <Stat label="Chênh lệch/cuốn">{formatVnd(data.unitPrice - data.purchasePrice)}</Stat>
              <Stat label="Danh mục">{data.category}</Stat>
              <Stat label="Tình trạng">{data.usageStatus}</Stat>
              <Stat label="Ghi chú" wide>
                {data.notes}
              </Stat>
            </div>
          </Section>

          <Section title="Nhập / điều chỉnh" hint={`${data.stockTransactions.length} dòng`}>
            {data.stockTransactions.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">Chưa có giao dịch nhập kho.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                      <th className="pb-2 font-semibold">Ngày</th>
                      <th className="pb-2 font-semibold">Loại</th>
                      <th className="pb-2 text-right font-semibold">SL</th>
                      <th className="pb-2 text-right font-semibold">Giá nhập</th>
                      <th className="pb-2 text-right font-semibold">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stockTransactions.map((txn) => (
                      <tr key={txn.id} className="border-t border-[#f1f5f9]">
                        <td className="py-2">{formatDate(txn.txnDate)}</td>
                        <td className="py-2 text-[#475569]">{STOCK_TXN_TYPE_LABEL[txn.type] ?? txn.type}</td>
                        <td className="py-2 text-right text-[#475569]">{txn.quantity}</td>
                        <td className="py-2 text-right text-[#475569]">{formatVnd(txn.unitPrice)}</td>
                        <td className="py-2 text-right font-semibold">{formatVnd(txn.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Đã xuất cho học viên" hint={`${data.bookIssues.length} dòng`}>
            {data.bookIssues.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">Chưa xuất cho học viên nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                      <th className="pb-2 font-semibold">Ngày</th>
                      <th className="pb-2 font-semibold">Học viên</th>
                      <th className="pb-2 font-semibold">Lớp</th>
                      <th className="pb-2 text-right font-semibold">SL</th>
                      <th className="pb-2 text-right font-semibold">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bookIssues.map((issue) => (
                      <tr key={issue.id} className="border-t border-[#f1f5f9]">
                        <td className="py-2">{formatDate(issue.issueDate)}</td>
                        <td className="py-2">
                          <Link href={`/students/${issue.studentId}`} className="font-semibold text-[#1d4ed8] hover:underline">
                            {issue.student?.fullName ?? "—"}
                          </Link>
                          {issue.student ? <span className="ml-1 text-xs text-[#94a3b8]">{issue.student.studentCode}</span> : null}
                        </td>
                        <td className="py-2 text-[#475569]">{issue.class?.className ?? "—"}</td>
                        <td className="py-2 text-right text-[#475569]">{issue.quantity}</td>
                        <td className="py-2 text-right font-semibold">{formatVnd(issue.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {canUpdateInventory ? (
            <Section title="Sửa thông tin sách">
              <BookEditForm
                book={{
                  id: data.id,
                  bookCode: data.bookCode,
                  category: data.category,
                  name: data.name,
                  purchasePrice: data.purchasePrice,
                  unitPrice: data.unitPrice,
                  usageStatus: data.usageStatus,
                  notes: data.notes,
                }}
                categoryOptions={categoryOptions}
                bare
                onSaved={() => {
                  void load();
                  router.refresh();
                }}
              />
            </Section>
          ) : null}
        </div>
      )}
    </ResponsiveDrawer>
  );
}
