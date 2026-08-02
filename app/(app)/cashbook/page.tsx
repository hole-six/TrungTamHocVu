import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import CashbookFilters from "@/components/cashbook/CashbookFilters";
import CashbookExportButton from "@/components/cashbook/CashbookExportButton";
import NewCashTransactionForm from "@/components/cashbook/NewCashTransactionForm";
import CategoryManager from "@/components/cashbook/CategoryManager";
import CashTransactionRow from "@/components/cashbook/CashTransactionRow";

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function CashbookPage({
  searchParams,
}: {
  searchParams?: { fromDate?: string; toDate?: string; type?: string; search?: string; categoryId?: string; page?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();

  if (!canView("cashbook", role)) {
    notFound();
  }

  const canManageCashbook = canUpdate("cashbook", role);
  const canCreateCashbook = canCreate("cashbook", role);

  // Không còn "kỳ báo cáo"/chốt kỳ — chỉ lọc theo khoảng ngày thật. Mặc định nếu
  // chưa chọn: đầu tháng hiện tại đến hôm nay (điểm khởi đầu hợp lý, không bắt buộc).
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const rangeStart = searchParams?.fromDate ? new Date(`${searchParams.fromDate}T00:00:00`) : defaultFrom;
  const rangeEnd = searchParams?.toDate ? new Date(`${searchParams.toDate}T00:00:00`) : today;
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);
  const typeFilter = searchParams?.type?.trim() ?? "";
  const searchQuery = searchParams?.search?.trim() ?? "";
  const categoryIdFilter = searchParams?.categoryId?.trim() ?? "";
  const currentPage = Number(searchParams?.page) || 1;
  const itemsPerPage = 20;

  const where: Record<string, unknown> = {
    txnDate: { gte: rangeStart, lte: rangeEnd },
  };
  if (activeBranchId) where.branchId = activeBranchId;
  if (typeFilter) where.type = typeFilter;
  if (categoryIdFilter) where.categoryId = categoryIdFilter;
  if (searchQuery) {
    where.OR = [
      { description: { contains: searchQuery, mode: "insensitive" } },
      { detail: { contains: searchQuery, mode: "insensitive" } },
      { notes: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  const [totalCount, transactions, categories] = await Promise.all([
    prisma.cashTransaction.count({ where }),
    prisma.cashTransaction.findMany({
      where,
      orderBy: { txnDate: "desc" },
      include: { category: true },
      skip: (currentPage - 1) * itemsPerPage,
      take: itemsPerPage,
    }),
    prisma.transactionCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);

  const txnIds = transactions.map((item) => item.id);
  const [paymentPostings, refundPostings, stockPostings, handlers] = await Promise.all([
    prisma.paymentCashPosting.findMany({ where: { cashTransactionId: { in: txnIds } }, select: { cashTransactionId: true } }),
    prisma.refundCashPosting.findMany({ where: { cashTransactionId: { in: txnIds } }, select: { cashTransactionId: true } }),
    prisma.stockCashPosting.findMany({ where: { cashTransactionId: { in: txnIds } }, select: { cashTransactionId: true } }),
    prisma.user.findMany({
      where: { id: { in: [...new Set(transactions.map((item) => item.handledById).filter((id): id is string => !!id))] } },
      select: { id: true, fullName: true },
    }),
  ]);

  // Phiếu sinh từ nghiệp vụ khác (thu học phí/hoàn tiền/nhập kho) chỉ được sửa ở
  // nghiệp vụ gốc — khớp đúng ràng buộc đã có ở PATCH /api/cash-transactions/[id].
  const derivedIds = new Set([
    ...paymentPostings.map((item) => item.cashTransactionId),
    ...refundPostings.map((item) => item.cashTransactionId),
    ...stockPostings.map((item) => item.cashTransactionId),
  ]);
  const handlerNameById = new Map(handlers.map((item) => [item.id, item.fullName]));

  const totalThu = transactions.filter((item) => item.type === "THU" && item.status !== "VOIDED").reduce((sum, item) => sum + item.amount, 0);
  const totalChi = transactions.filter((item) => item.type === "CHI" && item.status !== "VOIDED").reduce((sum, item) => sum + item.amount, 0);
  const balance = totalThu - totalChi;

  const byCategory = Object.values(
    transactions.reduce((accumulator, transaction) => {
      const key = transaction.category?.name ?? "Chưa phân loại";
      if (!accumulator[key]) accumulator[key] = { name: key, thu: 0, chi: 0 };
      if (transaction.status !== "VOIDED") {
        if (transaction.type === "THU") accumulator[key].thu += transaction.amount;
        if (transaction.type === "CHI") accumulator[key].chi += transaction.amount;
      }
      return accumulator;
    }, {} as Record<string, { name: string; thu: number; chi: number }>)
  ).sort((left, right) => left.name.localeCompare(right.name, "vi"));

  const normalizedTransactions = transactions.map((transaction) => ({
    id: transaction.id,
    txnDate: transaction.txnDate.toISOString(),
    type: transaction.type as "THU" | "CHI",
    amount: transaction.amount,
    description: transaction.description,
    detail: transaction.detail,
    notes: transaction.notes,
    attachmentUrl: transaction.attachmentUrl,
    status: transaction.status,
    categoryId: transaction.categoryId,
    categoryName: transaction.category?.name ?? null,
    handledByName: transaction.handledById ? handlerNameById.get(transaction.handledById) ?? null : null,
    isDerived: derivedIds.has(transaction.id),
  }));

  const amountByCategory = Object.fromEntries(byCategory.map((item) => [item.name, item.thu + item.chi]));
  const fromDateStr = toYmd(rangeStart);
  const toDateStr = toYmd(rangeEnd);
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-hairline bg-white px-5 py-4 shadow-[0_18px_45px_rgba(15,23,41,0.06)] xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="page-title">Sổ quỹ</h1>
          <p className="page-subtitle">Thu vào, chi ra và số dư thực tế của cơ sở.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreateCashbook ? <NewCashTransactionForm categories={categories} /> : null}
          <CashbookExportButton
            fromDate={fromDateStr}
            toDate={toDateStr}
            type={typeFilter}
            totals={{ totalThu, totalChi, balance }}
            byCategory={byCategory}
            transactions={normalizedTransactions}
          />
        </div>
      </div>

      <CashbookFilters
        key={`${fromDateStr}|${toDateStr}|${typeFilter}|${searchQuery}|${categoryIdFilter}`}
        initialFromDate={fromDateStr}
        initialToDate={toDateStr}
        initialType={typeFilter}
        initialSearch={searchQuery}
        initialCategoryId={categoryIdFilter}
        categories={categories}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Tổng thu vào</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-emerald-800">{formatVnd(totalThu)}</p>
        </div>
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Tổng chi ra</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-rose-800">{formatVnd(totalChi)}</p>
        </div>
        <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Số dư</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-sky-800">{formatVnd(balance)}</p>
        </div>
      </div>

      {canManageCashbook ? <CategoryManager categories={categories} amountByCategory={amountByCategory} /> : null}

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Giao dịch thu chi</h2>
            <p className="mt-1 text-sm text-ink-muted48">Bảng chính để đối chiếu từng dòng tiền.</p>
          </div>
          <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1 text-xs font-semibold text-primary">
            {totalCount} giao dịch
          </span>
        </div>

        <div className="table-container [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Loại phiếu</th>
                <th>Danh mục</th>
                <th>Nội dung thu chi</th>
                <th className="text-right">Thu vào</th>
                <th className="text-right">Chi ra</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {normalizedTransactions.map((transaction) => (
                <CashTransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  categories={categories}
                  canManageCashbook={canManageCashbook}
                />
              ))}
              {normalizedTransactions.length === 0 ? (
                <tr className="table-empty">
                  <td colSpan={8}>Chưa có phiếu thu/chi nào trong khoảng ngày đang xem.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-hairline pt-4">
            <p className="text-sm text-ink-muted48">
              Trang {currentPage} / {totalPages} • Tổng {totalCount} giao dịch
            </p>
            <div className="flex gap-2">
              <form action={`/cashbook`} method="get">
                <input type="hidden" name="fromDate" value={fromDateStr} />
                <input type="hidden" name="toDate" value={toDateStr} />
                {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
                {searchQuery && <input type="hidden" name="search" value={searchQuery} />}
                {categoryIdFilter && <input type="hidden" name="categoryId" value={categoryIdFilter} />}
                <input type="hidden" name="page" value={String(currentPage - 1)} />
                <button
                  type="submit"
                  disabled={currentPage === 1}
                  className="rounded-lg border border-hairline bg-white px-4 py-2 text-sm font-medium text-ink transition-all hover:border-[#f97316] hover:bg-orange-50 hover:text-[#f97316] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-hairline disabled:hover:bg-white disabled:hover:text-ink"
                >
                  ← Trước
                </button>
              </form>

              <form action={`/cashbook`} method="get">
                <input type="hidden" name="fromDate" value={fromDateStr} />
                <input type="hidden" name="toDate" value={toDateStr} />
                {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
                {searchQuery && <input type="hidden" name="search" value={searchQuery} />}
                {categoryIdFilter && <input type="hidden" name="categoryId" value={categoryIdFilter} />}
                <input type="hidden" name="page" value={String(currentPage + 1)} />
                <button
                  type="submit"
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-hairline bg-white px-4 py-2 text-sm font-medium text-ink transition-all hover:border-[#f97316] hover:bg-orange-50 hover:text-[#f97316] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-hairline disabled:hover:bg-white disabled:hover:text-ink"
                >
                  Tiếp →
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
