"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import DatePicker from "@/components/ui/DatePicker";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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
  /** Charge mà tiền sách này đã được cộng vào. Null = chưa vào công nợ của ai. */
  chargeId?: string | null;
  chargePeriodName?: string | null;
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
  // Mặc định thu tiền ngay — đúng thực tế: đưa sách là thu tiền luôn, chỉ khi phụ
  // huynh khất mới ghi nợ vào kỳ học phí.
  const [paidNow, setPaidNow] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueNotice, setIssueNotice] = useState<string | null>(null);
  const [issueWarning, setIssueWarning] = useState<string | null>(null);
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
  const openCharges = useMemo(() => charges.filter((charge) => charge.remainingAmount > 0), [charges]);
  const today = useMemo(() => getVietnamToday(), []);
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

  // Từng lớp = 1 gói thu riêng. Với lớp thu THEO THÁNG, chỉ ghi nhãn "đang thu theo
  // tháng" là vô dụng — phải liệt kê được đúng các tháng đã sinh phí, mỗi tháng bao
  // nhiêu, đã thu bao nhiêu, còn lại bao nhiêu, và tổng của cả gói, thì mới đối chiếu
  // được với phụ huynh. Dữ liệu lấy từ chính charges đã có, chỉ là trước đây bị trộn
  // chung mọi lớp vào 1 bảng nên không soi theo lớp được.
  const classPackages = useMemo(() => {
    return activeEnrollmentOptions.map((enrollment) => {
      const rows = charges
        .filter((charge) => charge.classId === enrollment.classId)
        .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime());
      return {
        enrollment,
        rows,
        // Cộng theo tiền RIÊNG của từng kỳ (học phí + sách), KHÔNG dùng totalAmount:
        // totalAmount đã gộp sẵn nợ cũ (openingBalance) của kỳ trước, cộng dồn qua
        // nhiều kỳ sẽ đếm trùng khoản nợ đó nhiều lần — xem chargeOwnDueAmount ở
        // lib/server/tuition-rules.ts. Cộng đúng thì 3 số khớp nhau: tổng - đã thu = còn lại.
        total: rows.reduce((sum, charge) => sum + charge.tuitionAmount + charge.materialsAmount, 0),
        paid: rows.reduce((sum, charge) => sum + charge.paidAmount, 0),
        remaining: rows.reduce((sum, charge) => sum + charge.remainingAmount, 0),
        // Chỉ đếm kỳ THẬT SỰ có phát sinh học phí/sách; kỳ trống (chỉ mang nợ cũ sang)
        // không tính là "đã thu xong" vì chưa từng phải thu gì.
        billedCount: rows.filter((charge) => charge.tuitionAmount + charge.materialsAmount > 0).length,
        settledCount: rows.filter(
          (charge) => charge.tuitionAmount + charge.materialsAmount > 0 && charge.remainingAmount <= 0,
        ).length,
      };
    });
  }, [activeEnrollmentOptions, charges]);

  // Các kỳ không thuộc lớp nào đang học (lớp đã kết thúc/đã chuyển) — vẫn phải hiện vì
  // tiền vẫn là nợ thật, nhưng tách riêng để không lẫn vào gói đang chạy.
  const orphanCharges = useMemo(() => {
    const activeClassIds = new Set(activeEnrollmentOptions.map((item) => item.classId));
    return charges
      .filter((charge) => !activeClassIds.has(charge.classId))
      .sort((left, right) => new Date(right.startDate).getTime() - new Date(left.startDate).getTime());
  }, [charges, activeEnrollmentOptions]);

  // Tiền sách chỉ thật sự thành công nợ khi lần xuất được gắn vào 1 Charge. Nếu không
  // gắn được (chưa có kỳ thu chứa ngày xuất, kỳ đã khóa sổ, hoặc học viên chưa có
  // charge kỳ đó) thì sách đã giao nhưng KHÔNG ai bị tính tiền — trước đây màn hình
  // này không hề nói ra, nên tiền thất thoát im lặng.
  const bookMoney = useMemo(() => {
    // Sách thu tiền mặt tại chỗ KHÔNG nằm trong công nợ — đó là đúng, không phải lỗi.
    // Chỉ sách vừa chưa thu tiền vừa chưa ghi nợ vào kỳ nào mới là khoản bị bỏ sót.
    const cashPaid = bookIssues.filter((issue) => !issue.chargeId && issue.paymentStatus === "PAID");
    const missed = bookIssues.filter((issue) => !issue.chargeId && issue.paymentStatus !== "PAID");
    return {
      total: bookIssues.reduce((sum, issue) => sum + issue.amount, 0),
      cashPaidAmount: cashPaid.reduce((sum, issue) => sum + issue.amount, 0),
      billedAmount: bookIssues.filter((issue) => issue.chargeId).reduce((sum, issue) => sum + issue.amount, 0),
      missedAmount: missed.reduce((sum, issue) => sum + issue.amount, 0),
      missedCount: missed.length,
    };
  }, [bookIssues]);

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

  // Gộp sách chuẩn của khóa và sách đã xuất vào 1 danh sách. Cố tình hiện CẢ sách đã
  // thu xong — trước đây lọc bỏ (chỉ giữ unpaid) nên sách đã thu biến mất khỏi màn
  // hình, không còn cách nào đối chiếu lại đã thu những gì.
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
    const issueRows: BookRow[] = bookIssues.map((issue) => ({
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
  }, [bookRequirements, bookIssues]);

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
    setIssueWarning(null);

    const response = await fetch(`/api/books/${selectedBookId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        classId: selectedClassId || activeEnrollmentOptions[0]?.classId || undefined,
        quantity: Number(quantity),
        issueDate,
        notes: issueNotes,
        paidNow,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setIssuing(false);

    if (!response.ok) {
      setIssueError(data.error ?? "Không thể thêm phát sinh sách.");
      return;
    }

    // 3 kết cục khác nhau, phải nói rõ cái nào vừa xảy ra:
    // (1) thu tiền ngay → không thành công nợ; (2) ghi nợ vào đúng kỳ; (3) không gắn
    // được kỳ nào → sách đã giao mà không ai bị tính tiền, phải cảnh báo đỏ.
    if (data.paidNow) {
      setIssueNotice([data.warning, "Đã xuất sách và thu tiền ngay — không cộng vào công nợ."].filter(Boolean).join(" "));
      setIssueWarning(null);
    } else if (data.chargeUpdated) {
      setIssueNotice(
        [
          data.warning,
          `Đã ghi nợ tiền sách vào kỳ ${data.chargePeriodName ?? "đang mở"}${
            data.deferredToNextPeriod ? " (kỳ của tháng xuất sách đã thu đủ nên chuyển sang kỳ kế tiếp)" : ""
          }.`,
        ]
          .filter(Boolean)
          .join(" "),
      );
      setIssueWarning(null);
    } else {
      setIssueNotice(null);
      setIssueWarning(
        [
          data.warning,
          "Đã xuất sách NHƯNG chưa ghi được nợ vào kỳ thu nào (chưa có kỳ thu, kỳ đã khóa sổ, hoặc học viên chưa có khoản thu của kỳ nào còn mở). Khoản này hiện không nằm trong công nợ — cần sinh/mở kỳ thu rồi xử lý.",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }
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
    <div className="space-y-4">
      {/* Mỗi lớp = 1 gói thu riêng. Với lớp thu theo tháng, phải nhìn được đủ: các kỳ
          đã sinh, mỗi kỳ bao nhiêu, đã thu bao nhiêu, còn lại bao nhiêu và tổng cả gói. */}
      {classPackages.map((pkg) => {
        const isPeriod = pkg.enrollment.billingModel === "PERIOD";
        return (
          <section key={pkg.enrollment.enrollmentId} className="rounded-xl border border-[#e5eaf7] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f5f9] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-[#0f1729]">{pkg.enrollment.className}</p>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Đang thu {billingModeLabel(pkg.enrollment.billingModel).toLowerCase()}
                  {isPeriod ? ` · ${pkg.billedCount} kỳ có học phí · đã thu xong ${pkg.settledCount}/${pkg.billedCount}` : ""}
                </p>
              </div>
              {canManageFinance ? (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => switchBillingMode(pkg.enrollment.enrollmentId, pkg.enrollment.classId, "PERIOD", pkg.enrollment.className)}
                    disabled={switchingEnrollmentId === pkg.enrollment.enrollmentId || isPeriod}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      isPeriod
                        ? "bg-[#0f1729] text-white"
                        : "border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#0f1729] disabled:opacity-60"
                    }`}
                  >
                    Theo tháng
                  </button>
                  <button
                    type="button"
                    onClick={() => switchBillingMode(pkg.enrollment.enrollmentId, pkg.enrollment.classId, "COURSE", pkg.enrollment.className)}
                    disabled={switchingEnrollmentId === pkg.enrollment.enrollmentId || pkg.enrollment.billingModel === "COURSE"}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      pkg.enrollment.billingModel === "COURSE"
                        ? "bg-[#0f1729] text-white"
                        : "border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#0f1729] disabled:opacity-60"
                    }`}
                  >
                    Theo khóa
                  </button>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-3 divide-x divide-[#f1f5f9] border-b border-[#f1f5f9] text-center">
              <div className="px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-[#94a3b8]">Tổng phải thu</p>
                <p className="mt-0.5 text-base font-black text-[#0f1729]">{formatVnd(pkg.total)}</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-[#94a3b8]">Đã thu</p>
                <p className="mt-0.5 text-base font-black text-[#0f1729]">{formatVnd(pkg.paid)}</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-[#94a3b8]">Còn phải thu</p>
                <p className={`mt-0.5 text-base font-black ${pkg.remaining > 0 ? "text-[#dc2626]" : "text-[#0f1729]"}`}>
                  {formatVnd(pkg.remaining)}
                </p>
              </div>
            </div>

            {pkg.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[#f1f5f9] text-left text-[11px] uppercase tracking-wide text-[#94a3b8]">
                      <th className="px-4 py-2 font-semibold">Kỳ thu</th>
                      <th className="px-3 py-2 font-semibold">Học phí</th>
                      <th className="px-3 py-2 font-semibold">Sách</th>
                      <th className="px-3 py-2 font-semibold">Nợ cũ</th>
                      <th className="px-3 py-2 font-semibold">Đã thu</th>
                      <th className="px-4 py-2 text-right font-semibold">Còn lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkg.rows.map((charge) => {
                      const isClosed = charge.remainingAmount <= 0;
                      const isUpcoming = !isClosed && new Date(charge.startDate).getTime() > today.getTime();
                      // Kỳ không phát sinh học phí/sách riêng (chỉ mang nợ cũ sang) thì
                      // KHÔNG được ghi "đã thu đủ" — chưa thu đồng nào, chỉ là kỳ trống.
                      const hasOwnCharge = charge.tuitionAmount + charge.materialsAmount > 0;
                      return (
                        <tr key={charge.id} className="border-b border-[#f8fafc] last:border-0">
                          <td className="px-4 py-2.5 align-top">
                            <p className="font-bold text-[#0f1729]">{charge.periodName}</p>
                            <p className="mt-0.5 text-xs text-[#94a3b8]">
                              {!hasOwnCharge
                                ? "Không phát sinh học phí kỳ này"
                                : isClosed
                                  ? "Đã thu đủ"
                                  : isUpcoming
                                    ? `Đến hạn ${new Date(charge.startDate).toLocaleDateString("vi-VN")}`
                                    : charge.id === nextDueCharge?.id
                                      ? "Cần thu ngay"
                                      : "Còn nợ"}
                              {charge.discountLabels?.length ? ` · ${charge.discountLabels.join(" + ")}` : ""}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 align-top text-[#475569]">{formatVnd(charge.tuitionAmount)}</td>
                          <td className="px-3 py-2.5 align-top text-[#475569]">{formatVnd(charge.materialsAmount)}</td>
                          <td className="px-3 py-2.5 align-top text-[#475569]">{formatVnd(charge.openingBalance)}</td>
                          <td className="px-3 py-2.5 align-top text-[#475569]">{formatVnd(charge.paidAmount)}</td>
                          <td className="px-4 py-2.5 text-right align-top">
                            <p className={`font-black ${charge.remainingAmount > 0 ? "text-[#dc2626]" : "text-[#0f1729]"}`}>
                              {formatVnd(charge.remainingAmount)}
                            </p>
                            {charge.remainingAmount > 0 && canManageFinance ? (
                              <div className="mt-1.5 flex justify-end">
                                <QuickPaymentButton studentId={studentId} suggestedAmount={charge.remainingAmount} />
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-3 text-sm text-[#94a3b8]">
                {isPeriod
                  ? "Chưa sinh kỳ thu nào cho lớp này — chạy sinh học phí theo tháng ở trang Học phí thì các tháng cần thu sẽ hiện ở đây."
                  : "Chưa lập khoản thu nào cho lớp này."}
              </p>
            )}
          </section>
        );
      })}

      {activeEnrollmentOptions.length === 0 ? (
        <p className="rounded-xl border border-[#e5eaf7] bg-white px-4 py-3 text-sm text-[#94a3b8]">
          Học viên chưa có lớp đang học nên chưa có gói thu nào.
        </p>
      ) : null}

      {billingModeMessage ? (
        <p className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-4 py-2.5 text-sm text-[#475569]">{billingModeMessage}</p>
      ) : null}

      {orphanCharges.length > 0 ? (
        <section className="rounded-xl border border-[#e5eaf7] bg-white">
          <div className="border-b border-[#f1f5f9] px-4 py-3">
            <p className="text-sm font-black text-[#0f1729]">Kỳ thu của lớp đã kết thúc</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <tbody>
                {orphanCharges.map((charge) => (
                  <tr key={charge.id} className="border-b border-[#f8fafc] last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-[#0f1729]">{charge.periodName}</p>
                      <p className="mt-0.5 text-xs text-[#94a3b8]">{charge.className}</p>
                    </td>
                    <td className="px-3 py-2.5 text-[#475569]">Đã thu {formatVnd(charge.paidAmount)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <p className={`font-black ${charge.remainingAmount > 0 ? "text-[#dc2626]" : "text-[#0f1729]"}`}>
                        {formatVnd(charge.remainingAmount)}
                      </p>
                      {charge.remainingAmount > 0 && canManageFinance ? (
                        <div className="mt-1.5 flex justify-end">
                          <QuickPaymentButton studentId={studentId} suggestedAmount={charge.remainingAmount} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-[#e5eaf7] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-[#0f1729]">Giáo trình</p>
            <p className="mt-0.5 text-xs text-[#64748b]">
              Đã xuất {formatVnd(bookMoney.total)} · thu tiền mặt {formatVnd(bookMoney.cashPaidAmount)} · ghi nợ vào kỳ thu{" "}
              {formatVnd(bookMoney.billedAmount)}
              {bookMoney.missedAmount > 0 ? ` · chưa xử lý ${formatVnd(bookMoney.missedAmount)}` : ""}
              {` · sách chuẩn chờ xác nhận ${requirementStats.pending}`}
            </p>
          </div>
          {canManageInventory ? (
            <button
              type="button"
              onClick={() => setShowIssueComposer((current) => !current)}
              className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-bold text-[#0f1729] hover:border-[#f97316] hover:text-[#f97316]"
            >
              {showIssueComposer ? "Đóng" : "Xuất giáo trình"}
            </button>
          ) : null}
        </div>

        {/* Sách đã giao nhưng tiền không gắn được vào kỳ thu nào = trung tâm mất tiền mà
            không ai biết. Phải nổi lên ngay, không ẩn trong dòng trạng thái. */}
        {bookMoney.missedCount > 0 ? (
          <p className="mt-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm font-semibold text-[#b91c1c]">
            {bookMoney.missedCount} lần xuất sách ({formatVnd(bookMoney.missedAmount)}) chưa thu tiền mà cũng chưa ghi nợ vào kỳ thu nào — cần thu tiền mặt hoặc ghi vào kỳ học phí.
          </p>
        ) : null}

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

            <div className="space-y-2">
              <span className="label-sm">Tiền sách</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPaidNow(true)}
                  className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${
                    paidNow ? "bg-[#0f1729] text-white" : "border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#0f1729]"
                  }`}
                >
                  Thu tiền ngay
                </button>
                <button
                  type="button"
                  onClick={() => setPaidNow(false)}
                  className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${
                    !paidNow ? "bg-[#0f1729] text-white" : "border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#0f1729]"
                  }`}
                >
                  Chưa thu — ghi nợ vào kỳ học phí
                </button>
              </div>
              <p className="text-xs text-[#64748b]">
                {paidNow
                  ? "Thu tiền mặt lúc đưa sách — không cộng vào công nợ học phí."
                  : "Cộng vào kỳ học phí của tháng xuất sách; nếu tháng đó đã thu đủ thì tự chuyển sang kỳ kế tiếp."}
              </p>
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
            {issueWarning ? <div className="alert-danger">{issueWarning}</div> : null}
            {issueNotice ? <div className="alert-success">{issueNotice}</div> : null}
            {bookStatusError ? <div className="alert-danger">{bookStatusError}</div> : null}

            <button type="submit" disabled={issuing || !canIssueBooks} className="btn-primary">
              {issuing ? "Đang lưu..." : "Thêm sách"}
            </button>
          </form>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-base">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-muted48">
                <th className="px-3 pb-1">Đầu sách</th>
                <th className="px-3 pb-1">Lớp</th>
                <th className="px-3 pb-1">SL</th>
                <th className="px-3 pb-1">Tiền</th>
                <th className="px-3 pb-1">Đã tính vào</th>
                <th className="px-3 pb-1">Trạng thái</th>
                <th className="px-3 pb-1 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {bookTableRows.map((row) => (
                <tr key={row.key} className="bg-[#fbfdff]">
                  <td className="rounded-l-2xl px-3 py-3 align-top">
                    <p className="font-semibold text-ink">{row.bookName}</p>
                    <p className="mt-0.5 text-xs text-ink-muted48">{row.kind === "requirement" ? "Sách chuẩn" : "Phát sinh"}</p>
                  </td>
                  <td className="px-3 py-3 align-top text-ink-muted80">{row.className}</td>
                  <td className="px-3 py-3 align-top text-ink-muted80">{row.quantity}</td>
                  <td className="px-3 py-3 align-top text-ink-muted80">{formatVnd(row.amount)}</td>
                  <td className="px-3 py-3 align-top text-xs">
                    {row.kind === "requirement" ? (
                      <span className="text-ink-muted48">Chưa xuất</span>
                    ) : row.issue?.chargeId ? (
                      <span className="text-ink-muted80">Kỳ {row.issue.chargePeriodName ?? "đã gắn"}</span>
                    ) : row.issue?.paymentStatus === "PAID" ? (
                      <span className="text-ink-muted80">Thu tiền mặt</span>
                    ) : (
                      <span className="font-bold text-[#b91c1c]">Chưa thu, chưa ghi nợ</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {/* Sách đã ghi nợ vào kỳ thu thì tình trạng thu do CHÍNH kỳ đó quyết
                        định — không hiện nhãn thủ công song song, vì 2 nguồn sẽ mâu thuẫn
                        (dữ liệu hiện có đúng 1 dòng vừa đánh dấu đã thu vừa nằm trong nợ). */}
                    {row.kind === "issue" && row.issue?.chargeId ? (
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        Thu theo kỳ học phí
                      </span>
                    ) : (
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.statusClass}`}>{row.statusLabel}</span>
                    )}
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
                        {/* Chỉ sách CHƯA ghi nợ vào kỳ nào mới cần đánh dấu thu bằng tay
                            (trường hợp thu tiền mặt tại chỗ). */}
                        {!row.issue.chargeId ? (
                          <>
                            <button
                              type="button"
                              onClick={() => updateBookPaymentStatus(row.issue!.id, "PAID")}
                              disabled={updatingBookIssueId === row.issue.id || row.issue.paymentStatus === "PAID"}
                              className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                            >
                              Đã thu
                            </button>
                            <button
                              type="button"
                              onClick={() => updateBookPaymentStatus(row.issue!.id, "UNPAID")}
                              disabled={updatingBookIssueId === row.issue.id || row.issue.paymentStatus === "UNPAID"}
                              className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-50"
                            >
                              Chưa thu
                            </button>
                          </>
                        ) : null}
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
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-ink-muted48">
                    Chưa có sách chuẩn của khóa và chưa xuất giáo trình nào.
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
