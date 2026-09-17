"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column } from "@/components/ui/DataTable/DataTable";
import EditCashTransactionDrawer from "@/components/cashbook/EditCashTransactionDrawer";
import { formatVnd, formatDate } from "@/lib/export-utils";
import { Pencil } from "lucide-react";

type Category = { id: string; type: string; name: string };

type CashRow = {
  id: string;
  txnDate: string;
  type: "THU" | "CHI";
  amount: number;
  thuAmount: number | null;
  chiAmount: number | null;
  description: string | null;
  detail: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  /** Lớp của khoản thu học phí — suy ra từ phiếu thu, xem app/(app)/cashbook/page.tsx. */
  className?: string | null;
  studentCode?: string | null;
  studentName?: string | null;
  handledByName: string | null;
  /** Bóc tách số tiền của phiếu thu: học phí / giáo trình / đóng trước. */
  breakdown?: { tuition: number; materials: number; advance: number; books: string[]; periods: string[] } | null;
  isDerived: boolean;
};

export default function CashbookTable({
  transactions,
  categories,
  canManageCashbook,
  currentPage,
  totalCount,
  itemsPerPage,
  fromDate,
  toDate,
}: {
  transactions: CashRow[];
  categories: Category[];
  canManageCashbook: boolean;
  currentPage: number;
  totalCount: number;
  itemsPerPage: number;
  // Khoảng ngày MẶC ĐỊNH đã tính sẵn ở page.tsx (đầu tháng → hôm nay khi URL chưa có
  // fromDate/toDate) — dùng để hiện đúng giá trị đang lọc thật sự trong ô lọc cột,
  // thay vì hiện trống dù dữ liệu vẫn đang bị giới hạn theo khoảng mặc định đó.
  fromDate: string;
  toDate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Lọc theo TỪNG CỘT (hàng cố định dưới header) — patch qua URL searchParams, tái
  // dùng cho cả pagination lẫn các ô lọc cột thay vì mỗi nơi tự dựng URL riêng (dễ
  // làm rơi mất filter/trang đang xem của nhau).
  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const categoryOptions = categories.map((category) => ({ label: category.name, value: category.id }));

  const columns: Column<CashRow>[] = [
    {
      key: "txnDate",
      label: "Ngày",
      filter: { type: "dateRange", paramKeyFrom: "fromDate", paramKeyTo: "toDate" },
      render: (value) => formatDate(value),
    },
    {
      key: "type",
      label: "Loại phiếu",
      filter: {
        type: "select",
        paramKey: "type",
        placeholder: "Tất cả",
        options: [
          { label: "Thu", value: "THU" },
          { label: "Chi", value: "CHI" },
        ],
      },
      render: (value) => <span className={value === "THU" ? "badge-green" : "badge-red"}>{value === "THU" ? "Thu" : "Chi"}</span>,
    },
    {
      key: "categoryName",
      label: "Danh mục",
      filter: { type: "select", paramKey: "categoryId", placeholder: "Tất cả danh mục", options: categoryOptions },
      render: (value) => value ?? "Chưa phân loại",
    },
    {
      // MÃ + TÊN HỌC SINH: soát sổ quỹ hay phải tra "khoản này của em nào" — gõ mã hoặc
      // tên vào 1 trong 2 ô lọc đều ra (cùng một bộ lọc ở server).
      key: "studentCode",
      label: "Mã học sinh",
      filter: { type: "text", paramKey: "student", placeholder: "Mã/tên HV..." },
      render: (value) =>
        value ? <span className="font-mono text-xs font-bold text-[#f97316]">{value}</span> : <span className="text-xs text-ink-muted48">—</span>,
    },
    {
      key: "studentName",
      label: "Tên học sinh",
      filter: { type: "text", paramKey: "student", placeholder: "Mã/tên HV..." },
      render: (value) => (value ? <span className="font-medium text-ink">{value}</span> : <span className="text-xs text-ink-muted48">—</span>),
    },
    {
      key: "description",
      label: "Nội dung thu chi",
      filter: { type: "text", paramKey: "search", placeholder: "Tìm nội dung..." },
      render: (value, row) => (
        <div className="space-y-1">
          <p className="font-medium text-ink">{value ?? "Chưa có diễn giải"}</p>
          {/* Lớp chỉ có ở khoản thu học phí — khoản chi và thu khác thì không có, nên
              chỉ hiện khi thật sự suy ra được, tránh dòng trống vô nghĩa. */}
          {row.className ? (
            <p className="text-xs font-semibold text-[#2563eb]">Lớp: {row.className}</p>
          ) : null}
          {/* Bóc tách nhanh ngay trên dòng: 850.000đ gồm học phí bao nhiêu, sách bao nhiêu. */}
          {row.breakdown && (row.breakdown.tuition > 0 || row.breakdown.materials > 0 || row.breakdown.advance > 0) ? (
            <div className="flex flex-wrap items-center gap-1">
              {row.breakdown.tuition > 0 ? (
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">Học phí {formatVnd(row.breakdown.tuition)}</span>
              ) : null}
              {row.breakdown.materials > 0 ? (
                <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-bold text-violet-700">Sách {formatVnd(row.breakdown.materials)}</span>
              ) : null}
              {row.breakdown.advance > 0 ? (
                <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700">Đóng trước {formatVnd(row.breakdown.advance)}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "thuAmount",
      label: "Thu vào",
      align: "right",
      filter: { type: "numberRange", paramKeyFrom: "amountFrom", paramKeyTo: "amountTo", placeholder: "đ" },
      render: (value) => (value ? <span className="font-semibold text-emerald-600">{formatVnd(value)}</span> : "—"),
    },
    { key: "chiAmount", label: "Chi ra", align: "right", render: (value) => (value ? <span className="font-semibold text-rose-600">{formatVnd(value)}</span> : "—") },
    {
      // NGƯỜI THU / NGƯỜI THỰC HIỆN — mỗi nhân sự một tài khoản nên truy được ngay ai
      // đã thu khoản này (trước đây chỉ nằm chìm trong cột nội dung, không lọc được).
      key: "handledByName",
      label: "Người thu",
      filter: { type: "text", paramKey: "handler", placeholder: "Tên người thu..." },
      render: (value) => (value ? <span className="text-xs font-semibold text-ink-muted80">{value}</span> : <span className="text-xs text-ink-muted48">Chưa rõ</span>),
    },
    {
      key: "status",
      label: "Trạng thái",
      filter: {
        type: "select",
        paramKey: "status",
        placeholder: "Tất cả",
        options: [
          { label: "Nháp", value: "DRAFT" },
          { label: "Đã xác nhận", value: "CONFIRMED" },
          { label: "Đã hủy", value: "VOIDED" },
        ],
      },
      render: (value, row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge-gray">{value === "CONFIRMED" ? "Đã xác nhận" : value === "VOIDED" ? "Đã hủy" : "Nháp"}</span>
          {row.isDerived ? <span className="badge-purple">Tự động</span> : null}
        </div>
      ),
    },
    {
      key: "id",
      label: "",
      align: "right",
      render: (_, row) => (
        <EditCashTransactionDrawer
          transaction={row}
          categories={categories}
          canManage={canManageCashbook}
          trigger={
            <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-[#eef2ff] transition-colors">
              <Pencil className="h-3.5 w-3.5" />
              Xem
            </button>
          }
        />
      ),
    },
  ];

  const filterValues = {
    fromDate: searchParams.get("fromDate") ?? fromDate,
    toDate: searchParams.get("toDate") ?? toDate,
    type: searchParams.get("type") ?? "",
    categoryId: searchParams.get("categoryId") ?? "",
    search: searchParams.get("search") ?? "",
    amountFrom: searchParams.get("amountFrom") ?? "",
    amountTo: searchParams.get("amountTo") ?? "",
    status: searchParams.get("status") ?? "",
    student: searchParams.get("student") ?? "",
    handler: searchParams.get("handler") ?? "",
  };
  const handleFilterChange = (key: string, value: string | null, extra?: Record<string, string | null>) =>
    updateParams({ [key]: value, ...extra, page: "1" });

  // Chip filter đang áp dụng, mỗi chip có nút "×" tắt riêng — chỉ hiện khi URL có filter
  // THẬT SỰ do người dùng đặt (không tính fromDate/toDate mặc định do page.tsx tự tính
  // khi URL trống, bấm "×" trên chip mặc định đó sẽ không thấy đổi gì vì lại quay về
  // đúng mặc định cũ, gây khó hiểu).
  const urlFromDate = searchParams.get("fromDate");
  const urlToDate = searchParams.get("toDate");
  const urlType = searchParams.get("type");
  const urlCategoryId = searchParams.get("categoryId");
  const urlSearch = searchParams.get("search");
  const urlAmountFrom = searchParams.get("amountFrom");
  const urlAmountTo = searchParams.get("amountTo");
  const urlStatus = searchParams.get("status");
  const categoryName = categories.find((c) => c.id === urlCategoryId)?.name;
  const STATUS_LABEL: Record<string, string> = { DRAFT: "Nháp", CONFIRMED: "Đã xác nhận", VOIDED: "Đã hủy" };

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (urlFromDate || urlToDate) {
    chips.push({
      key: "date",
      label: `${urlFromDate ? formatDate(urlFromDate) : "…"} → ${urlToDate ? formatDate(urlToDate) : "…"}`,
      onRemove: () => handleFilterChange("fromDate", null, { toDate: null }),
    });
  }
  if (urlType) {
    chips.push({ key: "type", label: urlType === "THU" ? "Thu" : "Chi", onRemove: () => handleFilterChange("type", null) });
  }
  if (urlCategoryId) {
    chips.push({ key: "categoryId", label: categoryName ?? "Danh mục", onRemove: () => handleFilterChange("categoryId", null) });
  }
  if (urlSearch) {
    chips.push({ key: "search", label: `"${urlSearch}"`, onRemove: () => handleFilterChange("search", null) });
  }
  const urlStudent = searchParams.get("student");
  const urlHandler = searchParams.get("handler");
  if (urlStudent) {
    chips.push({ key: "student", label: `Học viên: ${urlStudent}`, onRemove: () => handleFilterChange("student", null) });
  }
  if (urlHandler) {
    chips.push({ key: "handler", label: `Người thu: ${urlHandler}`, onRemove: () => handleFilterChange("handler", null) });
  }
  if (urlStatus) {
    chips.push({ key: "status", label: STATUS_LABEL[urlStatus] ?? urlStatus, onRemove: () => handleFilterChange("status", null) });
  }
  if (urlAmountFrom || urlAmountTo) {
    chips.push({
      key: "amount",
      label: `${urlAmountFrom ? formatVnd(Number(urlAmountFrom)) : "0"} - ${urlAmountTo ? formatVnd(Number(urlAmountTo)) : "∞"}`,
      onRemove: () => handleFilterChange("amountFrom", null, { amountTo: null }),
    });
  }

  return (
    <DataTableResponsive
      data={transactions}
      columns={columns}
      rowKey="id"
      searchable={false}
      selectable={false}
      showCountBadge={false}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      filterChips={
        chips.length > 0 ? (
          <>
            {chips.map((chip) => (
              <span key={chip.key} className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#4338ca]">
                {chip.label}
                <button type="button" onClick={chip.onRemove} className="text-[#4338ca] hover:text-[#312e81]" aria-label={`Bỏ lọc ${chip.label}`}>
                  ×
                </button>
              </span>
            ))}
          </>
        ) : undefined
      }
      primaryColumn="description"
      secondaryColumns={["txnDate", "type", "studentName", "thuAmount", "chiAmount", "handledByName", "status"]}
      emptyState={{ title: "Chưa có phiếu thu/chi nào", description: "Không có phiếu nào trong khoảng ngày đang xem." }}
      loading={isPending}
      pagination={{
        total: totalCount,
        page: currentPage,
        pageSize: itemsPerPage,
        onPageChange: (page) => updateParams({ page: String(page) }),
        onPageSizeChange: () => {},
      }}
    />
  );
}
