import Link from "next/link";
import BackButton from "@/components/ui/BackButton";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeStockBalance, STOCK_TXN_TYPE_LABEL } from "@/lib/server/inventory-rules";
import ReceiptForm from "@/components/inventory/ReceiptForm";
import IssueBookForm from "@/components/inventory/IssueBookForm";
import BookEditForm from "@/components/inventory/BookEditForm";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate } from "@/lib/server/role-matrix";
import { formatVnd } from "@/lib/export-utils";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

export default async function BookDetailPage({ params }: { params: { id: string } }) {
  const book = await prisma.book.findUnique({
    where: { id: params.id },
    include: {
      stockTransactions: { orderBy: { txnDate: "desc" } },
      bookIssues: { include: { student: true, class: true }, orderBy: { issueDate: "desc" } },
    },
  });
  if (!book) notFound();

  const currentUser = await getCurrentUser();
  if (currentUser?.branchId && book.branchId !== currentUser.branchId) notFound();
  const role = currentUser ? await getUserRole(currentUser.id) : null;

  const balance = await computeStockBalance(book.id);
  const receiptCost = book.stockTransactions.filter((t) => t.type === "RECEIPT").reduce((sum, t) => sum + t.totalAmount, 0);
  const issueRevenue = book.bookIssues.reduce((sum, issue) => sum + issue.amount, 0);
  const profit = issueRevenue - receiptCost;
  const categoryOptions = (
    await prisma.book.findMany({
      where: { branchId: book.branchId, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    })
  )
    .map((b) => b.category!)
    .sort((left, right) => left.localeCompare(right, "vi"));
  const lowStock = balance.onHand <= 5;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <BackButton href="/inventory" className="text-sm text-primary">
          ← Quay lại kho giáo trình
        </BackButton>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{book.name}</h1>
              <p className="mt-1 text-sm text-ink-muted48">
                {book.bookCode ? (
                  <>
                    Mã sách <strong>{book.bookCode}</strong> ·{" "}
                  </>
                ) : null}
                Giá nhập {formatVnd(book.purchasePrice)} · Giá bán {formatVnd(book.unitPrice)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-full border px-3 py-1 font-medium ${
                  lowStock ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                Tồn kho {balance.onHand}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-medium text-sky-700">Đã xuất {balance.issued}</span>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-medium text-violet-700">LN {formatVnd(profit)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/inventory" className="btn-ghost">
              Danh mục sách
            </Link>
            <Link href="/classes" className="btn-ghost">
              Khóa học
            </Link>
            {canUpdate("inventory", role) ? <ReceiptForm bookId={book.id} defaultUnitPrice={book.purchasePrice} /> : null}
            {canCreate("inventory", role) ? <IssueBookForm bookId={book.id} /> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[24px] border border-hairline bg-white/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Tồn kho</p>
          <p className={`mt-2 font-display text-2xl font-semibold tracking-tight ${balance.onHand < 0 ? "text-red-600" : ""}`}>{balance.onHand}</p>
        </div>
        <div className="rounded-[24px] border border-hairline bg-white/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Đã nhập</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{balance.received + balance.returned + balance.adjusted}</p>
        </div>
        <div className="rounded-[24px] border border-hairline bg-white/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Đã xuất</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{balance.issued}</p>
        </div>
        <div className="rounded-[24px] border border-hairline bg-white/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Lợi nhuận ước tính</p>
          <p className={`mt-2 font-display text-2xl font-semibold tracking-tight ${profit < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatVnd(profit)}</p>
          <p className="mt-1 text-xs text-ink-muted48">Doanh thu xuất {formatVnd(issueRevenue)} · Giá nhập đã ghi {formatVnd(receiptCost)}</p>
        </div>
      </div>

      {canUpdate("inventory", role) ? (
        <BookEditForm
          book={{
            id: book.id,
            bookCode: book.bookCode,
            category: book.category,
            name: book.name,
            purchasePrice: book.purchasePrice,
            unitPrice: book.unitPrice,
            usageStatus: book.usageStatus,
            notes: book.notes,
          }}
          categoryOptions={categoryOptions}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Stock Transactions Table */}
        <div className="rounded-[28px] border border-hairline bg-white/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Nhập / điều chỉnh</h2>
            <span className="badge bg-ink/5 text-ink-muted80">{book.stockTransactions.length} dòng</span>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block">
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Ngày</th>
                  <th className="py-2 font-medium">Loại</th>
                  <th className="py-2 font-medium">SL</th>
                  <th className="py-2 font-medium">Giá nhập</th>
                  <th className="py-2 font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {book.stockTransactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(txn.txnDate)}</td>
                    <td className="py-2 text-ink-muted80">{STOCK_TXN_TYPE_LABEL[txn.type] ?? txn.type}</td>
                    <td className="py-2 font-medium">{txn.quantity}</td>
                    <td className="py-2 text-ink-muted80">{formatVnd(txn.unitPrice)}</td>
                    <td className="py-2 font-medium">{formatVnd(txn.totalAmount)}</td>
                  </tr>
                ))}
                {book.stockTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-ink-muted48">
                      Chưa có giao dịch nhập kho.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="mt-3 space-y-3 lg:hidden">
            {book.stockTransactions.map((txn) => (
              <div key={txn.id} className="rounded-lg border border-hairline bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{formatDate(txn.txnDate)}</p>
                    <p className="mt-0.5 text-xs text-ink-muted80">{STOCK_TXN_TYPE_LABEL[txn.type] ?? txn.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatVnd(txn.totalAmount)}</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-hairline pt-2 text-xs">
                  <div>
                    <span className="text-ink-muted48">Số lượng:</span>
                    <span className="ml-1 font-medium">{txn.quantity}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-ink-muted48">Giá nhập:</span>
                    <span className="ml-1 font-medium">{formatVnd(txn.unitPrice)}</span>
                  </div>
                </div>
              </div>
            ))}
            {book.stockTransactions.length === 0 ? (
              <div className="py-8 text-center text-sm text-ink-muted48">Chưa có giao dịch nhập kho.</div>
            ) : null}
          </div>
        </div>

        {/* Book Issues Table */}
        <div className="rounded-[28px] border border-hairline bg-white/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Đã xuất cho học viên</h2>
            <span className="badge bg-ink/5 text-ink-muted80">{book.bookIssues.length} dòng</span>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block">
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                <tr>
                  <th className="py-2 font-medium">Ngày</th>
                  <th className="py-2 font-medium">Học viên</th>
                  <th className="py-2 font-medium">Lớp</th>
                  <th className="py-2 font-medium">SL</th>
                  <th className="py-2 font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {book.bookIssues.map((issue) => (
                  <tr key={issue.id} className="border-b border-hairline last:border-0">
                    <td className="py-2">{formatDate(issue.issueDate)}</td>
                    <td className="py-2">
                      <Link href={`/students/${issue.studentId}`} className="text-primary">
                        {issue.student.fullName} <span className="text-ink-muted48">({issue.student.studentCode})</span>
                      </Link>
                    </td>
                    <td className="py-2 text-ink-muted80">{issue.class?.className ?? "—"}</td>
                    <td className="py-2 text-ink-muted80">{issue.quantity}</td>
                    <td className="py-2 font-medium">{formatVnd(issue.amount)}</td>
                  </tr>
                ))}
                {book.bookIssues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-ink-muted48">
                      Chưa xuất cho học viên nào.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="mt-3 space-y-3 lg:hidden">
            {book.bookIssues.map((issue) => (
              <div key={issue.id} className="rounded-lg border border-hairline bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Link href={`/students/${issue.studentId}`} className="text-sm font-medium text-primary">
                      {issue.student.fullName}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-muted48">{issue.student.studentCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatVnd(issue.amount)}</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-hairline pt-2 text-xs">
                  <div>
                    <span className="text-ink-muted48">Ngày xuất:</span>
                    <span className="ml-1 font-medium">{formatDate(issue.issueDate)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-ink-muted48">Số lượng:</span>
                    <span className="ml-1 font-medium">{issue.quantity}</span>
                  </div>
                </div>
                {issue.class?.className ? (
                  <div className="mt-1.5 text-xs">
                    <span className="text-ink-muted48">Lớp:</span>
                    <span className="ml-1 text-ink-muted80">{issue.class.className}</span>
                  </div>
                ) : null}
              </div>
            ))}
            {book.bookIssues.length === 0 ? (
              <div className="py-8 text-center text-sm text-ink-muted48">Chưa xuất cho học viên nào.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
