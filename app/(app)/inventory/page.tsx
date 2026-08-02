import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeStockBalance } from "@/lib/server/inventory-rules";
import NewBookForm from "@/components/inventory/NewBookForm";
import BooksTable from "@/components/inventory/BooksTable";
import PageGuide from "@/components/ui/PageGuide";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";

const INVENTORY_PAGE_GUIDE_SECTIONS = [
  {
    title: "Màn này để làm gì?",
    items: [
      "Đây là màn vận hành kho giáo trình: quản lý đầu sách, nhập kho, xuất cho học viên và theo dõi tình trạng thanh toán sách.",
      "Phần trên là danh mục đầu sách và tồn kho hiện tại.",
      "Phần dưới là sổ xuất giáo trình để xem ai đã nhận sách, nhận ngày nào và đã thanh toán hay chưa.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách vận hành chuẩn",
    items: [
      "Thêm đầu sách mới trước khi bắt đầu nhập kho hoặc xuất cho học viên.",
      "Mỗi lần hàng về thì dùng nhập kho để cộng tồn và lưu giá nhập đúng đợt.",
      "Khi giao sách cho học viên thì dùng xuất cho học viên để trừ tồn và gắn lịch sử phát sách.",
      "Dùng sổ xuất phía dưới để lọc, tra cứu và đối chiếu nhanh phần chưa thanh toán.",
    ],
    tone: "success" as const,
  },
  {
    title: "Điểm cần tránh",
    items: [
      "Không sửa thông tin đầu sách để cố xử lý tồn kho.",
      "Không xuất sách trước khi giao thực tế.",
      "Không gộp nhiều đợt nhập khác giá thành một lần nhập kho duy nhất nếu muốn giữ lịch sử rõ.",
    ],
    tone: "warning" as const,
  },
];

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
    bookId?: string;
    paymentStatus?: string;
    month?: string;
    issuePage?: string;
  };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();
  const branchWhere = activeBranchId ? { branchId: activeBranchId } : {};

  const q = searchParams?.q?.trim() ?? "";
  const selectedBookId = searchParams?.bookId?.trim() ?? "";
  const selectedPaymentStatus = searchParams?.paymentStatus?.trim() ?? "";
  const selectedMonth = searchParams?.month?.trim() ?? "";
  const issuePage = Math.max(1, Number(searchParams?.issuePage ?? 1));
  const currentParams = new URLSearchParams({
    ...(q ? { q } : {}),
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

  const issueWhere = {
    ...(activeBranchId ? { book: { branchId: activeBranchId } } : {}),
    ...(selectedBookId ? { bookId: selectedBookId } : {}),
    ...(selectedPaymentStatus ? { paymentStatus: selectedPaymentStatus } : {}),
    ...(selectedMonth ? { issueDate: { gte: monthStart!, lt: monthEnd! } } : {}),
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

  const issueRows = bookIssues.map((issue, index) => ({
      stt: index + 1,
      id: issue.id,
      bookId: issue.bookId,
      classCode: issue.class?.classCode ?? "",
      className: issue.class?.className ?? "Chưa gắn lớp",
      studentLabel: `${issue.student.fullName}${issue.student.studentCode ? ` · ${issue.student.studentCode}` : ""}`,
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
      <PageGuide
        title="Guide vận hành kho giáo trình"
        summary="Đây là màn quản lý đầu sách, tồn kho và lịch sử xuất sách. Người mới chỉ cần phân biệt rõ ba việc: thêm đầu sách, nhập kho và xuất cho học viên."
        sections={INVENTORY_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide kho sách"
      />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="page-title">Kho giáo trình</h1>
          <p className="page-subtitle">Tra cứu tồn kho, xuất sách và tình trạng thu tiền</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canCreate("inventory", role) ? <NewBookForm categoryOptions={categoryOptions} /> : null}
        </div>
      </div>

      <section className="space-y-4 rounded-[28px] border border-hairline bg-white/70 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Danh mục sách</h2>
          </div>
          <Link href="/classes" className="btn-ghost">
            Khóa học
          </Link>
        </div>
        <div>
          <BooksTable
            initialData={stockRows}
            categoryOptions={categoryOptions}
            userRole={role || "TEACHER"}
            totalOnHand={totalOnHand}
            lowStockCount={lowStock}
            unpaidIssuesCount={unpaidIssues}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-[28px] border border-hairline bg-white/70 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Sổ xuất giáo trình</h2>
          </div>
          <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1 text-xs font-semibold text-primary">
            {issueRows.length} dòng
          </span>
        </div>
        <form className="grid gap-3 rounded-3xl border border-line/70 bg-surface/70 p-4 xl:grid-cols-[minmax(0,1.2fr)_260px_220px_190px_auto]">
          <label className="form-group">
            <span className="label-sm">Tìm kiếm</span>
            <input type="text" name="q" defaultValue={q} placeholder="Lớp, học viên, sách..." className="input" />
          </label>
          <label className="form-group">
            <span className="label-sm">Sách</span>
            <select name="bookId" defaultValue={selectedBookId} className="input">
              <option value="">Tất cả</option>
              {stockRows.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="label-sm">Thanh toán</span>
            <select name="paymentStatus" defaultValue={selectedPaymentStatus} className="input">
              <option value="">Tất cả</option>
              <option value="PAID">Đã TT</option>
              <option value="UNPAID">Chưa TT</option>
            </select>
          </label>
          <label className="form-group">
            <span className="label-sm">Tháng</span>
            <select name="month" defaultValue={selectedMonth} className="input">
              <option value="">Tất cả</option>
              {issueMonthOptions.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary w-full">
              Lọc
            </button>
            <Link href="/inventory" className="btn-ghost whitespace-nowrap">
              Reset
            </Link>
          </div>
        </form>
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-display text-base font-semibold tracking-tight">Danh sách xuất</h3>
          <p className="text-sm text-ink-muted48">
            {issueRows.length} dòng · {formatVnd(totalIssueAmount)}
          </p>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Lớp</th>
                <th>Học viên</th>
                <th>Danh mục</th>
                <th>Sách</th>
                <th>Ngày xuất</th>
                <th>SL</th>
                <th>Giá bán</th>
                <th>Thành tiền</th>
                <th>TT</th>
              </tr>
            </thead>
            <tbody>
              {pagedIssueRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.stt}</td>
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
                  <td>{row.quantity}</td>
                  <td>{formatVnd(row.unitPrice)}</td>
                  <td className="font-medium">{formatVnd(row.amount)}</td>
                  <td>
                    <span className={row.paymentStatus === "PAID" ? "badge-green" : "badge-amber"}>{row.paymentStatus === "PAID" ? "Đã TT" : "Chưa TT"}</span>
                  </td>
                </tr>
              ))}
              {issueRows.length === 0 ? (
                <tr className="table-empty">
                  <td colSpan={10}>Không có dòng xuất nào khớp bộ lọc.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {issueRows.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#e6eefc] pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-ink-muted48">
              Trang {issuePage}/{issueTotalPages} · {pagedIssueRows.length}/{issueRows.length} dòng
            </p>
            <div className="pagination">
              <Link href={pageHref(currentParams, { issuePage: String(Math.max(1, issuePage - 1)) })} className={issuePage <= 1 ? "pagination-item pointer-events-none opacity-50" : "pagination-item"}>
                Trước
              </Link>
              <span className="pagination-item-active">{issuePage}</span>
              <Link href={pageHref(currentParams, { issuePage: String(Math.min(issueTotalPages, issuePage + 1)) })} className={issuePage >= issueTotalPages ? "pagination-item pointer-events-none opacity-50" : "pagination-item"}>
                Sau
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
