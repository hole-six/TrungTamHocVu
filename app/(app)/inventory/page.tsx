import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeStockBalance } from "@/lib/server/inventory-rules";
import NewBookForm from "@/components/inventory/NewBookForm";
import BooksTable from "@/components/inventory/BooksTable";
import BookIssuesTable from "@/components/inventory/BookIssuesTable";
import PageGuide from "@/components/ui/PageGuide";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import DetailTabs from "@/components/ui/DetailTabs";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";

const INVENTORY_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="inventory-books"]',
    title: "Danh mục sách — tồn kho tự tính từ lịch sử",
    description: "\"Tồn kho\" không nhập tay: bằng tổng nhập + trả + điều chỉnh, trừ đi tổng đã xuất — đúng theo từng lần nhập/xuất, không phải một con số cố định.",
    placement: "bottom",
  },
  {
    target: '[data-tour="inventory-filter"]',
    title: "Lọc sổ xuất theo lớp, học viên, sách, tháng",
    description: "Dùng bộ lọc \"Thanh toán\" để tìm nhanh các lượt xuất sách chưa thu tiền, cần đối chiếu với công nợ học phí.",
    placement: "bottom",
  },
  {
    target: '[data-tour="inventory-issues"]',
    title: "Sổ xuất giáo trình — ai nhận sách, ngày nào, đã trả tiền chưa",
    description: "Mỗi dòng là một lần xuất sách thực tế cho học viên — bấm vào tên sách để xem lại toàn bộ lịch sử nhập/xuất của đầu sách đó.",
    placement: "top",
  },
];

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

function normalizeCategory(category: string | null) {
  const trimmed = category?.trim();
  return trimmed ? trimmed : "Sách khác";
}

const PAGE_SIZE = 10;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: {
    // Lọc theo từng cột (hàng cố định dưới header) của bảng "Sổ xuất giáo trình".
    bookId?: string;
    paymentStatus?: string;
    issueClass?: string;
    issueStudent?: string;
    issueCategory?: string;
    issueDateFrom?: string;
    issueDateTo?: string;
    qtyFrom?: string;
    qtyTo?: string;
    priceFrom?: string;
    priceTo?: string;
    amountFrom?: string;
    amountTo?: string;
    issuePage?: string;
    issuePageSize?: string;
    // Lọc theo từng cột (hàng cố định dưới header) của bảng "Danh mục sách" —
    // độc lập với các param của sổ xuất giáo trình phía trên.
    bookName?: string;
    bookCategory?: string;
    stockFrom?: string;
    stockTo?: string;
    purchasePriceFrom?: string;
    purchasePriceTo?: string;
    unitPriceFrom?: string;
    unitPriceTo?: string;
    issuedFrom?: string;
    issuedTo?: string;
    page?: string;
    pageSize?: string;
  };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const activeBranchId = await getCurrentBranchId();
  const branchWhere = activeBranchId ? { branchId: activeBranchId } : {};

  const selectedBookId = searchParams?.bookId?.trim() ?? "";
  const selectedPaymentStatus = searchParams?.paymentStatus?.trim() ?? "";
  // Lọc theo từng cột (hàng cố định dưới header) của bảng "Sổ xuất giáo trình".
  const issueClassFilter = searchParams?.issueClass?.trim() ?? "";
  const issueStudentFilter = searchParams?.issueStudent?.trim() ?? "";
  const issueCategoryFilter = searchParams?.issueCategory?.trim() ?? "";
  const issueDateFrom = searchParams?.issueDateFrom?.trim() ?? "";
  const issueDateTo = searchParams?.issueDateTo?.trim() ?? "";
  const qtyFrom = searchParams?.qtyFrom?.trim() ?? "";
  const qtyTo = searchParams?.qtyTo?.trim() ?? "";
  const priceFrom = searchParams?.priceFrom?.trim() ?? "";
  const priceTo = searchParams?.priceTo?.trim() ?? "";
  const amountFrom = searchParams?.amountFrom?.trim() ?? "";
  const amountTo = searchParams?.amountTo?.trim() ?? "";
  const issuePage = Math.max(1, Number(searchParams?.issuePage ?? 1));
  const issuePageSize = Number(searchParams?.issuePageSize ?? PAGE_SIZE);
  // Lọc theo từng cột (hàng cố định dưới header) của bảng "Danh mục sách".
  const bookNameFilter = searchParams?.bookName?.trim() ?? "";
  const bookCategoryFilter = searchParams?.bookCategory?.trim() ?? "";
  const stockFrom = searchParams?.stockFrom?.trim() ?? "";
  const stockTo = searchParams?.stockTo?.trim() ?? "";
  const purchasePriceFrom = searchParams?.purchasePriceFrom?.trim() ?? "";
  const purchasePriceTo = searchParams?.purchasePriceTo?.trim() ?? "";
  const unitPriceFrom = searchParams?.unitPriceFrom?.trim() ?? "";
  const unitPriceTo = searchParams?.unitPriceTo?.trim() ?? "";
  const issuedFrom = searchParams?.issuedFrom?.trim() ?? "";
  const issuedTo = searchParams?.issuedTo?.trim() ?? "";
  const bookPage = Math.max(1, Number(searchParams?.page ?? 1));
  const bookPageSize = Number(searchParams?.pageSize ?? PAGE_SIZE);

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

  // Lọc bảng "Danh mục sách" theo từng cột (hàng cố định dưới header) — tên/mã sách và
  // danh mục là field thật trên Book, nhưng "Tồn" (onHand) là số TÍNH ĐỘNG từ
  // computeStockBalance (không phải cột thô), giống outstanding của trang Học viên:
  // đã phải tính đủ cho toàn bộ danh sách (stockRows ở trên) để dựng categoryOptions +
  // dropdown "Sách" của sổ xuất bên dưới, nên lọc tên/danh mục/tồn kho luôn trên chính
  // tập đã tính đó (không query Prisma riêng lần 2, tránh tính lại computeStockBalance)
  // rồi mới cắt trang — vẫn là lọc backend đúng nghĩa, dữ liệu chưa lọc không gửi ra browser.
  let filteredBookRows = stockRows;
  if (bookNameFilter) {
    const term = bookNameFilter.toLowerCase();
    filteredBookRows = filteredBookRows.filter(
      (book) => book.name.toLowerCase().includes(term) || (book.bookCode ?? "").toLowerCase().includes(term),
    );
  }
  if (bookCategoryFilter) {
    filteredBookRows = filteredBookRows.filter((book) => book.categoryLabel === bookCategoryFilter);
  }
  if (stockFrom) {
    filteredBookRows = filteredBookRows.filter((book) => book.onHand >= Number(stockFrom));
  }
  if (stockTo) {
    filteredBookRows = filteredBookRows.filter((book) => book.onHand <= Number(stockTo));
  }
  if (purchasePriceFrom) {
    filteredBookRows = filteredBookRows.filter((book) => book.purchasePrice >= Number(purchasePriceFrom));
  }
  if (purchasePriceTo) {
    filteredBookRows = filteredBookRows.filter((book) => book.purchasePrice <= Number(purchasePriceTo));
  }
  if (unitPriceFrom) {
    filteredBookRows = filteredBookRows.filter((book) => book.unitPrice >= Number(unitPriceFrom));
  }
  if (unitPriceTo) {
    filteredBookRows = filteredBookRows.filter((book) => book.unitPrice <= Number(unitPriceTo));
  }
  if (issuedFrom) {
    filteredBookRows = filteredBookRows.filter((book) => book.issuedTotal >= Number(issuedFrom));
  }
  if (issuedTo) {
    filteredBookRows = filteredBookRows.filter((book) => book.issuedTotal <= Number(issuedTo));
  }
  const bookTotal = filteredBookRows.length;
  const pagedBookRows = filteredBookRows.slice((bookPage - 1) * bookPageSize, (bookPage - 1) * bookPageSize + bookPageSize);

  const issueWhere = {
    ...(activeBranchId ? { book: { branchId: activeBranchId } } : {}),
    ...(selectedBookId ? { bookId: selectedBookId } : {}),
    ...(selectedPaymentStatus ? { paymentStatus: selectedPaymentStatus } : {}),
    ...(issueCategoryFilter ? { book: { ...(activeBranchId ? { branchId: activeBranchId } : {}), category: issueCategoryFilter === "Sách khác" ? null : issueCategoryFilter } } : {}),
    ...(issueClassFilter
      ? { class: { OR: [{ classCode: { contains: issueClassFilter } }, { className: { contains: issueClassFilter } }] } }
      : {}),
    ...(issueStudentFilter
      ? { student: { OR: [{ fullName: { contains: issueStudentFilter } }, { studentCode: { contains: issueStudentFilter } }] } }
      : {}),
    ...(issueDateFrom || issueDateTo
      ? {
          issueDate: {
            ...(issueDateFrom ? { gte: new Date(`${issueDateFrom}T00:00:00.000Z`) } : {}),
            ...(issueDateTo ? { lte: new Date(`${issueDateTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(qtyFrom || qtyTo
      ? { quantity: { ...(qtyFrom ? { gte: Number(qtyFrom) } : {}), ...(qtyTo ? { lte: Number(qtyTo) } : {}) } }
      : {}),
    ...(priceFrom || priceTo
      ? { unitPrice: { ...(priceFrom ? { gte: Number(priceFrom) } : {}), ...(priceTo ? { lte: Number(priceTo) } : {}) } }
      : {}),
    ...(amountFrom || amountTo
      ? { amount: { ...(amountFrom ? { gte: Number(amountFrom) } : {}), ...(amountTo ? { lte: Number(amountTo) } : {}) } }
      : {}),
  };

  const bookIssues = await prisma.bookIssue.findMany({
    where: issueWhere,
    include: {
      book: true,
      class: true,
      student: true,
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
      quantity: issue.quantity,
      unitPrice: issue.unitPrice,
      amount: issue.amount,
      paymentStatus: issue.paymentStatus,
      notes: issue.notes ?? "",
    }));

  const issueTotal = issueRows.length;
  const pagedIssueRows = issueRows.slice((issuePage - 1) * issuePageSize, (issuePage - 1) * issuePageSize + issuePageSize);

  const totalOnHand = stockRows.reduce((sum, row) => sum + row.onHand, 0);
  const lowStock = stockRows.filter((row) => row.onHand <= 5).length;
  const totalIssueAmount = issueRows.reduce((sum, row) => sum + row.amount, 0);
  const unpaidIssues = issueRows.filter((row) => row.paymentStatus !== "PAID").length;
  const bookOptions = stockRows.map((book) => ({ id: book.id, name: book.name }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageGuide
        title="Guide vận hành kho giáo trình"
        summary="Đây là màn quản lý đầu sách, tồn kho và lịch sử xuất sách. Người mới chỉ cần phân biệt rõ ba việc: thêm đầu sách, nhập kho và xuất cho học viên."
        sections={INVENTORY_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide kho sách"
      />
      <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="page-title text-xl sm:text-2xl md:text-3xl">Tài liệu</h1>
          <p className="page-subtitle text-xs sm:text-sm">
            <span className="hidden sm:inline">Tra cứu tồn kho, xuất sách và tình trạng thu tiền</span>
            <span className="sm:hidden">Tồn kho, xuất sách và thu tiền</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <SpotlightTour steps={INVENTORY_TOUR_STEPS} />
          {canCreate("inventory", role) ? <NewBookForm categoryOptions={categoryOptions} /> : null}
        </div>
      </div>

      <DetailTabs
        defaultTabKey="books"
        tabs={[
          {
            key: "books",
            label: "Danh mục sách",
            content: (
              <div className="space-y-3 sm:space-y-4" data-tour="inventory-books">
                <div className="flex justify-end">
                  <Link href="/classes" className="btn-ghost text-xs sm:text-sm px-3 sm:px-4 py-2">
                    <span className="sm:hidden">Khóa</span>
                    <span className="hidden sm:inline">Khóa học</span>
                  </Link>
                </div>
                <BooksTable
                  initialData={pagedBookRows}
                  total={bookTotal}
                  page={bookPage}
                  pageSize={bookPageSize}
                  categoryOptions={categoryOptions}
                  userRole={role || "TEACHER"}
                  totalOnHand={totalOnHand}
                  lowStockCount={lowStock}
                  unpaidIssuesCount={unpaidIssues}
                />
              </div>
            ),
          },
          {
            key: "issues",
            label: "Sổ xuất giáo trình",
            content: (
              <div data-tour="inventory-filter">
                <div data-tour="inventory-issues">
                  <BookIssuesTable
                    initialData={pagedIssueRows}
                    total={issueTotal}
                    page={issuePage}
                    pageSize={issuePageSize}
                    bookOptions={bookOptions}
                    categoryOptions={categoryOptions}
                    totalAmount={totalIssueAmount}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
