import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeStockBalance } from "@/lib/server/inventory-rules";
import NewBookForm from "@/components/inventory/NewBookForm";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function normalizeCategory(category: string | null) {
  const trimmed = category?.trim();
  return trimmed ? trimmed : "Sách khác";
}

const CATEGORY_BADGE_COLORS = ["badge-blue", "badge-purple", "badge-pink", "badge-gray"];
function categoryBadgeClass(category: string) {
  if (category === "Sách khác") return "badge-gray";
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) % CATEGORY_BADGE_COLORS.length;
  return CATEGORY_BADGE_COLORS[hash];
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `Tháng ${Number(month)}/${year}`;
}

const PAGE_SIZE = 10;

// Giữ nguyên mọi filter đang chọn (q/category/bookId/paymentStatus/month) khi đổi
// trang — chỉ đổi đúng 1 param trang được yêu cầu (book hoặc issue), 2 bảng phân
// trang độc lập trên cùng 1 trang nên phải tách riêng bookPage/issuePage.
function pageHref(current: URLSearchParams, patch: Record<string, string>) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) next.set(key, value);
  return `/inventory?${next.toString()}`;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    category?: string;
    bookId?: string;
    paymentStatus?: string;
    month?: string;
    bookPage?: string;
    issuePage?: string;
  };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const branchWhere = user?.branchId ? { branchId: user.branchId } : {};

  const q = searchParams?.q?.trim() ?? "";
  const selectedCategory = searchParams?.category?.trim() ?? "";
  const selectedBookId = searchParams?.bookId?.trim() ?? "";
  const selectedPaymentStatus = searchParams?.paymentStatus?.trim() ?? "";
  const selectedMonth = searchParams?.month?.trim() ?? "";
  const bookPage = Math.max(1, Number(searchParams?.bookPage ?? 1));
  const issuePage = Math.max(1, Number(searchParams?.issuePage ?? 1));
  const currentParams = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(selectedCategory ? { category: selectedCategory } : {}),
    ...(selectedBookId ? { bookId: selectedBookId } : {}),
    ...(selectedPaymentStatus ? { paymentStatus: selectedPaymentStatus } : {}),
    ...(selectedMonth ? { month: selectedMonth } : {}),
  });
  const monthStart = selectedMonth ? new Date(`${selectedMonth}-01T00:00:00.000Z`) : null;
  const monthEnd = monthStart ? new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)) : null;

  const books = await prisma.book.findMany({
    where: branchWhere,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const balances = await Promise.all(books.map((book) => computeStockBalance(book.id)));
  const stockRows = books.map((book, index) => {
    const balance = balances[index];
    return {
      ...book,
      categoryLabel: normalizeCategory(book.category),
      receivedTotal: balance.received + balance.returned + balance.adjusted,
      issuedTotal: balance.issued,
      onHand: balance.onHand,
    };
  });

  const categoryOptions = Array.from(new Set(stockRows.map((book) => book.categoryLabel))).sort((left, right) => left.localeCompare(right, "vi"));
  const qLower = q.toLowerCase();
  const availableBooks = stockRows.filter((book) => {
    if (selectedCategory && book.categoryLabel !== selectedCategory) return false;
    if (qLower) {
      const haystack = `${book.name} ${book.bookCode ?? ""} ${book.categoryLabel}`.toLowerCase();
      if (!haystack.includes(qLower)) return false;
    }
    return true;
  });
  const bookTotalPages = Math.max(1, Math.ceil(availableBooks.length / PAGE_SIZE));
  const pagedBooks = availableBooks.slice((bookPage - 1) * PAGE_SIZE, bookPage * PAGE_SIZE);

  const issueWhere = {
    ...(user?.branchId ? { book: { branchId: user.branchId } } : {}),
    ...(selectedBookId ? { bookId: selectedBookId } : {}),
    ...(selectedPaymentStatus ? { paymentStatus: selectedPaymentStatus } : {}),
    ...(selectedMonth
      ? {
          issueDate: {
            gte: monthStart!,
            lt: monthEnd!,
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { book: { name: { contains: q } } },
            { book: { bookCode: { contains: q } } },
            { book: { category: { contains: q } } },
            { class: { classCode: { contains: q } } },
            { class: { className: { contains: q } } },
            { student: { fullName: { contains: q } } },
            { student: { studentCode: { contains: q } } },
            { student: { studentDisplayId: { contains: q } } },
            { notes: { contains: q } },
          ],
        }
      : {}),
  };

  const bookIssues = await prisma.bookIssue.findMany({
    where: issueWhere,
    include: {
      book: true,
      class: true,
      student: true,
      charge: { include: { billingPeriod: true } },
    },
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
  });

  const issueRows = bookIssues
    .filter((issue) => !selectedCategory || normalizeCategory(issue.book.category) === selectedCategory)
    .map((issue, index) => ({
      stt: index + 1,
      id: issue.id,
      bookId: issue.bookId,
      classCode: issue.class?.classCode ?? "",
      className: issue.class?.className ?? "Chưa gắn lớp",
      studentLabel: `${issue.student.fullName}${issue.student.studentDisplayId ?? issue.student.studentCode ? ` · ${issue.student.studentDisplayId ?? issue.student.studentCode}` : ""}`,
      bookName: issue.book.name,
      bookCategory: normalizeCategory(issue.book.category),
      issueDate: issue.issueDate,
      charged: issue.amount > 0 ? "Có" : "Không",
      quantity: issue.quantity,
      unitPrice: issue.unitPrice,
      amount: issue.amount,
      paymentStatus: issue.paymentStatus,
      notes: issue.notes ?? "",
      issueMonth: monthKey(issue.issueDate),
      chargeLabel: issue.charge?.billingPeriod?.periodName ?? null,
    }));

  const issueTotalPages = Math.max(1, Math.ceil(issueRows.length / PAGE_SIZE));
  const pagedIssueRows = issueRows.slice((issuePage - 1) * PAGE_SIZE, issuePage * PAGE_SIZE);

  const totalOnHand = stockRows.reduce((sum, row) => sum + row.onHand, 0);
  const lowStock = stockRows.filter((row) => row.onHand <= 5).length;
  const totalIssueAmount = issueRows.reduce((sum, row) => sum + row.amount, 0);
  const unpaidIssues = issueRows.filter((row) => row.paymentStatus !== "PAID").length;
  const issueMonthOptions = Array.from(new Set(issueRows.map((row) => row.issueMonth))).sort((left, right) => right.localeCompare(left));

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f8fcff_0%,#eef7ff_42%,#ffffff_100%)] p-6 shadow-[0_28px_80px_-48px_rgba(14,116,144,0.45)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Sổ kho giáo trình
            </span>
            <div>
              <h1 className="page-title">Kho giáo trình</h1>
              <p className="page-subtitle max-w-3xl">
                Màn này ưu tiên tra cứu phát sách theo lớp, học viên, danh mục sách và tình trạng tiền. Danh mục là lớp cha, sách cụ thể là lớp con để lọc nhanh hơn.
              </p>
            </div>
          </div>
          {canCreate("inventory", role) ? <NewBookForm categoryOptions={categoryOptions} /> : null}
        </div>

        <form className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_220px_260px_220px_190px_auto]">
          <label className="form-group">
            <span className="label-sm">Tìm theo lớp, học viên, sách</span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="VD: UP-3A, Nguyễn Anh Duy, Everybody Up..."
              className="input"
            />
          </label>

          <label className="form-group">
            <span className="label-sm">Danh mục sách</span>
            <select name="category" defaultValue={selectedCategory} className="input">
              <option value="">Tất cả danh mục</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="form-group">
            <span className="label-sm">Tên sách</span>
            <select name="bookId" defaultValue={selectedBookId} className="input">
              <option value="">Tất cả sách</option>
              {availableBooks.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-group">
            <span className="label-sm">Tình trạng tiền</span>
            <select name="paymentStatus" defaultValue={selectedPaymentStatus} className="input">
              <option value="">Tất cả</option>
              <option value="PAID">Đã TT</option>
              <option value="UNPAID">Chưa TT</option>
            </select>
          </label>

          <label className="form-group">
            <span className="label-sm">Tháng xuất</span>
            <select name="month" defaultValue={selectedMonth} className="input">
              <option value="">Tất cả tháng</option>
              {issueMonthOptions.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary w-full">
              Lọc dữ liệu
            </button>
            <Link href="/inventory" className="btn-ghost whitespace-nowrap">
              Xóa lọc
            </Link>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Tổng tồn kho</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{totalOnHand} cuốn</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Đầu sách</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{stockRows.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted48">Dòng xuất sách</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{issueRows.length}</p>
          <p className="mt-1 text-xs text-ink-muted48">Giá trị: {formatVnd(totalIssueAmount)}</p>
        </div>
        <div className={lowStock > 0 || unpaidIssues > 0 ? "rounded-3xl border border-amber-200 bg-amber-50 p-6" : "stat-card"}>
          <p className={`text-xs font-semibold uppercase tracking-widest ${lowStock > 0 || unpaidIssues > 0 ? "text-amber-700" : "text-ink-muted48"}`}>
            Cảnh báo
          </p>
          <p className={`mt-1 font-display text-2xl font-semibold tracking-tight ${lowStock > 0 || unpaidIssues > 0 ? "text-amber-800" : ""}`}>
            {lowStock} tồn thấp
          </p>
          <p className={`mt-1 text-xs ${lowStock > 0 || unpaidIssues > 0 ? "text-amber-700" : "text-ink-muted48"}`}>
            {unpaidIssues} dòng chưa thu đủ tiền
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Danh mục sách và tồn kho</h2>
            <p className="mt-1 text-sm text-ink-muted48">
              {categoryOptions.length} danh mục · Bảng này dùng để tìm đúng tên sách trong từng danh mục trước khi xem sổ xuất chi tiết.
            </p>
          </div>
          <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
            <p className="font-semibold text-ink">Quy ước</p>
            <p className="mt-1">Nếu đầu sách chưa có danh mục, hệ thống tự xếp vào `Sách khác`.</p>
          </div>
        </div>

        <div className="mt-5 table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Danh mục</th>
                <th>Tên sách</th>
                <th>Đơn giá</th>
                <th>Đã xuất</th>
                <th>Tồn</th>
              </tr>
            </thead>
            <tbody>
              {pagedBooks.map((book) => (
                <tr key={book.id}>
                  <td>
                    <span className={categoryBadgeClass(book.categoryLabel)}>{book.categoryLabel}</span>
                  </td>
                  <td>
                    <Link href={`/inventory/${book.id}`} className="font-medium text-primary hover:underline">
                      {book.name}
                    </Link>
                  </td>
                  <td>{formatVnd(book.unitPrice)}</td>
                  <td>{book.issuedTotal}</td>
                  <td>
                    <span className={book.onHand <= 5 ? "badge-amber" : "badge-green"}>{book.onHand}</span>
                  </td>
                </tr>
              ))}
              {availableBooks.length === 0 ? (
                <tr className="table-empty">
                  <td colSpan={5}>Không có đầu sách nào khớp bộ lọc.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {availableBooks.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-[#e6eefc] pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-ink-muted48">
              Trang {bookPage}/{bookTotalPages} • Hiển thị {pagedBooks.length} trên tổng {availableBooks.length} đầu sách
            </p>
            <div className="pagination">
              <Link
                href={pageHref(currentParams, { bookPage: String(Math.max(1, bookPage - 1)) })}
                className={bookPage <= 1 ? "pagination-item pointer-events-none opacity-50" : "pagination-item"}
              >
                Trước
              </Link>
              <span className="pagination-item-active">{bookPage}</span>
              <Link
                href={pageHref(currentParams, { bookPage: String(Math.min(bookTotalPages, bookPage + 1)) })}
                className={bookPage >= bookTotalPages ? "pagination-item pointer-events-none opacity-50" : "pagination-item"}
              >
                Sau
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Sổ xuất giáo trình</h2>
            <p className="mt-1 text-sm text-ink-muted48">
              Bảng này bám đúng logic file gốc: tra theo lớp, học viên, sách, ngày xuất, có tính tiền, số lượng, đơn giá, thành tiền và tình trạng tiền.
            </p>
          </div>
          <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
            <p className="font-semibold text-ink">Cách hiểu nhanh</p>
            <p className="mt-1">`Có tính tiền` nhìn theo giá trị dòng xuất. `Tình trạng tiền` lấy từ trạng thái thanh toán của giáo trình.</p>
          </div>
        </div>

        <div className="mt-5 table-container">
          <table className="table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Mã lớp</th>
                <th>Tên lớp</th>
                <th>Tên HV</th>
                <th>Danh mục</th>
                <th>Tên sách</th>
                <th>Ngày xuất</th>
                <th>Có tính tiền</th>
                <th>SL</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
                <th>Tình trạng tiền</th>
                <th>Ghi chú</th>
                <th>Tháng xuất</th>
              </tr>
            </thead>
            <tbody>
              {pagedIssueRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.stt}</td>
                  <td>{row.classCode || "—"}</td>
                  <td>{row.className}</td>
                  <td>{row.studentLabel}</td>
                  <td>
                    <span className={categoryBadgeClass(row.bookCategory)}>{row.bookCategory}</span>
                  </td>
                  <td>
                    <Link href={`/inventory/${row.bookId}`} className="text-primary hover:underline">
                      {row.bookName}
                    </Link>
                  </td>
                  <td>{row.issueDate.toLocaleDateString("vi-VN")}</td>
                  <td>{row.charged}</td>
                  <td>{row.quantity}</td>
                  <td>{formatVnd(row.unitPrice)}</td>
                  <td className="font-medium">{formatVnd(row.amount)}</td>
                  <td>
                    <span className={row.paymentStatus === "PAID" ? "badge-green" : "badge-amber"}>
                      {row.paymentStatus === "PAID" ? "Đã TT" : "Chưa TT"}
                    </span>
                  </td>
                  <td>{row.notes || "—"}</td>
                  <td>{monthLabel(row.issueMonth)}</td>
                </tr>
              ))}
              {issueRows.length === 0 ? (
                <tr className="table-empty">
                  <td colSpan={14}>Không có dòng xuất giáo trình nào khớp bộ lọc hiện tại.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {issueRows.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-[#e6eefc] pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-ink-muted48">
              Trang {issuePage}/{issueTotalPages} • Hiển thị {pagedIssueRows.length} trên tổng {issueRows.length} dòng xuất
            </p>
            <div className="pagination">
              <Link
                href={pageHref(currentParams, { issuePage: String(Math.max(1, issuePage - 1)) })}
                className={issuePage <= 1 ? "pagination-item pointer-events-none opacity-50" : "pagination-item"}
              >
                Trước
              </Link>
              <span className="pagination-item-active">{issuePage}</span>
              <Link
                href={pageHref(currentParams, { issuePage: String(Math.min(issueTotalPages, issuePage + 1)) })}
                className={issuePage >= issueTotalPages ? "pagination-item pointer-events-none opacity-50" : "pagination-item"}
              >
                Sau
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
