"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import DatePicker from "@/components/ui/DatePicker";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormGuide from "@/components/ui/FormGuide";
import { getVietnamToday } from "@/lib/server/class-rules";
import { formatVnd } from "@/lib/export-utils";

type ChargeSummary = {
  id: string;
  classId: string;
  billingPeriodId: string;
  periodName: string;
  startDate: string | Date;
  className: string;
  tuitionAmount: number;
  materialsAmount: number;
  openingBalance: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  discountLabels?: string[];
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

type BookRequirementSummary = {
  id: string;
  className: string;
  bookName: string;
  quantity: number;
  totalAmount: number;
  status: string;
};

type ActiveEnrollmentOption = {
  classId: string;
  enrollmentId: string;
  className: string;
  billingModel: string;
};

type StudentFinanceDeskProps = {
  studentId: string;
  studentName: string;
  studentCode: string;
  outstanding: number;
  dueNowAmount: number;
  currentClassName?: string | null;
  canIssueBooks: boolean;
  activeEnrollmentOptions: ActiveEnrollmentOption[];
  nextDueCharge?: ChargeSummary | null;
  charges: ChargeSummary[];
  bookIssues: BookIssueSummary[];
  bookRequirements: BookRequirementSummary[];
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function billingModeLabel(mode: string) {
  if (mode === "COURSE") return "Theo khóa";
  if (mode === "PERIOD") return "Theo tháng";
  if (mode === "INSTALLMENT") return "Trả góp";
  return mode;
}

function requirementLabel(status: string) {
  if (status === "CONFIRMED") return "Đã xác nhận mua";
  if (status === "DECLINED") return "Không mua";
  return "Chờ xác nhận";
}

function requirementClass(status: string) {
  if (status === "CONFIRMED") return "bg-emerald-100 text-emerald-700";
  if (status === "DECLINED") return "bg-slate-100 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function bookPaymentLabel(status: string) {
  if (status === "PAID") return "Đã thu";
  if (status === "PARTIAL") return "Đã thu một phần";
  return "Chưa thu";
}

function bookPaymentClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function stockClass(quantity: number) {
  if (quantity <= 0) return "bg-rose-100 text-rose-700";
  if (quantity <= 5) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function toneCard(kind: "danger" | "warning" | "success" | "default") {
  if (kind === "danger") return "border-rose-200 bg-rose-50";
  if (kind === "warning") return "border-amber-200 bg-amber-50";
  if (kind === "success") return "border-emerald-200 bg-emerald-50";
  return "border-hairline bg-white";
}

function buildChargePreviewText(charge?: ChargeSummary | null) {
  if (!charge) return "Lớp này chưa có khoản đang mở. Kiểu thu mới sẽ áp dụng từ lần sinh phí tiếp theo.";

  return [
    `Kỳ đang ảnh hưởng: ${charge.periodName}`,
    `Còn phải thu: ${formatVnd(charge.remainingAmount)}`,
    `- Học phí: ${formatVnd(charge.tuitionAmount)}`,
    `- Sách: ${formatVnd(charge.materialsAmount)}`,
    `- Nợ cũ: ${formatVnd(charge.openingBalance)}`,
    `- Đã thu: ${formatVnd(charge.paidAmount)}`,
  ].join("\n");
}

const STUDENT_FINANCE_GUIDE_SECTIONS = [
  {
    title: "Đọc nhanh tab này",
    items: [
      "Nhìn số còn phải thu trước để biết học viên đang cần đóng bao nhiêu.",
      "Khoản cần thu ngay là khoản nên xử lý đầu tiên trong lần làm việc này.",
      "Tiền học và tiền sách được tách riêng để tránh thu nhầm.",
    ],
    tone: "info" as const,
  },
  {
    title: "Thao tác đúng",
    items: [
      "Cần thu tiền thì bấm thu ở đúng khoản đang mở.",
      "Phụ huynh đổi từ theo tháng sang theo khóa thì đổi ở phần cách thu theo lớp.",
      "Mua thêm sách thì thêm ở khu sách để hệ thống cộng đúng vào công nợ.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý",
    items: [
      "Học bổng chỉ giảm học phí, không giảm tiền sách.",
      "Khoản đã thu đủ chỉ để đối chiếu lịch sử.",
      "Nếu số liệu lệch, kiểm tra cả học phí, thanh toán và sách cùng lúc.",
    ],
    tone: "warning" as const,
  },
];

export default function StudentFinanceDesk({
  studentId,
  studentName,
  studentCode,
  outstanding,
  dueNowAmount,
  currentClassName,
  canIssueBooks,
  activeEnrollmentOptions,
  nextDueCharge,
  charges,
  bookIssues,
  bookRequirements,
  canManageFinance,
  canManageInventory,
}: StudentFinanceDeskProps) {
  const router = useRouter();

  const [books, setBooks] = useState<BookOption[]>([]);
  const [booksLoaded, setBooksLoaded] = useState(false);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState(activeEnrollmentOptions.length === 1 ? activeEnrollmentOptions[0]?.classId ?? "" : "");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [issueNotes, setIssueNotes] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueNotice, setIssueNotice] = useState<string | null>(null);
  const [bookStatusError, setBookStatusError] = useState<string | null>(null);
  const [updatingBookIssueId, setUpdatingBookIssueId] = useState<string | null>(null);
  const [deletingBookIssueId, setDeletingBookIssueId] = useState<string | null>(null);
  const [switchingEnrollmentId, setSwitchingEnrollmentId] = useState<string | null>(null);
  const [billingModeMessage, setBillingModeMessage] = useState<string | null>(null);
  const [updatingRequirementId, setUpdatingRequirementId] = useState<string | null>(null);
  const [showIssueComposer, setShowIssueComposer] = useState(false);
  const [pendingBillingSwitch, setPendingBillingSwitch] = useState<{
    enrollmentId: string;
    classId: string;
    className: string;
    nextBillingModel: "PERIOD" | "COURSE";
  } | null>(null);

  const selectedBook = useMemo(() => books.find((book) => book.id === selectedBookId) ?? null, [books, selectedBookId]);
  const unpaidBooks = useMemo(() => bookIssues.filter((issue) => issue.paymentStatus !== "PAID"), [bookIssues]);
  const unpaidBookAmount = unpaidBooks.reduce((sum, issue) => sum + issue.amount, 0);
  const openCharges = useMemo(() => charges.filter((charge) => charge.remainingAmount > 0), [charges]);
  const otherOpenCharges = useMemo(() => openCharges.filter((charge) => charge.id !== nextDueCharge?.id), [openCharges, nextDueCharge?.id]);
  // Kỳ trả góp sinh sẵn charge cho cả tương lai — tách riêng kỳ ĐÃ tới hạn (thật sự
  // là nợ) khỏi kỳ CHƯA tới hạn (chỉ là lịch trả góp sắp tới, không phải nợ quá hạn).
  const today = useMemo(() => getVietnamToday(), []);
  const overdueOtherCharges = useMemo(() => otherOpenCharges.filter((charge) => new Date(charge.startDate).getTime() <= today.getTime()), [otherOpenCharges, today]);
  const upcomingOtherCharges = useMemo(() => otherOpenCharges.filter((charge) => new Date(charge.startDate).getTime() > today.getTime()), [otherOpenCharges, today]);
  const openChargeByClassId = useMemo(() => {
    const mapping = new Map<string, ChargeSummary>();
    openCharges
      .slice()
      .sort((left, right) => left.periodName.localeCompare(right.periodName, "vi"))
      .forEach((charge) => {
        if (!mapping.has(charge.classId)) mapping.set(charge.classId, charge);
      });
    return mapping;
  }, [openCharges]);
  const requirementStats = useMemo(
    () => ({
      pending: bookRequirements.filter((item) => item.status === "PENDING").length,
      confirmed: bookRequirements.filter((item) => item.status === "CONFIRMED").length,
      declined: bookRequirements.filter((item) => item.status === "DECLINED").length,
    }),
    [bookRequirements],
  );

  // Bảng "Các kỳ học phí" gộp chung khoản ưu tiên thu + kỳ còn treo + vài kỳ gần đây đã
  // thu đủ, để CSO chỉ cần nhìn 1 danh sách duy nhất thay vì 3 khối tách rời như trước.
  const chargeTableRows = useMemo(() => {
    const overdue = overdueOtherCharges;
    const dueRow = nextDueCharge && !overdue.some((c) => c.id === nextDueCharge.id) ? [nextDueCharge] : [];
    const closed = charges
      .filter((charge) => charge.remainingAmount <= 0)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 6);
    return [...dueRow, ...overdue, ...upcomingOtherCharges, ...closed];
  }, [charges, overdueOtherCharges, upcomingOtherCharges, nextDueCharge]);

  type BookRow = {
    key: string;
    kind: "requirement" | "issue";
    bookName: string;
    className: string;
    quantity: number;
    amount: number;
    statusLabel: string;
    statusClass: string;
    requirement?: BookRequirementSummary;
    issue?: BookIssueSummary;
  };

  // Bảng "Sách" gộp chung sách chuẩn của khóa và sách mua thêm chưa thu vào 1 danh sách,
  // phân biệt bằng nhãn "Sách chuẩn"/"Phát sinh" thay vì 2 khối tách rời như trước.
  const bookTableRows = useMemo<BookRow[]>(() => {
    const requirementRows: BookRow[] = bookRequirements.map((item) => ({
      key: `req-${item.id}`,
      kind: "requirement",
      bookName: item.bookName,
      className: item.className,
      quantity: item.quantity,
      amount: item.totalAmount,
      statusLabel: requirementLabel(item.status),
      statusClass: requirementClass(item.status),
      requirement: item,
    }));
    const issueRows: BookRow[] = unpaidBooks.map((issue) => ({
      key: `issue-${issue.id}`,
      kind: "issue",
      bookName: issue.bookName,
      className: issue.className ?? "Chưa gắn lớp",
      quantity: issue.quantity,
      amount: issue.amount,
      statusLabel: bookPaymentLabel(issue.paymentStatus),
      statusClass: bookPaymentClass(issue.paymentStatus),
      issue,
    }));
    return [...requirementRows, ...issueRows];
  }, [bookRequirements, unpaidBooks]);

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
  }, [books, selectedCategory, bookSearch]);

  async function ensureBooksLoaded() {
    if (booksLoaded) return;
    const response = await fetch("/api/books");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return;
    setBooks(Array.isArray(data.items) ? data.items : []);
    setBooksLoaded(true);
  }

  async function openBookPicker() {
    await ensureBooksLoaded();
    setBookPickerOpen(true);
  }

  async function handleIssueBook(event: React.FormEvent) {
    event.preventDefault();
    if (!canIssueBooks) {
      setIssueError("Học viên chưa có lớp đang học để gắn phát sinh sách.");
      return;
    }
    if (!selectedBookId) {
      setIssueError("Bạn cần chọn đầu sách trước khi lưu.");
      return;
    }
    if (activeEnrollmentOptions.length > 1 && !selectedClassId) {
      setIssueError("Học viên đang học nhiều lớp. Hãy chọn đúng lớp cần gắn sách.");
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
        classId: selectedClassId || activeEnrollmentOptions[0]?.classId || undefined,
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

    const notices = [data.warning, data.classWarning, data.chargeUpdated ? "Tiền sách đã được cộng vào công nợ đang mở." : null]
      .filter(Boolean)
      .join(" ");
    setIssueNotice(notices || "Đã thêm phát sinh sách.");
    setSelectedBookId("");
    setSelectedClassId(activeEnrollmentOptions.length === 1 ? activeEnrollmentOptions[0]?.classId ?? "" : "");
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
      setBookStatusError(data.error ?? "Không thể cập nhật trạng thái thu của sách.");
      return;
    }

    router.refresh();
  }

  async function deleteBookIssue(issueId: string) {
    setDeletingBookIssueId(issueId);
    setBookStatusError(null);
    const response = await fetch(`/api/book-issues/${issueId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setDeletingBookIssueId(null);

    if (!response.ok) {
      setBookStatusError(data.error ?? "Không thể xóa dòng sách này.");
      return;
    }

    router.refresh();
  }

  async function switchBillingMode(enrollmentId: string, classId: string, nextBillingModel: "PERIOD" | "COURSE", className: string) {
    setPendingBillingSwitch({ enrollmentId, classId, className, nextBillingModel });
  }

  async function confirmBillingModeSwitch() {
    if (!pendingBillingSwitch) return;
    const { enrollmentId, classId, className, nextBillingModel } = pendingBillingSwitch;
    const nextLabel = nextBillingModel === "COURSE" ? "theo khóa" : "theo tháng";
    setSwitchingEnrollmentId(enrollmentId);
    setBillingModeMessage(null);

    const currentCharge = openChargeByClassId.get(classId) ?? null;
    const periodContext =
      currentCharge?.billingPeriodId ??
      nextDueCharge?.billingPeriodId ??
      null;

    const response = await fetch(`/api/enrollments/${enrollmentId}/billing-model`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingModel: nextBillingModel, billingPeriodId: periodContext }),
    });
    const data = await response.json().catch(() => ({}));
    setSwitchingEnrollmentId(null);

    if (!response.ok) {
      setBillingModeMessage(data.error ?? "Không thể đổi kiểu thu.");
      setPendingBillingSwitch(null);
      return;
    }

    setBillingModeMessage(`Đã cập nhật ${className} sang ${nextLabel}.`);
    setPendingBillingSwitch(null);
    router.refresh();
  }

  async function updateBookRequirement(id: string, status: "CONFIRMED" | "DECLINED" | "PENDING") {
    setUpdatingRequirementId(id);
    setBookStatusError(null);

    const response = await fetch(`/api/student-book-requirements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json().catch(() => ({}));
    setUpdatingRequirementId(null);

    if (!response.ok) {
      setBookStatusError(data.error ?? "Không thể cập nhật yêu cầu sách.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-6">
      <FormGuide
        title="Hướng dẫn học phí"
        summary="Cách nhìn số tiền, đổi kiểu thu và xử lý sách của học viên."
        sections={STUDENT_FINANCE_GUIDE_SECTIONS}
        position="floating"
        buttonLabel="Guide"
      />
      <section className="rounded-[28px] border border-[#dbe7fb] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                Học phí
              </span>
              {currentClassName ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{currentClassName}</span> : null}
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Học phí của {studentName}</h2>
              <p className="mt-1 text-sm text-ink-muted48">{studentCode} · {activeEnrollmentOptions.length > 0 ? `${activeEnrollmentOptions.length} lớp đang chạy` : "Chưa có lớp đang hoạt động"}</p>
            </div>

          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManageInventory ? (
              <button type="button" onClick={() => void openBookPicker()} className="btn-ghost-sm">
                Chọn sách phát sinh
              </button>
            ) : null}
            {canManageFinance ? <QuickPaymentButton studentId={studentId} suggestedAmount={outstanding} /> : null}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-hairline bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Cách thu theo lớp</h3>
            <p className="mt-1 text-sm text-ink-muted48">Mỗi lớp chọn 1 kiểu thu đang áp dụng cho phụ huynh.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{activeEnrollmentOptions.length} lớp đang áp dụng</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-y-2 text-sm">
            <tbody>
              {activeEnrollmentOptions.map((enrollment) => {
                const openCharge = openChargeByClassId.get(enrollment.classId);
                return (
                  <tr key={enrollment.enrollmentId} className="bg-[#fbfdff]">
                    <td className="rounded-l-2xl px-4 py-3 align-middle">
                      <p className="text-sm font-semibold text-ink">{enrollment.className}</p>
                      <p className="mt-0.5 text-xs text-ink-muted48">Đang thu: {billingModeLabel(enrollment.billingModel)}</p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {openCharge ? (
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{openCharge.periodName}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">Còn {formatVnd(openCharge.remainingAmount)}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-ink-muted48">Chưa có khoản mở cần đổi ngay.</p>
                      )}
                    </td>
                    <td className="rounded-r-2xl px-4 py-3 text-right align-middle">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => switchBillingMode(enrollment.enrollmentId, enrollment.classId, "PERIOD", enrollment.className)}
                          disabled={switchingEnrollmentId === enrollment.enrollmentId || enrollment.billingModel === "PERIOD"}
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                            enrollment.billingModel === "PERIOD"
                              ? "bg-sky-100 text-sky-700"
                              : "border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                          }`}
                        >
                          {switchingEnrollmentId === enrollment.enrollmentId && enrollment.billingModel !== "PERIOD" ? "Đang đổi..." : "Theo tháng"}
                        </button>
                        <button
                          type="button"
                          onClick={() => switchBillingMode(enrollment.enrollmentId, enrollment.classId, "COURSE", enrollment.className)}
                          disabled={switchingEnrollmentId === enrollment.enrollmentId || enrollment.billingModel === "COURSE"}
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                            enrollment.billingModel === "COURSE"
                              ? "bg-violet-100 text-violet-700"
                              : "border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
                          }`}
                        >
                          {switchingEnrollmentId === enrollment.enrollmentId && enrollment.billingModel !== "COURSE" ? "Đang đổi..." : "Theo khóa"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {activeEnrollmentOptions.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-sm text-ink-muted48">Chưa có ghi danh đang hoạt động.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {billingModeMessage ? <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">{billingModeMessage}</div> : null}
      </section>

      <section className="rounded-[28px] border border-hairline bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Các kỳ học phí</h3>
            <p className="mt-1 text-sm text-ink-muted48">Kỳ ưu tiên thu, kỳ còn treo và vài kỳ gần đây đã thu đủ — gộp chung 1 danh sách, thu tiền ngay trên dòng.</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Cần thu {formatVnd(dueNowAmount)}</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-muted48">
                <th className="px-3 pb-1">Kỳ · Lớp · Trạng thái</th>
                <th className="px-3 pb-1">Học phí</th>
                <th className="px-3 pb-1">Sách</th>
                <th className="px-3 pb-1">Nợ đầu kỳ</th>
                <th className="px-3 pb-1">Đã thu</th>
                <th className="px-3 pb-1 text-right">Còn lại · Hành động</th>
              </tr>
            </thead>
            <tbody>
              {chargeTableRows.map((charge) => {
                const isPriority = charge.id === nextDueCharge?.id;
                const isClosed = charge.remainingAmount <= 0;
                const isUpcoming = !isClosed && new Date(charge.startDate).getTime() > today.getTime();
                const statusLabel = isPriority
                  ? "Ưu tiên thu ngay"
                  : isUpcoming
                    ? `Đến hạn ${new Date(charge.startDate).toLocaleDateString("vi-VN")}`
                    : isClosed
                      ? "Đã đủ"
                      : "Còn nợ";
                const statusClass = isPriority
                  ? "bg-amber-200 text-amber-800"
                  : isUpcoming
                    ? "bg-sky-100 text-sky-700"
                    : isClosed
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700";
                return (
                  <tr key={charge.id} className={isPriority ? "bg-amber-50" : "bg-[#fbfdff]"}>
                    <td className="rounded-l-2xl px-3 py-3 align-top">
                      <p className="font-semibold text-ink">{charge.periodName}</p>
                      <p className="mt-0.5 text-xs text-ink-muted48">{charge.className}</p>
                      {charge.discountLabels?.length ? <p className="mt-1 text-xs text-emerald-700">{charge.discountLabels.join(" + ")}</p> : null}
                      <span className={`mt-1.5 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
                    </td>
                    <td className="px-3 py-3 align-top text-ink-muted80">{formatVnd(charge.tuitionAmount)}</td>
                    <td className="px-3 py-3 align-top text-ink-muted80">{formatVnd(charge.materialsAmount)}</td>
                    <td className="px-3 py-3 align-top text-ink-muted80">{formatVnd(charge.openingBalance)}</td>
                    <td className="px-3 py-3 align-top text-ink-muted80">{formatVnd(charge.paidAmount)}</td>
                    <td className="rounded-r-2xl px-3 py-3 text-right align-top">
                      <p className="font-semibold text-ink">{formatVnd(charge.remainingAmount)}</p>
                      {charge.remainingAmount > 0 && canManageFinance ? (
                        <div className="mt-1.5">
                          <QuickPaymentButton studentId={studentId} suggestedAmount={charge.remainingAmount} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {chargeTableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-ink-muted48">
                    Chưa có kỳ học phí nào.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] border border-hairline bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Sách</h3>
            <p className="mt-1 text-sm text-ink-muted48">Sách chuẩn của khóa và sách mua thêm chưa thu — gộp chung 1 danh sách.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Chờ xác nhận {requirementStats.pending}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Đã mua {requirementStats.confirmed}</span>
            {canManageInventory ? (
              <button type="button" onClick={() => setShowIssueComposer((current) => !current)} className="btn-ghost-sm">
                {showIssueComposer ? "Ẩn form phát sinh" : "Thêm sách phát sinh"}
              </button>
            ) : null}
          </div>
        </div>

        {canManageInventory && showIssueComposer ? (
          <form onSubmit={handleIssueBook} className="mt-4 space-y-4 rounded-[22px] border border-[#e8eefb] bg-[#fbfdff] p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_120px_180px]">
              <label className="space-y-2">
                <span className="label-sm">Lớp gắn sách</span>
                <select
                  className="input"
                  value={selectedClassId}
                  onChange={(event) => setSelectedClassId(event.target.value)}
                  disabled={!canIssueBooks || activeEnrollmentOptions.length === 1}
                >
                  {activeEnrollmentOptions.length > 1 ? <option value="">Chọn đúng lớp</option> : null}
                  {activeEnrollmentOptions.map((item) => (
                    <option key={item.enrollmentId} value={item.classId}>
                      {item.className}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <span className="label-sm">Đầu sách</span>
                <button
                  type="button"
                  onClick={() => void openBookPicker()}
                  className="flex min-h-[52px] w-full items-center justify-between rounded-[18px] border border-[#cfe0fb] bg-white px-4 py-3 text-left transition hover:border-primary/40 hover:bg-canvas"
                >
                  <div className="min-w-0">
                    {selectedBook ? (
                      <>
                        <p className="truncate text-sm font-semibold text-ink">{selectedBook.name}</p>
                        <p className="mt-1 truncate text-xs text-ink-muted48">
                          {(selectedBook.category?.trim() || "Sách khác")} · {formatVnd(selectedBook.unitPrice)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-ink">Chọn danh mục và sách</p>
                        <p className="mt-1 text-xs text-ink-muted48">Mở danh sách để chọn đúng đầu sách.</p>
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

            <label className="space-y-2">
              <span className="label-sm">Ghi chú</span>
              <textarea
                className="input min-h-[88px]"
                value={issueNotes}
                onChange={(event) => setIssueNotes(event.target.value)}
                placeholder="Ví dụ: mua thêm workbook, thiếu sách buổi đầu, đổi sang bộ nâng cao..."
              />
            </label>

            {selectedBook ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Danh mục: {selectedBook.category?.trim() || "Sách khác"}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stockClass(selectedBook.quantityOnHand ?? 0)}`}>
                  {selectedBook.quantityOnHand && selectedBook.quantityOnHand > 0 ? `Còn ${selectedBook.quantityOnHand} cuốn` : "Đang hết kho"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Đơn giá: {formatVnd(selectedBook.unitPrice)}</span>
              </div>
            ) : null}

            {issueError ? <div className="alert-danger">{issueError}</div> : null}
            {issueNotice ? <div className="alert-success">{issueNotice}</div> : null}
            {bookStatusError ? <div className="alert-danger">{bookStatusError}</div> : null}

            <button type="submit" disabled={issuing || !canIssueBooks} className="btn-primary">
              {issuing ? "Đang lưu..." : "Thêm sách"}
            </button>
          </form>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-muted48">
                <th className="px-3 pb-1">Đầu sách</th>
                <th className="px-3 pb-1">Lớp</th>
                <th className="px-3 pb-1">SL</th>
                <th className="px-3 pb-1">Tiền</th>
                <th className="px-3 pb-1">Trạng thái</th>
                <th className="px-3 pb-1 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {bookTableRows.map((row) => (
                <tr key={row.key} className="bg-[#fbfdff]">
                  <td className="rounded-l-2xl px-3 py-3 align-top">
                    <p className="text-sm font-semibold text-ink">{row.bookName}</p>
                    <p className="mt-0.5 text-xs text-ink-muted48">{row.kind === "requirement" ? "Sách chuẩn" : "Phát sinh"}</p>
                  </td>
                  <td className="px-3 py-3 align-top text-ink-muted80">{row.className}</td>
                  <td className="px-3 py-3 align-top text-ink-muted80">{row.quantity}</td>
                  <td className="px-3 py-3 align-top text-ink-muted80">{formatVnd(row.amount)}</td>
                  <td className="px-3 py-3 align-top">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.statusClass}`}>{row.statusLabel}</span>
                  </td>
                  <td className="rounded-r-2xl px-3 py-3 text-right align-top">
                    {row.kind === "requirement" && row.requirement ? (
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => updateBookRequirement(row.requirement!.id, "CONFIRMED")}
                          disabled={updatingRequirementId === row.requirement.id || row.requirement.status === "CONFIRMED"}
                          className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Xác nhận mua
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBookRequirement(row.requirement!.id, "DECLINED")}
                          disabled={updatingRequirementId === row.requirement.id || row.requirement.status === "DECLINED"}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Không mua
                        </button>
                      </div>
                    ) : row.kind === "issue" && row.issue && canManageInventory ? (
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => updateBookPaymentStatus(row.issue!.id, "PAID")}
                          disabled={updatingBookIssueId === row.issue.id}
                          className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
                        >
                          Đã thu
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBookPaymentStatus(row.issue!.id, "PARTIAL")}
                          disabled={updatingBookIssueId === row.issue.id}
                          className="status-action"
                        >
                          Một phần
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBookPaymentStatus(row.issue!.id, "UNPAID")}
                          disabled={updatingBookIssueId === row.issue.id}
                          className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                        >
                          Chưa thu
                        </button>
                        <ConfirmActionButton
                          title="Xác nhận xóa sách phát sinh?"
                          description="Hệ thống sẽ hoàn tác dòng này khỏi công nợ và tồn kho nếu khoản sách vẫn chưa thu."
                          confirmLabel="Xóa dòng sách"
                          tone="danger"
                          disabled={deletingBookIssueId === row.issue.id}
                          className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          onConfirm={() => deleteBookIssue(row.issue!.id)}
                        >
                          Xóa
                        </ConfirmActionButton>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {bookTableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-ink-muted48">
                    Chưa có sách chuẩn hoặc sách phát sinh nào đang treo.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <ResponsiveDrawer 
        open={bookPickerOpen}
        onClose={() => setBookPickerOpen(false)}
        widthClassName="max-w-3xl"
        title="Chọn sách phát sinh"
        description="Lọc theo danh mục rồi chọn đúng đầu sách cần gắn cho học viên."
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
              <span className="label-sm">Tìm đầu sách</span>
              <input
                className="input"
                value={bookSearch}
                onChange={(event) => setBookSearch(event.target.value)}
                placeholder="Tìm theo tên sách, mã sách hoặc danh mục..."
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Kết quả phù hợp</p>
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
                  className={`w-full rounded-[22px] border p-4 text-left transition ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-[0_16px_32px_rgba(17,139,222,0.12)]"
                      : "border-hairline bg-white hover:border-primary/40 hover:bg-canvas"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{category}</p>
                      <p className="mt-1 text-base font-semibold text-ink">{book.name}</p>
                      <p className="mt-1 text-xs text-ink-muted48">
                        {book.bookCode ? `${book.bookCode} · ` : ""}
                        Đơn giá {formatVnd(book.unitPrice)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stockClass(quantityOnHand)}`}>
                        {quantityOnHand > 0 ? `Còn ${quantityOnHand} cuốn` : "Hết kho"}
                      </span>
                      {isSelected ? <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Đang chọn</span> : null}
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredBooks.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-hairline bg-canvas-parchment/30 p-6 text-center">
                <p className="text-sm font-semibold text-ink">Không có đầu sách phù hợp</p>
                <p className="mt-2 text-sm text-ink-muted48">Thử đổi danh mục hoặc rút ngắn từ khóa tìm kiếm.</p>
              </div>
            ) : null}
          </div>
        </div>
      </ResponsiveDrawer>

      <ConfirmDialog
        open={Boolean(pendingBillingSwitch)}
        title={
          pendingBillingSwitch
            ? `Đổi ${pendingBillingSwitch.className} sang ${pendingBillingSwitch.nextBillingModel === "COURSE" ? "theo khóa" : "theo tháng"}?`
            : "Đổi kiểu thu"
        }
        description={
          pendingBillingSwitch
            ? [
                buildChargePreviewText(openChargeByClassId.get(pendingBillingSwitch.classId) ?? null),
                "",
                "Nếu khoản hiện tại đã thu rồi, hệ thống sẽ chặn để tránh lệch công nợ.",
                "Tiền sách chưa thu sẽ được giữ lại ở lần sinh phí tiếp theo.",
              ].join("\n")
            : undefined
        }
        confirmLabel="Xác nhận đổi kiểu thu"
        cancelLabel="Giữ nguyên"
        onConfirm={confirmBillingModeSwitch}
        onClose={() => {
          if (!switchingEnrollmentId) setPendingBillingSwitch(null);
        }}
        loading={Boolean(switchingEnrollmentId)}
      />
    </div>
  );
}
