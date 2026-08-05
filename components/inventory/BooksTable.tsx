"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column, Action, BulkAction } from "@/components/ui/DataTable";
import SlideOver from "@/components/ui/SlideOver";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormGuide from "@/components/ui/FormGuide";
import CategorySelect from "./CategorySelect";
import { canUpdate, canDelete } from "@/lib/server/role-matrix";
import { exportToExcel } from "@/lib/export-utils";

type BookRow = {
  id: string;
  bookCode: string | null;
  category: string | null;
  categoryLabel: string;
  name: string;
  purchasePrice: number;
  unitPrice: number;
  usageStatus: string | null;
  notes: string | null;
  issuedTotal: number;
  onHand: number;
};

const EDIT_BOOK_GUIDE_SECTIONS = [
  {
    title: "Form sửa đầu sách dùng khi nào?",
    items: [
      "Dùng khi cần chỉnh tên, danh mục, giá nhập, giá bán hoặc trạng thái sử dụng của đầu sách đã có.",
      "Đây là chỉnh thông tin nền của đầu sách, không phải thao tác nhập kho hay xuất kho.",
      "Nếu chỉ có phát sinh thêm hàng thì dùng nhập kho; nếu giao cho học viên thì dùng xuất kho.",
    ],
    tone: "info" as const,
  },
  {
    title: "Những gì cần kiểm tra kỹ",
    items: [
      "Đơn giá nhập là giá vốn tham chiếu của đầu sách.",
      "Đơn giá bán là giá thu ra dự kiến khi gắn cho học viên/phụ huynh.",
      "Danh mục và trạng thái sử dụng giúp lọc dữ liệu và nhìn kho rõ ràng hơn.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ gặp",
    items: [
      "Sửa nhầm đơn giá nhập thành đơn giá bán.",
      "Đổi tên sách quá mơ hồ làm người sau khó nhận diện.",
      "Dùng form này để cố sửa tồn kho thay vì đi đúng luồng nhập/xuất.",
    ],
    tone: "warning" as const,
  },
];

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

const CATEGORY_BADGE_COLORS = ["badge-blue", "badge-purple", "badge-pink", "badge-gray"];
function categoryBadgeClass(category: string) {
  if (category === "Sách khác") return "badge-gray";
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) % CATEGORY_BADGE_COLORS.length;
  return CATEGORY_BADGE_COLORS[hash];
}

function EditBookSlideOver({
  book,
  categoryOptions,
  onClose,
  onSaved,
}: {
  book: BookRow;
  categoryOptions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: book.name,
    category: book.category ?? "",
    purchasePrice: String(book.purchasePrice),
    unitPrice: String(book.unitPrice),
    usageStatus: book.usageStatus ?? "",
    notes: book.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không lưu được thông tin sách.");
      return;
    }
    onSaved();
  }

  return (
    <SlideOver
      open
      title="Sửa sách/giáo trình"
      description={book.name}
      onClose={onClose}
      guide={<FormGuide title="Hướng dẫn sửa đầu sách" summary="Đây là form chỉnh thông tin nền của đầu sách trong kho. Chỉ sửa thông tin nhận diện và đơn giá, không dùng để can thiệp tồn kho." sections={EDIT_BOOK_GUIDE_SECTIONS} position="inline" />}
    >
      <form onSubmit={save} className="space-y-4">
        <label className="form-group">
          <span className="label-sm">Tên sách/giáo trình *</span>
          <input required className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label className="form-group">
          <span className="label-sm">Danh mục sách</span>
          <CategorySelect categoryOptions={categoryOptions} value={form.category} onChange={(next) => setForm((current) => ({ ...current, category: next }))} />
        </label>
        <label className="form-group">
          <span className="label-sm">Đơn giá nhập *</span>
          <input required type="number" min="0" className="input" value={form.purchasePrice} onChange={(event) => setForm((current) => ({ ...current, purchasePrice: event.target.value }))} />
          <p className="form-hint">{form.purchasePrice ? formatVnd(Number(form.purchasePrice) || 0) : ""}</p>
        </label>
        <label className="form-group">
          <span className="label-sm">Đơn giá bán *</span>
          <input required type="number" min="0" className="input" value={form.unitPrice} onChange={(event) => setForm((current) => ({ ...current, unitPrice: event.target.value }))} />
          <p className="form-hint">{form.unitPrice ? formatVnd(Number(form.unitPrice) || 0) : ""}</p>
        </label>
        <label className="form-group">
          <span className="label-sm">Tình trạng sử dụng</span>
          <input className="input" placeholder="VD: Còn dùng, Ngừng dùng..." value={form.usageStatus} onChange={(event) => setForm((current) => ({ ...current, usageStatus: event.target.value }))} />
        </label>
        <label className="form-group">
          <span className="label-sm">Ghi chú</span>
          <textarea className="input resize-none" rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Hủy
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}

export default function BooksTable({
  initialData,
  categoryOptions,
  userRole,
  totalOnHand,
  lowStockCount,
  unpaidIssuesCount,
}: {
  initialData: BookRow[];
  categoryOptions: string[];
  userRole: string;
  totalOnHand: number;
  lowStockCount: number;
  unpaidIssuesCount: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingBook, setEditingBook] = useState<BookRow | null>(null);
  const [deletingBook, setDeletingBook] = useState<BookRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function confirmDeleteBook() {
    if (!deletingBook) return;

    setDeleteLoading(true);
    setDeleteError(null);

    const response = await fetch(`/api/books/${deletingBook.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setDeleteLoading(false);

    if (!response.ok) {
      setDeleteError(data.error ?? "Không thể xóa sách.");
      return;
    }

    setDeletingBook(null);
    router.refresh();
  }

  const data = useMemo(() => {
    const term = search.trim().toLowerCase();
    return initialData.filter((book) => {
      if (categoryFilter && book.categoryLabel !== categoryFilter) return false;
      if (!term) return true;
      const haystack = `${book.name} ${book.bookCode ?? ""} ${book.categoryLabel}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [initialData, search, categoryFilter]);

  const pagedData = useMemo(() => data.slice((page - 1) * pageSize, page * pageSize), [data, page, pageSize]);

  const columns: Column<BookRow>[] = [
    {
      key: "categoryLabel",
      label: "Danh mục",
      width: "150px",
      render: (value) => <span className={categoryBadgeClass(value)}>{value}</span>,
    },
    {
      key: "name",
      label: "Sách",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="text-sm font-semibold text-ink">{value}</p>
          {row.bookCode ? <p className="text-xs text-ink-muted48">{row.bookCode}</p> : null}
        </div>
      ),
    },
    {
      key: "purchasePrice",
      label: "Giá nhập",
      sortable: true,
      render: (value) => formatVnd(value),
    },
    {
      key: "unitPrice",
      label: "Giá bán",
      sortable: true,
      render: (value) => formatVnd(value),
    },
    {
      key: "issuedTotal",
      label: "Đã xuất",
      sortable: true,
      align: "center",
    },
    {
      key: "onHand",
      label: "Tồn",
      sortable: true,
      align: "center",
      render: (value) => <span className={value <= 5 ? "badge-amber" : "badge-green"}>{value}</span>,
    },
  ];

  const actions: Action<BookRow>[] = [
    {
      label: "Xem",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      onClick: (row) => router.push(`/inventory/${row.id}`),
      variant: "secondary",
    },
    {
      label: "Sửa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      onClick: (row) => setEditingBook(row),
      variant: "primary",
      show: () => canUpdate("inventory", userRole),
    },
  ];

  if (canDelete("inventory", userRole)) {
    actions.push({
      label: "Xóa",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: async (row) => {
        setDeleteError(null);
        setDeletingBook(row);
      },
      variant: "danger",
    });
  }

  const bulkActions: BulkAction<BookRow>[] = [
    {
      label: "Xuất Excel",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
      onClick: async (rows) =>
        exportToExcel(
          rows.map((row) => ({
            bookCode: row.bookCode ?? "",
            name: row.name,
            category: row.categoryLabel,
            purchasePrice: row.purchasePrice,
            unitPrice: row.unitPrice,
            issuedTotal: row.issuedTotal,
            onHand: row.onHand,
          })),
          [
            { key: "bookCode", label: "Mã sách" },
            { key: "name", label: "Tên sách" },
            { key: "category", label: "Danh mục" },
            { key: "purchasePrice", label: "Giá nhập" },
            { key: "unitPrice", label: "Giá bán" },
            { key: "issuedTotal", label: "Đã xuất" },
            { key: "onHand", label: "Tồn" },
          ],
          "danh-muc-sach",
          "DanhMucSach",
        ),
      variant: "primary",
    },
  ];

  const filterChips = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-ink">Tồn kho {totalOnHand}</span>
      <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-2 text-xs font-semibold text-sky-700">Đầu sách {initialData.length}</span>
      <span className="rounded-full border border-[#fde7d8] bg-[#fff8f2] px-3 py-2 text-xs font-semibold text-amber-700">Tồn thấp {lowStockCount}</span>
      <span className="rounded-full border border-[#ffe0e0] bg-[#fff7f7] px-3 py-2 text-xs font-semibold text-rose-700">Chưa TT {unpaidIssuesCount}</span>
      <select
        value={categoryFilter}
        onChange={(event) => {
          setCategoryFilter(event.target.value);
          setPage(1);
        }}
        className="rounded-full border border-hairline bg-white px-3 py-2 text-xs font-medium text-ink-muted64"
      >
        <option value="">Tất cả danh mục</option>
        {categoryOptions.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <DataTableResponsive
        data={pagedData}
        columns={columns}
        actions={actions}
        bulkActions={bulkActions}
        searchable
        searchPlaceholder="Tìm tên sách, mã sách..."
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filterChips={filterChips}
        showCountBadge={false}
        sortable
        selectable
        rowKey="id"
        pagination={{
          total: data.length,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
        emptyState={{
          title: "Chưa có đầu sách",
          description: "Bắt đầu bằng cách thêm đầu sách/giáo trình đầu tiên.",
        }}
        mobileConfig={{ primaryColumn: "name", secondaryColumns: ["categoryLabel", "onHand"] }}
      />

      {editingBook ? (
        <EditBookSlideOver
          book={editingBook}
          categoryOptions={categoryOptions}
          onClose={() => setEditingBook(null)}
          onSaved={() => {
            setEditingBook(null);
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deletingBook)}
        title="Xác nhận xóa sách?"
        description={
          deleteError
            ? deleteError
            : deletingBook
              ? `Sách "${deletingBook.name}" sẽ bị xóa khỏi danh mục kho. Thao tác này không thể hoàn tác.`
              : undefined
        }
        confirmLabel="Xóa sách"
        cancelLabel="Hủy"
        tone="danger"
        loading={deleteLoading}
        onConfirm={confirmDeleteBook}
        onClose={() => {
          if (!deleteLoading) {
            setDeletingBook(null);
            setDeleteError(null);
          }
        }}
      />
    </>
  );
}
