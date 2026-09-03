import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate, canUpdate, canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import CashbookExportButton from "@/components/cashbook/CashbookExportButton";
import NewCashTransactionForm from "@/components/cashbook/NewCashTransactionForm";
import CategoryManager from "@/components/cashbook/CategoryManager";
import CashbookTable from "@/components/cashbook/CashbookTable";
import PageGuide from "@/components/ui/PageGuide";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import { formatVnd } from "@/lib/export-utils";

const CASHBOOK_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="cashbook-header"]',
    title: "Sổ quỹ — dòng tiền thực tế của cơ sở",
    description: "Mặc định xem từ đầu tháng hiện tại đến hôm nay — đổi khoảng ngày ở bộ lọc bên dưới để xem kỳ khác.",
    placement: "bottom",
  },
  {
    target: '[data-tour="cashbook-kpi"]',
    title: "Tổng thu, Tổng chi, Số dư",
    description: "Giao dịch đã hủy (VOIDED) không được cộng vào 3 số này, dù vẫn còn hiển thị trong bảng bên dưới để giữ dấu vết.",
    placement: "right",
  },
  {
    target: '[data-tour="cashbook-table"]',
    title: "Lọc ngay trên bảng — nhãn \"Tự động\" là phiếu sinh từ nghiệp vụ khác",
    description: "Hàng lọc cố định dưới tiêu đề cột lọc theo ngày, loại thu/chi, danh mục, nội dung và số tiền — luôn chọn đúng khoảng ngày trước khi xuất báo cáo. Phiếu thu học phí, hoàn tiền hoặc nhập kho tự sinh phiếu thu/chi ở đây (nhãn \"Tự động\") và chỉ sửa được từ đúng nghiệp vụ gốc, không sửa trực tiếp tại Sổ quỹ.",
    placement: "top",
  },
];

const CASHBOOK_PAGE_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu trang này",
    items: [
      "Theo dõi toàn bộ dòng tiền thu vào, chi ra và số dư thực tế của cơ sở.",
      "Đối soát giao dịch theo ngày, loại thu chi, danh mục và người xử lý.",
      "Xuất báo cáo đúng khoảng ngày để phục vụ kế toán hoặc quản lý nội bộ.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác nhanh",
    items: [
      "Chọn đúng khoảng ngày trước, sau đó mới lọc tiếp theo loại và danh mục.",
      "Dùng tạo giao dịch mới cho các khoản thu chi thủ công không sinh từ nghiệp vụ khác.",
      "Kiểm tra ngay phần tổng thu, tổng chi và số dư để biết bức tranh dòng tiền hiện tại.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Một số giao dịch sinh tự động từ học phí, hoàn tiền hoặc nhập kho sẽ không sửa trực tiếp tại đây.",
      "Nếu số liệu lệch, hãy kiểm tra lại ngày giao dịch, trạng thái và danh mục đã chọn.",
      "Luôn lọc đúng ngày thật trước khi export để báo cáo khớp với kỳ cần đối chiếu.",
    ],
    tone: "warning" as const,
  },
];

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function CashbookPage({
  searchParams,
}: {
  searchParams?: {
    fromDate?: string;
    toDate?: string;
    type?: string;
    search?: string;
    categoryId?: string;
    amountFrom?: string;
    amountTo?: string;
    status?: string;
    page?: string;
  };
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
  // amount là field thô (Int) trên CashTransaction — lọc trực tiếp bằng gte/lte,
  // không cần kỹ thuật computed-filter (tính hết rồi lọc JS) như outstanding bên
  // Students.
  const amountFromFilter = searchParams?.amountFrom?.trim() ?? "";
  const amountToFilter = searchParams?.amountTo?.trim() ?? "";
  const statusFilter = searchParams?.status?.trim() ?? "";
  const currentPage = Number(searchParams?.page) || 1;
  const itemsPerPage = 20;

  const where: Record<string, unknown> = {
    txnDate: { gte: rangeStart, lte: rangeEnd },
  };
  if (activeBranchId) where.branchId = activeBranchId;
  if (typeFilter) where.type = typeFilter;
  if (categoryIdFilter) where.categoryId = categoryIdFilter;
  if (statusFilter) where.status = statusFilter;
  if (searchQuery) {
    where.OR = [
      { description: { contains: searchQuery, mode: "insensitive" } },
      { detail: { contains: searchQuery, mode: "insensitive" } },
      { notes: { contains: searchQuery, mode: "insensitive" } },
    ];
  }
  if (amountFromFilter || amountToFilter) {
    where.amount = {
      ...(amountFromFilter ? { gte: Number(amountFromFilter) } : {}),
      ...(amountToFilter ? { lte: Number(amountToFilter) } : {}),
    };
  }

  const [totalCount, transactions, categories, transactionsForTotals] = await Promise.all([
    prisma.cashTransaction.count({ where }),
    prisma.cashTransaction.findMany({
      where,
      orderBy: { txnDate: "desc" },
      include: { category: true },
      skip: (currentPage - 1) * itemsPerPage,
      take: itemsPerPage,
    }),
    prisma.transactionCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
    // Tổng thu/chi và số dư phải tính trên TOÀN BỘ khoảng ngày đã lọc, không chỉ
    // trang hiện tại — dùng truy vấn riêng không phân trang cho việc này.
    prisma.cashTransaction.findMany({
      where,
      select: { type: true, amount: true, status: true, category: { select: { name: true } } },
    }),
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

  const totalThu = transactionsForTotals.filter((item) => item.type === "THU" && item.status !== "VOIDED").reduce((sum, item) => sum + item.amount, 0);
  const totalChi = transactionsForTotals.filter((item) => item.type === "CHI" && item.status !== "VOIDED").reduce((sum, item) => sum + item.amount, 0);
  const balance = totalThu - totalChi;

  const byCategory = Object.values(
    transactionsForTotals.reduce((accumulator, transaction) => {
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
    thuAmount: transaction.type === "THU" ? transaction.amount : null,
    chiAmount: transaction.type === "CHI" ? transaction.amount : null,
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

  return (
    <div className="space-y-6">
      <PageGuide
        title="Guide sổ quỹ"
        summary="Cách đọc số dư, lọc giao dịch và đối soát thu chi một cách dễ hiểu."
        sections={CASHBOOK_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide sổ quỹ"
      />
      <div className="flex flex-col gap-4 rounded-[28px] border border-hairline bg-white px-5 py-4 shadow-[0_18px_45px_rgba(15,23,41,0.06)] xl:flex-row xl:items-start xl:justify-between" data-tour="cashbook-header">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">Sổ quỹ</h1>
            {/* 3 tag KPI — trước đây là khối riêng to (px-4 py-4, số text-2xl) chiếm hẳn
                1 hàng dưới tiêu đề, giờ thu nhỏ thành badge đặt ngay cạnh tiêu đề. */}
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700" data-tour="cashbook-kpi">
              Thu {formatVnd(totalThu)}
            </span>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Chi {formatVnd(totalChi)}</span>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Dư {formatVnd(balance)}</span>
          </div>
          <p className="page-subtitle">Thu vào, chi ra và số dư thực tế của cơ sở.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SpotlightTour steps={CASHBOOK_TOUR_STEPS} />
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

      {canManageCashbook ? <CategoryManager categories={categories} amountByCategory={amountByCategory} /> : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Giao dịch thu chi</h2>
            <p className="mt-1 text-sm text-ink-muted48">Bảng chính để đối chiếu từng dòng tiền.</p>
          </div>
          <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1 text-xs font-semibold text-primary">
            {totalCount} giao dịch
          </span>
        </div>

        <div data-tour="cashbook-table">
          <CashbookTable
            transactions={normalizedTransactions}
            categories={categories}
            canManageCashbook={canManageCashbook}
            currentPage={currentPage}
            totalCount={totalCount}
            itemsPerPage={itemsPerPage}
            fromDate={fromDateStr}
            toDate={toDateStr}
          />
        </div>
      </div>
    </div>
  );
}
