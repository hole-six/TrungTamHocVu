"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { formatVnd } from "@/lib/export-utils";

type IssueRow = {
  stt: number;
  id: string;
  bookId: string;
  classCode: string;
  className: string;
  studentLabel: string;
  bookName: string;
  bookCategory: string;
  issueDate: Date;
  quantity: number;
  unitPrice: number;
  amount: number;
  paymentStatus: string;
  notes: string;
};

const CATEGORY_BADGE_COLORS = ["badge-blue", "badge-purple", "badge-pink", "badge-gray"];
function categoryBadgeClass(category: string) {
  if (category === "Sách khác") return "badge-gray";
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) % CATEGORY_BADGE_COLORS.length;
  return CATEGORY_BADGE_COLORS[hash];
}

export default function BookIssuesTable({
  initialData,
  total,
  page,
  pageSize,
  bookOptions,
  categoryOptions,
  totalAmount,
}: {
  initialData: IssueRow[];
  total: number;
  page: number;
  pageSize: number;
  bookOptions: { id: string; name: string }[];
  categoryOptions: string[];
  totalAmount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const filterValues = {
    issueClass: searchParams.get("issueClass") ?? "",
    issueStudent: searchParams.get("issueStudent") ?? "",
    issueCategory: searchParams.get("issueCategory") ?? "",
    bookId: searchParams.get("bookId") ?? "",
    issueDateFrom: searchParams.get("issueDateFrom") ?? "",
    issueDateTo: searchParams.get("issueDateTo") ?? "",
    qtyFrom: searchParams.get("qtyFrom") ?? "",
    qtyTo: searchParams.get("qtyTo") ?? "",
    priceFrom: searchParams.get("priceFrom") ?? "",
    priceTo: searchParams.get("priceTo") ?? "",
    amountFrom: searchParams.get("amountFrom") ?? "",
    amountTo: searchParams.get("amountTo") ?? "",
    paymentStatus: searchParams.get("paymentStatus") ?? "",
  };
  const handleFilterChange = (key: string, value: string | null, extra?: Record<string, string | null>) =>
    updateParams({ [key]: value, ...extra, issuePage: "1" });

  const columns: Column<IssueRow>[] = [
    {
      key: "className",
      label: "Lớp",
      filter: { type: "text", paramKey: "issueClass", placeholder: "Tên/mã lớp..." },
    },
    {
      key: "studentLabel",
      label: "Học viên",
      filter: { type: "text", paramKey: "issueStudent", placeholder: "Tên/mã HV..." },
    },
    {
      key: "bookCategory",
      label: "Danh mục",
      filter: {
        type: "select",
        paramKey: "issueCategory",
        placeholder: "Tất cả",
        options: categoryOptions.map((category) => ({ label: category, value: category })),
      },
      render: (value) => <span className={categoryBadgeClass(value)}>{value}</span>,
    },
    {
      key: "bookName",
      label: "Sách",
      filter: {
        type: "select",
        paramKey: "bookId",
        placeholder: "Tất cả",
        options: bookOptions.map((book) => ({ label: book.name, value: book.id })),
      },
      render: (value, row) => (
        <Link href={`/inventory/${row.bookId}`} className="text-primary hover:underline">
          {value}
        </Link>
      ),
    },
    {
      key: "issueDate",
      label: "Ngày xuất",
      filter: { type: "dateRange", paramKeyFrom: "issueDateFrom", paramKeyTo: "issueDateTo" },
      render: (value: Date) => value.toLocaleDateString("vi-VN"),
    },
    {
      key: "quantity",
      label: "SL",
      align: "center",
      filter: { type: "numberRange", paramKeyFrom: "qtyFrom", paramKeyTo: "qtyTo" },
    },
    {
      key: "unitPrice",
      label: "Giá bán",
      align: "right",
      filter: { type: "numberRange", paramKeyFrom: "priceFrom", paramKeyTo: "priceTo", placeholder: "đ" },
      render: (value) => formatVnd(value),
    },
    {
      key: "amount",
      label: "Thành tiền",
      align: "right",
      filter: { type: "numberRange", paramKeyFrom: "amountFrom", paramKeyTo: "amountTo", placeholder: "đ" },
      render: (value) => <span className="font-medium">{formatVnd(value)}</span>,
    },
    {
      key: "paymentStatus",
      label: "TT",
      align: "center",
      filter: {
        type: "select",
        paramKey: "paymentStatus",
        placeholder: "Tất cả",
        options: [
          { label: "Đã TT", value: "PAID" },
          { label: "Chưa TT", value: "UNPAID" },
        ],
      },
      render: (value) => <span className={value === "PAID" ? "badge-green" : "badge-amber"}>{value === "PAID" ? "Đã TT" : "Chưa TT"}</span>,
    },
  ];

  return (
    <DataTableResponsive
      data={initialData}
      columns={columns}
      searchable={false}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      showCountBadge={false}
      rowKey="id"
      loading={isPending}
      pagination={{
        total,
        page,
        pageSize,
        onPageChange: (newPage) => updateParams({ issuePage: String(newPage) }),
        onPageSizeChange: (size) => updateParams({ issuePage: "1", issuePageSize: String(size) }),
      }}
      emptyState={{
        title: "Không có dòng xuất nào",
        description: "Chưa có lượt xuất sách nào khớp bộ lọc hiện tại.",
      }}
      filterChips={
        <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-primary">
          {total} dòng · {formatVnd(totalAmount)}
        </span>
      }
      primaryColumn="bookName"
      secondaryColumns={["className", "studentLabel", "paymentStatus"]}
    />
  );
}
