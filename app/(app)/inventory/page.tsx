import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeStockBalance } from "@/lib/server/inventory-rules";
import NewBookForm from "@/components/inventory/NewBookForm";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

export default async function InventoryPage() {
  const user = await getCurrentUser();
  const books = await prisma.book.findMany({
    where: user?.branchId ? { branchId: user.branchId } : {},
    orderBy: { name: "asc" },
  });

  const balances = await Promise.all(books.map((b) => computeStockBalance(b.id)));

  const totalOnHand = balances.reduce((s, b) => s + b.onHand, 0);
  const lowStock = balances.filter((b) => b.onHand <= 5).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Kho giáo trình</h1>
          <p className="page-subtitle">{books.length} đầu sách</p>
        </div>
        <NewBookForm />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng tồn kho</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{totalOnHand} cuốn</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Đầu sách</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{books.length}</p>
        </div>
        {lowStock > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Sắp hết hàng</p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-amber-800">{lowStock} đầu sách</p>
            <p className="mt-0.5 text-xs text-amber-600">tồn ≤ 5 cuốn</p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tên sách</th>
              <th>Đơn giá</th>
              <th>Đã nhập</th>
              <th>Đã xuất</th>
              <th>Tồn kho</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b, idx) => {
              const bal = balances[idx];
              return (
                <tr key={b.id}>
                  <td>
                    <Link href={`/inventory/${b.id}`} className="font-medium text-primary hover:underline">
                      {b.name}
                    </Link>
                  </td>
                  <td className="text-ink-muted80">{formatVnd(b.unitPrice)}</td>
                  <td className="text-ink-muted80">{bal.received + bal.returned + bal.adjusted}</td>
                  <td className="text-ink-muted80">{bal.issued}</td>
                  <td>
                    <span
                      className={
                        bal.onHand < 0
                          ? "badge-red"
                          : bal.onHand <= 5
                          ? "badge-amber"
                          : "badge-green"
                      }
                    >
                      {bal.onHand}
                    </span>
                  </td>
                </tr>
              );
            })}
            {books.length === 0 && (
              <tr className="table-empty">
                <td colSpan={5}>
                  <div className="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted48/40">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    <p className="empty-state-title">Chưa có sách/giáo trình nào</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
