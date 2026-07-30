import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeStockBalance, STOCK_TXN_TYPE_LABEL } from "@/lib/server/inventory-rules";
import ReceiptForm from "@/components/inventory/ReceiptForm";
import IssueBookForm from "@/components/inventory/IssueBookForm";
import BookEditForm from "@/components/inventory/BookEditForm";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate } from "@/lib/server/role-matrix";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventory" className="text-sm text-primary">
          ← Quay lại Kho giáo trình
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{book.name}</h1>
        <p className="mt-1 text-sm text-ink-muted48">
          {book.bookCode && <>Mã sách: <strong>{book.bookCode}</strong> · </>}Đơn giá {formatVnd(book.unitPrice)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Tồn kho</p>
          <p className={`mt-2 font-display text-2xl font-semibold tracking-tight ${balance.onHand < 0 ? "text-red-600" : ""}`}>
            {balance.onHand}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Đã nhập</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{balance.received + balance.returned + balance.adjusted}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Đã xuất</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{balance.issued}</p>
        </div>
      </div>

      {canUpdate("inventory", role) && (
        <BookEditForm
          book={{
            id: book.id,
            bookCode: book.bookCode,
            name: book.name,
            unitPrice: book.unitPrice,
            usageStatus: book.usageStatus,
            notes: book.notes,
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {canUpdate("inventory", role) && <ReceiptForm bookId={book.id} />}
        {canCreate("inventory", role) && <IssueBookForm bookId={book.id} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <h2 className="font-display text-lg font-semibold tracking-tight">Sổ kho nhập/điều chỉnh</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
              <tr>
                <th className="py-2 font-medium">Ngày</th>
                <th className="py-2 font-medium">Loại</th>
                <th className="py-2 font-medium">SL</th>
              </tr>
            </thead>
            <tbody>
              {book.stockTransactions.map((txn) => (
                <tr key={txn.id} className="border-b border-hairline last:border-0">
                  <td className="py-2">{formatDate(txn.txnDate)}</td>
                  <td className="py-2 text-ink-muted80">{STOCK_TXN_TYPE_LABEL[txn.type] ?? txn.type}</td>
                  <td className="py-2 font-medium">{txn.quantity}</td>
                </tr>
              ))}
              {book.stockTransactions.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-ink-muted48">
                    Chưa có giao dịch nhập kho.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-display text-lg font-semibold tracking-tight">Đã xuất cho học viên</h2>
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
                      {issue.student.fullName} <span className="text-ink-muted48">({issue.student.studentDisplayId ?? issue.student.studentCode})</span>
                    </Link>
                  </td>
                  <td className="py-2 text-ink-muted80">{issue.class?.className ?? "—"}</td>
                  <td className="py-2 text-ink-muted80">{issue.quantity}</td>
                  <td className="py-2 font-medium">{formatVnd(issue.amount)}</td>
                </tr>
              ))}
              {book.bookIssues.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-muted48">
                    Chưa xuất cho học viên nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
