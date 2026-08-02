"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import DatePicker from "@/components/ui/DatePicker";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormGuide from "@/components/ui/FormGuide";
import { getVietnamToday } from "@/lib/server/class-rules";

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

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="rounded-[28px] border border-hairline bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-ink">Cách thu theo lớp</h3>
            <p className="mt-1 text-sm text-ink-muted48">Mỗi lớp chọn 1 kiểu thu đang áp dụng cho phụ huynh.</p>
            </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{activeEnrollmentOptions.length} lớp đang áp dụng</span>
        </div>

        <div className="mt-4 space-y-3">
          {activeEnrollmentOptions.map((enrollment) => (
            <div key={enrollment.enrollmentId} className="rounded-[22px] border border-[#e8eefb] bg-[#fbfdff] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{enrollment.className}</p>
                  <p className="mt-1 text-xs text-ink-muted48">Đang thu: {billingModeLabel(enrollment.billingModel)}</p>
                  {openChargeByClassId.get(enrollment.classId) ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{openChargeByClassId.get(enrollment.classId)?.periodName}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">Còn {formatVnd(openChargeByClassId.get(enrollment.classId)?.remainingAmount ?? 0)}</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-ink-muted48">Hiện chưa có khoản mở cần đổi ngay cho lớp này.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
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
              </div>
            </div>
          ))}

          {billingModeMessage ? <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">{billingModeMessage}</div> : null}
          {activeEnrollmentOptions.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có ghi danh đang hoạt động.</p> : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-hairline bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-ink">Khoản cần thu ngay</h3>
            <p className="mt-1 text-sm text-ink-muted48">Ưu tiên thu trước ở lần làm việc này.</p>
            </div>
          <div className="flex flex-wrap items-center gap-2">
            {nextDueCharge ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Còn {formatVnd(nextDueCharge.remainingAmount)}</span> : null}
            {canManageFinance && nextDueCharge ? <QuickPaymentButton studentId={studentId} suggestedAmount={nextDueCharge.remainingAmount} /> : null}
          </div>
        </div>

        {nextDueCharge ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">{nextDueCharge.periodName}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{nextDueCharge.className}</span>
                    {nextDueCharge.openingBalance > 0 ? (
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Có nợ cũ</span>
                    ) : null}
                  </div>
                  {nextDueCharge.discountLabels?.length ? (
                    <p className="mt-3 text-xs text-emerald-700">{nextDueCharge.discountLabels.join(" + ")}</p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Còn phải đóng</p>
                  <p className="mt-1 text-xl font-semibold text-amber-800">{formatVnd(nextDueCharge.remainingAmount)}</p>
                  <p className="text-xs text-amber-700">Đã thu {formatVnd(nextDueCharge.paidAmount)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[20px] border border-[#e8eefb] bg-[#fbfdff] p-4">
                <p className="text-xs text-ink-muted48">Học phí</p>
                <p className="mt-1 text-base font-semibold text-ink">{formatVnd(nextDueCharge.tuitionAmount)}</p>
              </div>
              <div className="rounded-[20px] border border-[#e8eefb] bg-[#fbfdff] p-4">
                <p className="text-xs text-ink-muted48">Sách / phát sinh</p>
                <p className="mt-1 text-base font-semibold text-ink">{formatVnd(nextDueCharge.materialsAmount)}</p>
              </div>
              <div className="rounded-[20px] border border-[#e8eefb] bg-[#fbfdff] p-4">
                <p className="text-xs text-ink-muted48">Nợ đầu kỳ</p>
                <p className="mt-1 text-base font-semibold text-ink">{formatVnd(nextDueCharge.openingBalance)}</p>
              </div>
              <div className="rounded-[20px] border border-[#e8eefb] bg-[#fbfdff] p-4">
                <p className="text-xs text-ink-muted48">Tổng phiếu</p>
                <p className="mt-1 text-base font-semibold text-ink">{formatVnd(nextDueCharge.totalAmount)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {upcomingOtherCharges.length > 0
              ? `Không có kỳ nào đến hạn ngay bây giờ — còn ${upcomingOtherCharges.length} kỳ trả góp sắp tới chưa tới hạn (xem bên dưới).`
              : "Đã thu đủ toàn bộ, không còn khoản nào."}
          </div>
        )}
      </section>
      </div>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="rounded-[28px] border border-hairline bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-ink">Các kỳ còn treo</h3>
              <p className="mt-1 text-sm text-ink-muted48">Các kỳ chưa thu xong ngoài khoản đang ưu tiên.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{otherOpenCharges.length} kỳ khác</span>
          </div>

          <div className="mt-4 space-y-3">
            {overdueOtherCharges.map((charge) => (
              <div key={charge.id} className="rounded-[22px] border border-[#e8eefb] bg-[#fbfdff] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{charge.periodName}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{charge.className}</span>
                      {charge.openingBalance > 0 ? <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Có nợ cũ</span> : null}
                    </div>
                    {charge.discountLabels?.length ? <p className="mt-2 text-xs text-emerald-700">{charge.discountLabels.join(" + ")}</p> : null}
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Còn nợ</p>
                    <p className="mt-1 text-base font-semibold text-amber-800">{formatVnd(charge.remainingAmount)}</p>
                    <p className="text-xs text-amber-700">Đã thu {formatVnd(charge.paidAmount)}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs text-ink-muted48">Học phí</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{formatVnd(charge.tuitionAmount)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs text-ink-muted48">Sách</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{formatVnd(charge.materialsAmount)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs text-ink-muted48">Nợ đầu kỳ</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{formatVnd(charge.openingBalance)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs text-ink-muted48">Tổng phiếu</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{formatVnd(charge.totalAmount)}</p>
                  </div>
                </div>
              </div>
            ))}

            {upcomingOtherCharges.length > 0 ? (
              <div className="rounded-[22px] border border-dashed border-sky-200 bg-sky-50/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Các kỳ sắp tới</p>
                <div className="mt-3 space-y-2">
                  {upcomingOtherCharges.map((charge) => (
                    <div key={charge.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{charge.periodName}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{charge.className}</span>
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                          Đến hạn {new Date(charge.startDate).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-ink-muted80">{formatVnd(charge.remainingAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {otherOpenCharges.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-hairline bg-[#fbfdff] px-4 py-3 text-sm text-ink-muted48">
                {nextDueCharge ? "Không còn kỳ treo nào khác ngoài kỳ đang ưu tiên thu." : "Hiện chưa có công nợ mở."}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-hairline bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-ink">Sách</h3>
              <p className="mt-1 text-sm text-ink-muted48">Gồm sách chuẩn của khóa và sách mua thêm.</p>
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

          <div className="mt-4 space-y-4">
            <div className="rounded-[22px] border border-[#e8eefb] bg-[#fbfdff] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">Sách chuẩn của khóa</p>
                <span className="text-xs text-ink-muted48">{bookRequirements.length} yêu cầu</span>
              </div>

              <div className="mt-3 space-y-3">
                {bookRequirements.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white bg-white p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.bookName}</p>
                        <p className="mt-1 text-xs text-ink-muted48">
                          {item.className} · SL {item.quantity} · {formatVnd(item.totalAmount)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${requirementClass(item.status)}`}>{requirementLabel(item.status)}</span>
                        <button
                          type="button"
                          onClick={() => updateBookRequirement(item.id, "CONFIRMED")}
                          disabled={updatingRequirementId === item.id || item.status === "CONFIRMED"}
                          className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Xác nhận mua
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBookRequirement(item.id, "DECLINED")}
                          disabled={updatingRequirementId === item.id || item.status === "DECLINED"}
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Không mua
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {bookRequirements.length === 0 ? <p className="text-sm text-ink-muted48">Chưa có yêu cầu sách chuẩn nào.</p> : null}
              </div>
            </div>

            <div className="rounded-[22px] border border-[#e8eefb] bg-[#fbfdff] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Sách mua thêm / chưa thu</p>
                  <p className="mt-1 text-xs text-ink-muted48">Chỉ hiện những dòng còn treo tiền.</p>
                </div>
              </div>

              {canManageInventory && showIssueComposer ? (
                <form onSubmit={handleIssueBook} className="mt-4 space-y-4 rounded-2xl border border-white bg-white p-4">
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

              <div className="mt-4 space-y-3">
                {unpaidBooks.map((issue) => (
                  <div key={issue.id} className="rounded-2xl border border-white bg-white p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink">{issue.bookName}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bookPaymentClass(issue.paymentStatus)}`}>
                            {bookPaymentLabel(issue.paymentStatus)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-muted48">
                          {issue.className ?? "Chưa gắn lớp"} · SL {issue.quantity} · {formatDate(issue.issueDate)}
                        </p>
                        {issue.notes ? <p className="mt-2 text-xs text-ink-muted48">{issue.notes}</p> : null}
                      </div>

                      <div className="text-left lg:text-right">
                        <p className="text-sm font-semibold text-ink">{formatVnd(issue.amount)}</p>
                        {canManageInventory ? (
                          <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
                            <button
                              type="button"
                              onClick={() => updateBookPaymentStatus(issue.id, "PAID")}
                              disabled={updatingBookIssueId === issue.id}
                              className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
                            >
                              Đã thu
                            </button>
                            <button
                              type="button"
                              onClick={() => updateBookPaymentStatus(issue.id, "PARTIAL")}
                              disabled={updatingBookIssueId === issue.id}
                              className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                            >
                              Đã thu một phần
                            </button>
                            <button
                              type="button"
                              onClick={() => updateBookPaymentStatus(issue.id, "UNPAID")}
                              disabled={updatingBookIssueId === issue.id}
                              className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                            >
                              Chưa thu
                            </button>
                            <ConfirmActionButton
                              title="Xác nhận xóa sách phát sinh?"
                              description="Hệ thống sẽ hoàn tác dòng này khỏi công nợ và tồn kho nếu khoản sách vẫn chưa thu."
                              confirmLabel="Xóa dòng sách"
                              tone="danger"
                              disabled={deletingBookIssueId === issue.id}
                              className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              onConfirm={() => deleteBookIssue(issue.id)}
                            >
                              {deletingBookIssueId === issue.id ? "Đang xóa..." : "Xóa"}
                            </ConfirmActionButton>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}

                {unpaidBooks.length === 0 ? <p className="text-sm text-emerald-700">Không còn dòng sách nào đang treo tiền.</p> : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SlideOver
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
      </SlideOver>

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
