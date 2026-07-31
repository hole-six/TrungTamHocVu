"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import DatePicker from "@/components/ui/DatePicker";

type ChargeSummary = {
  id: string;
  periodName: string;
  className: string;
  tuitionAmount: number;
  materialsAmount: number;
  openingBalance: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
};

type BookIssueSummary = {
  id: string;
  bookId: string;
  bookName: string;
  quantity: number;
  amount: number;
  issueDate: string;
  paymentStatus: string;
  className?: string | null;
  notes?: string | null;
};

type PaymentSummary = {
  id: string;
  paymentNo: string;
  amount: number;
  paidDate: string;
  method?: string | null;
  notes?: string | null;
  discountAmount?: number;
  discountReason?: string | null;
};

type StudentFinanceDeskProps = {
  studentId: string;
  studentName: string;
  studentCode: string;
  outstanding: number;
  nextDueCharge?: ChargeSummary | null;
  charges: ChargeSummary[];
  bookIssues: BookIssueSummary[];
  recentPayments: PaymentSummary[];
  canManageFinance: boolean;
  canManageInventory: boolean;
};

type BookOption = {
  id: string;
  bookCode?: string | null;
  name: string;
  category?: string | null;
  unitPrice: number;
  quantityOnHand?: number;
};

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function bookPaymentLabel(status: string) {
  if (status === "PAID") return "Đã thu";
  if (status === "PARTIAL") return "Thu một phần";
  return "Chưa thu";
}

function bookPaymentTone(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function stockTone(quantityOnHand: number) {
  if (quantityOnHand <= 0) return "bg-rose-100 text-rose-700";
  if (quantityOnHand <= 5) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

export default function StudentFinanceDesk({
  studentId,
  studentName,
  studentCode,
  outstanding,
  nextDueCharge,
  charges,
  bookIssues,
  recentPayments,
  canManageFinance,
  canManageInventory,
}: StudentFinanceDeskProps) {
  const router = useRouter();
  const [books, setBooks] = useState<BookOption[]>([]);
  const [booksLoaded, setBooksLoaded] = useState(false);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [issueNotes, setIssueNotes] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueNotice, setIssueNotice] = useState<string | null>(null);
  const [updatingBookIssueId, setUpdatingBookIssueId] = useState<string | null>(null);
  const [bookStatusError, setBookStatusError] = useState<string | null>(null);

  const unpaidBooks = useMemo(
    () => bookIssues.filter((issue) => issue.paymentStatus !== "PAID"),
    [bookIssues],
  );
  const unpaidBookAmount = unpaidBooks.reduce((sum, issue) => sum + issue.amount, 0);

  const bookCategories = useMemo(() => {
    const values = new Set<string>();
    books.forEach((book) => values.add(book.category?.trim() || "Sách khác"));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "vi"));
  }, [books]);

  const filteredBooks = useMemo(() => {
    const normalizedSearch = bookSearch.trim().toLowerCase();
    return books.filter((book) => {
      const category = book.category?.trim() || "Sách khác";
      const matchesCategory = !selectedCategory || category === selectedCategory;
      const matchesSearch =
        !normalizedSearch ||
        book.name.toLowerCase().includes(normalizedSearch) ||
        category.toLowerCase().includes(normalizedSearch) ||
        (book.bookCode ?? "").toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [bookSearch, books, selectedCategory]);

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId],
  );

  async function ensureBooksLoaded() {
    if (booksLoaded) return;
    const response = await fetch("/api/books");
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setBooks(Array.isArray(data.items) ? data.items : []);
      setBooksLoaded(true);
    }
  }

  async function openBookPicker() {
    await ensureBooksLoaded();
    setBookPickerOpen(true);
  }

  async function handleIssueBook(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedBookId) {
      setIssueError("Bạn cần chọn đầu sách trước khi lưu.");
      return;
    }

    setIssuing(true);
    setIssueError(null);
    setIssueNotice(null);

    const response = await fetch(`/api/books/${selectedBookId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        quantity: Number(quantity),
        issueDate,
        notes: issueNotes,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setIssuing(false);

    if (!response.ok) {
      setIssueError(data.error ?? "Không thể thêm phát sinh sách.");
      return;
    }

    const notices = [data.warning, data.classWarning, data.chargeUpdated ? "Đã cộng tiền sách vào công nợ hiện tại." : null]
      .filter(Boolean)
      .join(" ");
    setIssueNotice(notices || "Đã thêm dòng phát sinh sách.");
    setSelectedBookId("");
    setSelectedCategory("");
    setBookSearch("");
    setQuantity("1");
    setIssueNotes("");
    router.refresh();
  }

  async function updateBookPaymentStatus(issueId: string, paymentStatus: string) {
    setUpdatingBookIssueId(issueId);
    setBookStatusError(null);

    const response = await fetch(`/api/book-issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus }),
    });
    const data = await response.json().catch(() => ({}));
    setUpdatingBookIssueId(null);

    if (!response.ok) {
      setBookStatusError(data.error ?? "Không thể cập nhật tình trạng tiền của giáo trình.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted48">Bảng chốt tiền & sách</p>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-ink">Cần thu gì, đã thu gì, phát sinh sách gì</h2>
          <p className="mt-2 text-sm text-ink-muted48">
            Học viên {studentName} · {studentCode}. Khu này ưu tiên cho thu ngân và vận hành chốt việc nhanh, timeline bên dưới chỉ để tra lịch sử.
          </p>
        </div>
        {canManageFinance ? <QuickPaymentButton studentId={studentId} suggestedAmount={outstanding} /> : null}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Tổng còn phải thu</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-rose-800">{formatVnd(outstanding)}</p>
              <p className="mt-1 text-xs text-rose-700">{outstanding > 0 ? "Cần chốt với phụ huynh" : "Hiện không còn công nợ"}</p>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Sách chưa chốt tiền</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-amber-800">{formatVnd(unpaidBookAmount)}</p>
              <p className="mt-1 text-xs text-amber-700">{unpaidBooks.length} dòng giáo trình đang chờ xử lý</p>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Đã thu gần nhất</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-emerald-800">
                {recentPayments[0] ? formatVnd(recentPayments[0].amount) : "0đ"}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {recentPayments[0] ? `${recentPayments[0].method ?? "Chưa ghi rõ"} · ${formatDate(recentPayments[0].paidDate)}` : "Chưa có phiếu thu"}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-hairline bg-canvas-parchment/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Khoản cần đóng ngay</p>
                <p className="mt-1 text-xs text-ink-muted48">Khoản này là dòng nợ gần nhất còn thiếu tiền để bạn nhắc phụ huynh và thu đúng trọng tâm.</p>
              </div>
              {nextDueCharge ? <span className="badge bg-amber-100 text-amber-700">Còn {formatVnd(nextDueCharge.remainingAmount)}</span> : null}
            </div>

            {nextDueCharge ? (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/60 bg-white/80 p-3">
                  <p className="text-xs text-ink-muted48">Kỳ / lớp</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{nextDueCharge.periodName}</p>
                  <p className="text-xs text-ink-muted48">{nextDueCharge.className}</p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/80 p-3">
                  <p className="text-xs text-ink-muted48">Học phí</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{formatVnd(nextDueCharge.tuitionAmount)}</p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/80 p-3">
                  <p className="text-xs text-ink-muted48">Giáo trình + tồn đầu</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{formatVnd(nextDueCharge.materialsAmount + nextDueCharge.openingBalance)}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">Còn phải đóng</p>
                  <p className="mt-1 text-base font-semibold text-amber-800">{formatVnd(nextDueCharge.remainingAmount)}</p>
                  <p className="text-xs text-amber-700">Đã thu {formatVnd(nextDueCharge.paidAmount)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-emerald-700">Hiện không còn kỳ nào đang nợ.</p>
            )}
          </div>

          <div className="rounded-3xl border border-hairline p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Dòng sách phát sinh</p>
                <p className="mt-1 text-xs text-ink-muted48">Chọn danh mục trước, tìm đúng đầu sách sau, nhìn tồn kho ngay tại chỗ rồi mới lưu phát sinh cho học viên.</p>
              </div>
            </div>

            {canManageInventory ? (
              <form onSubmit={handleIssueBook} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.4fr)_120px_180px]">
                  <div className="space-y-2">
                    <span className="label-sm">Đầu sách</span>
                    <button
                      type="button"
                      onClick={() => {
                        void openBookPicker();
                      }}
                      className="flex min-h-[52px] w-full items-center justify-between rounded-[18px] border border-[#cfe0fb] bg-white px-4 py-3 text-left transition hover:border-primary/40 hover:bg-canvas"
                    >
                      <div>
                        {selectedBook ? (
                          <>
                            <p className="text-sm font-semibold text-ink">
                              {selectedBook.category ? `${selectedBook.category} · ` : ""}
                              {selectedBook.name}
                            </p>
                            <p className="mt-1 text-xs text-ink-muted48">
                              {selectedBook.bookCode ? `${selectedBook.bookCode} · ` : ""}
                              {formatVnd(selectedBook.unitPrice)} · Tồn kho {selectedBook.quantityOnHand ?? 0}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-ink">Chọn danh mục và sách</p>
                            <p className="mt-1 text-xs text-ink-muted48">Mở drawer để lọc theo danh mục rồi tìm đúng đầu sách.</p>
                          </>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-primary">Chọn</span>
                    </button>
                  </div>

                  <label className="space-y-2">
                    <span className="label-sm">Số lượng</span>
                    <input type="number" min="1" className="input" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                  </label>

                  <label className="space-y-2">
                    <span className="label-sm">Ngày ghi nhận</span>
                    <DatePicker value={issueDate} onChange={setIssueDate} />
                  </label>
                </div>

                {selectedBook ? (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
                        Danh mục: {selectedBook.category?.trim() || "Sách khác"}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stockTone(selectedBook.quantityOnHand ?? 0)}`}>
                        {selectedBook.quantityOnHand && selectedBook.quantityOnHand > 0
                          ? `Còn ${selectedBook.quantityOnHand} cuốn trong kho`
                          : "Đang hết kho"}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
                        Đơn giá: {formatVnd(selectedBook.unitPrice)}
                      </span>
                    </div>
                  </div>
                ) : null}

                <label className="space-y-2">
                  <span className="label-sm">Ghi chú phát sinh sách</span>
                  <textarea
                    className="input min-h-[88px]"
                    value={issueNotes}
                    onChange={(event) => setIssueNotes(event.target.value)}
                    placeholder="Ví dụ: phụ huynh xin mua thêm workbook, học viên thiếu sách buổi đầu, đổi sang bộ nâng cao..."
                  />
                </label>

                {issueError ? <div className="alert-danger">{issueError}</div> : null}
                {issueNotice ? <div className="alert-success">{issueNotice}</div> : null}

                <button type="submit" disabled={issuing} className="btn-primary">
                  {issuing ? "Đang lưu phát sinh..." : "Thêm sách phát sinh"}
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-ink-muted48">Vai trò hiện tại không có quyền thêm phát sinh giáo trình.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-hairline p-4">
            <p className="text-sm font-semibold text-ink">Giáo trình chưa chốt tiền</p>
            <p className="mt-1 text-xs text-ink-muted48">Xác nhận nhanh dòng nào đã thu, dòng nào vẫn còn treo để khi đối chiếu phụ huynh không bị sót.</p>

            <div className="mt-4 space-y-3">
              {unpaidBooks.map((issue) => (
                <div key={issue.id} className="rounded-2xl border border-hairline bg-canvas-parchment/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{issue.bookName}</p>
                      <p className="mt-1 text-xs text-ink-muted48">
                        {issue.className ?? "Chưa gắn lớp"} · SL {issue.quantity} · {formatDate(issue.issueDate)}
                      </p>
                      {issue.notes ? <p className="mt-1 text-xs text-ink-muted48">{issue.notes}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">{formatVnd(issue.amount)}</p>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${bookPaymentTone(issue.paymentStatus)}`}>
                        {bookPaymentLabel(issue.paymentStatus)}
                      </span>
                    </div>
                  </div>

                  {canManageInventory ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateBookPaymentStatus(issue.id, "PAID")}
                        disabled={updatingBookIssueId === issue.id}
                        className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200"
                      >
                        Đánh dấu đã thu
                      </button>
                      <button
                        type="button"
                        onClick={() => updateBookPaymentStatus(issue.id, "PARTIAL")}
                        disabled={updatingBookIssueId === issue.id}
                        className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-200"
                      >
                        Thu một phần
                      </button>
                      <button
                        type="button"
                        onClick={() => updateBookPaymentStatus(issue.id, "UNPAID")}
                        disabled={updatingBookIssueId === issue.id}
                        className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                      >
                        Chưa thu
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}

              {bookStatusError ? <div className="alert-danger">{bookStatusError}</div> : null}
              {unpaidBooks.length === 0 ? <p className="text-sm text-emerald-700">Không còn dòng giáo trình nào đang treo tiền.</p> : null}
            </div>
          </div>

          <div className="rounded-3xl border border-hairline p-4">
            <p className="text-sm font-semibold text-ink">Các khoản còn nợ theo kỳ</p>
            <div className="mt-4 space-y-3">
              {charges
                .filter((charge) => charge.remainingAmount > 0)
                .map((charge) => (
                  <div key={charge.id} className="rounded-2xl border border-hairline bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{charge.periodName}</p>
                        <p className="mt-1 text-xs text-ink-muted48">{charge.className}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                        Còn {formatVnd(charge.remainingAmount)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-ink-muted48">
                      <div>Học phí: <strong className="text-ink">{formatVnd(charge.tuitionAmount)}</strong></div>
                      <div>Giáo trình: <strong className="text-ink">{formatVnd(charge.materialsAmount)}</strong></div>
                      <div>Tồn đầu: <strong className="text-ink">{formatVnd(charge.openingBalance)}</strong></div>
                      <div>Đã thu: <strong className="text-ink">{formatVnd(charge.paidAmount)}</strong></div>
                    </div>
                  </div>
                ))}

              {!charges.some((charge) => charge.remainingAmount > 0) ? (
                <p className="text-sm text-emerald-700">Hiện không có kỳ công nợ nào mở.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-hairline p-4">
            <p className="text-sm font-semibold text-ink">Phiếu thu gần đây</p>
            <div className="mt-4 space-y-3">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="rounded-2xl border border-hairline bg-canvas-parchment/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{payment.paymentNo}</p>
                      <p className="mt-1 text-xs text-ink-muted48">
                        {formatDate(payment.paidDate)} · {payment.method ?? "Chưa ghi hình thức"}
                      </p>
                      {payment.discountAmount && payment.discountAmount > 0 ? (
                        <p className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          Đã giảm {formatVnd(payment.discountAmount)} do chiết khấu tiền mặt
                        </p>
                      ) : null}
                      {payment.discountReason ? <p className="mt-2 text-xs text-amber-800">{payment.discountReason}</p> : null}
                      {payment.notes ? <p className="mt-1 text-xs text-ink-muted48">{payment.notes}</p> : null}
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatVnd(payment.amount)}</p>
                  </div>
                </div>
              ))}
              {recentPayments.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có phiếu thu nào.</p> : null}
            </div>
          </div>
        </div>
      </div>

      <SlideOver
        open={bookPickerOpen}
        onClose={() => setBookPickerOpen(false)}
        widthClassName="max-w-3xl"
        title="Chọn sách phát sinh"
        description="Chọn danh mục sách trước, sau đó tìm đúng đầu sách trong danh mục và xem luôn tình trạng còn hay hết trong kho."
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <label className="space-y-2">
              <span className="label-sm">Danh mục sách</span>
              <select className="input" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                <option value="">Tất cả danh mục</option>
                {bookCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="label-sm">Tìm đúng đầu sách</span>
              <input
                className="input"
                value={bookSearch}
                onChange={(event) => setBookSearch(event.target.value)}
                placeholder="Tìm theo tên sách, mã sách hoặc tên danh mục..."
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Đầu sách phù hợp</p>
            <p className="text-xs text-ink-muted48">{filteredBooks.length} đầu sách</p>
          </div>

          <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
            {filteredBooks.map((book) => {
              const category = book.category?.trim() || "Sách khác";
              const isSelected = selectedBookId === book.id;
              const quantityOnHand = book.quantityOnHand ?? 0;
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => {
                    setSelectedBookId(book.id);
                    setBookPickerOpen(false);
                  }}
                  className={`w-full rounded-3xl border p-4 text-left transition ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-[0_16px_32px_rgba(17,139,222,0.12)]"
                      : "border-hairline bg-white hover:border-primary/40 hover:bg-canvas"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{category}</p>
                      <p className="text-base font-semibold text-ink">{book.name}</p>
                      <p className="text-xs text-ink-muted48">
                        {book.bookCode ? `${book.bookCode} · ` : ""}
                        Đơn giá {formatVnd(book.unitPrice)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stockTone(quantityOnHand)}`}>
                        {quantityOnHand > 0 ? `Còn kho ${quantityOnHand}` : "Hết kho"}
                      </span>
                      {isSelected ? <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Đang chọn</span> : null}
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredBooks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-hairline bg-canvas-parchment/30 p-6 text-center">
                <p className="text-sm font-semibold text-ink">Không có đầu sách phù hợp</p>
                <p className="mt-2 text-sm text-ink-muted48">Thử đổi danh mục hoặc tìm bằng từ khóa ngắn hơn.</p>
              </div>
            ) : null}
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
