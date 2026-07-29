import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { CASH_TXN_TYPE_LABEL, CASH_TXN_STATUS_LABEL } from "@/lib/server/cash-rules";
import CategoryManager from "@/components/cashbook/CategoryManager";
import NewCashTransactionForm from "@/components/cashbook/NewCashTransactionForm";
import VoidButton from "@/components/cashbook/VoidButton";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

export default async function CashbookPage({ searchParams }: { searchParams: { type?: string } }) {
  const user = await getCurrentUser();
  const type = searchParams.type ?? "";

  const [transactions, categories] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: { ...(user?.branchId ? { branchId: user.branchId } : {}), ...(type ? { type } : {}) },
      orderBy: { txnDate: "desc" },
      include: { category: true },
    }),
    prisma.transactionCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);

  const totalThu = transactions.filter((t) => t.type === "THU" && t.status !== "VOIDED").reduce((s, t) => s + t.amount, 0);
  const totalChi = transactions.filter((t) => t.type === "CHI" && t.status !== "VOIDED").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Thu chi</h1>
          <p className="page-subtitle">{transactions.length} phiếu</p>
        </div>
        <NewCashTransactionForm categories={categories} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng thu</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-emerald-600">{formatVnd(totalThu)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng chi</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-red-600">{formatVnd(totalChi)}</p>
        </div>
        <div className="stat-card-accent">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Số dư quỹ</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">{formatVnd(totalThu - totalChi)}</p>
        </div>
      </div>

      <CategoryManager categories={categories} />

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Loại</th>
              <th>Danh mục</th>
              <th>Diễn giải</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className={t.status === "VOIDED" ? "opacity-40" : ""}>
                <td>{formatDate(t.txnDate)}</td>
                <td>
                  <span className={t.type === "THU" ? "badge-blue" : "badge-gray"}>{CASH_TXN_TYPE_LABEL[t.type]}</span>
                </td>
                <td className="text-ink-muted80">{t.category?.name ?? "—"}</td>
                <td className="text-ink-muted80">{t.description ?? "—"}</td>
                <td className="font-medium">{formatVnd(t.amount)}</td>
                <td>
                  <span className="badge-gray">{CASH_TXN_STATUS_LABEL[t.status] ?? t.status}</span>
                </td>
                <td>{t.status === "CONFIRMED" && <VoidButton txnId={t.id} />}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr className="table-empty">
                <td colSpan={7}>Chưa có phiếu thu/chi nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
