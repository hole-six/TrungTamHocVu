"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import BookBasketPicker, { basketQuantity, basketTotal, type Basket, type BookOption } from "@/components/inventory/BookBasketPicker";
import { formatVnd } from "@/lib/export-utils";

type StudentHit = {
  id: string;
  fullName: string;
  studentCode: string;
  phone?: string | null;
  currentClassCode?: string | null;
  currentClassName?: string | null;
  enrollments?: Array<{ status: string; classId: string | null; class?: { classCode: string; className: string } | null }>;
};

const ISSUE_BOOK_GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng form xuất sách?",
    items: [
      "Dùng khi trung tâm thực sự giao sách/giáo trình cho một học viên.",
      "Đây là thao tác xuất kho nên sau khi lưu, tồn kho sẽ giảm ngay.",
      "Chỉ nên bấm khi đã xác nhận đúng học viên và đúng số lượng giao thực tế.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác đúng",
    items: [
      "Tìm đúng học viên theo tên, mã học viên, lớp hoặc số điện thoại.",
      "Chọn cả bộ sách cần giao (nhiều đầu sách, nhiều danh mục) rồi ghi nhận một lần.",
      "Chọn đã thu tiền ngay hay cộng vào học phí kỳ này để thu chung.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ gặp",
    items: [
      "Xuất nhầm cho học viên trùng tên mà không nhìn mã học viên.",
      "Xuất sai số lượng làm lệch tồn kho.",
      "Bấm xuất trước khi giao sách thật sẽ làm kho và thực tế bị lệch nhau.",
    ],
    tone: "warning" as const,
  },
];

const COMBINING_MARKS = /[̀-ͯ]/g;

// Tìm không phân biệt dấu / hoa thường: "nguyen" khớp "Nguyễn". Tìm ở CSDL (SQLite) phân
// biệt hoa-thường với chữ có dấu, nên trước đây gõ "nguyễn" không ra "Nguyễn" — trông như
// không lấy được danh sách học viên.
function normalize(value: string) {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

export default function IssueBookForm({
  bookId,
  bookName,
  bookCode,
  unitPrice,
  onHand,
  onDone,
  triggerClassName = "btn-primary",
}: {
  /** Dau sach mo form tu do - dien san 1 cuon vao gio. Khong co = chon tu dau. */
  bookId?: string;
  bookName?: string;
  bookCode?: string | null;
  unitPrice?: number;
  onHand?: number;
  onDone?: () => void;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<StudentHit[]>([]);
  const [total, setTotal] = useState(0);
  const [serverHits, setServerHits] = useState<StudentHit[]>([]);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [classId, setClassId] = useState("");
  const [books, setBooks] = useState<BookOption[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [basket, setBasket] = useState<Basket>({});
  const [paidNow, setPaidNow] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Mở form là có ngay danh sách học viên đang học — không bắt gõ rồi bấm "Tìm" mới thấy ai.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setListLoading(true);
    setError(null);
    fetch("/api/students?status=ACTIVE&pageSize=100")
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setError(data.error ?? "Không tải được danh sách học viên.");
          return;
        }
        setStudents(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setError("Không tải được danh sách học viên.");
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Danh mục sách để chọn cả bộ — tải 1 lần khi mở form.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBooksLoading(true);
    fetch("/api/books")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        return (data.items ?? []) as BookOption[];
      })
      .then((items) => {
        if (cancelled) return;
        setBooks(items);
        setBasket(bookId ? { [bookId]: 1 } : {});
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setBooksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookId]);

  // Hơn 100 học viên thì danh sách tải sẵn chưa đủ — tìm thêm ở máy chủ khi gõ.
  useEffect(() => {
    if (!open || total <= students.length || q.trim().length < 2) {
      setServerHits([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const res = await fetch(`/api/students?status=ACTIVE&pageSize=30&q=${encodeURIComponent(q.trim())}`);
      const data = await res.json().catch(() => ({}));
      setServerHits(data.items ?? []);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, q, total, students.length]);

  const filtered = useMemo(() => {
    const keyword = normalize(q);
    const pool = [...students, ...serverHits.filter((hit) => !students.some((s) => s.id === hit.id))];
    const matches = keyword
      ? pool.filter((s) =>
          normalize([s.fullName, s.studentCode, s.phone ?? "", s.currentClassCode ?? "", s.currentClassName ?? ""].join(" ")).includes(keyword),
        )
      : pool;
    // Học viên đang có lớp lên trước — em chưa có lớp thì chưa xuất sách được.
    const hasClass = (s: StudentHit) => ((s.enrollments ?? []).some((e) => e.status === "ACTIVE" && e.classId) ? 0 : 1);
    return [...matches].sort((a, b) => hasClass(a) - hasClass(b)).slice(0, 60);
  }, [q, students, serverHits]);

  const activeClasses = (selected?.enrollments ?? []).filter((e) => e.status === "ACTIVE" && e.classId && e.class);
  const pickedCount = basketQuantity(basket);
  const amount = basketTotal(basket, books);

  function pick(student: StudentHit) {
    setSelected(student);
    setError(null);
    setNotice(null);
    const active = (student.enrollments ?? []).filter((e) => e.status === "ACTIVE" && e.classId);
    setClassId(active.length === 1 ? active[0].classId ?? "" : "");
  }

  async function issue() {
    if (!selected) return;
    if (pickedCount <= 0) {
      setError("Chưa chọn sách nào để xuất.");
      return;
    }
    if (activeClasses.length === 0) {
      setError("Học viên chưa có lớp đang học nên không xuất sách được.");
      return;
    }
    // API bắt buộc chọn lớp khi học viên học nhiều lớp — trước đây form không có ô chọn nên
    // xuất cho những em này luôn báo lỗi.
    if (activeClasses.length > 1 && !classId) {
      setError("Học viên đang học nhiều lớp — chọn lớp cần gắn sách.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/book-issues/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: selected.id,
        classId: classId || undefined,
        paidNow,
        items: Object.entries(basket)
          .filter(([, value]) => value > 0)
          .map(([id, value]) => ({ bookId: id, quantity: value })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể xuất sách.");
      return;
    }
    setNotice(
      [
        `Đã xuất ${data.totalQuantity ?? pickedCount} cuốn (${data.bookCount ?? 0} đầu sách) cho ${selected.fullName} — ${formatVnd(data.totalAmount ?? amount)}.`,
        paidNow ? "Đã thu tiền ngay." : data.chargeUpdated ? `Đã ghi vào kỳ học phí ${data.chargePeriodName ?? "đang mở"}.` : null,
        data.unlinkedCount ? `${data.unlinkedCount} đầu sách chưa ghi được vào kỳ thu nào — cần kiểm tra kỳ học phí.` : null,
        ...(data.warnings ?? []),
      ]
        .filter(Boolean)
        .join(" "),
    );
    setSelected(null);
    setBasket(bookId ? { [bookId]: 1 } : {});
    onDone?.();
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        Xuất cho học viên
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Xuất giáo trình"
        description="Chọn học viên nhận sách, số lượng và cách thu tiền."
        guide={<FormGuide title="Hướng dẫn xuất giáo trình" summary="Đây là bước xuất kho cho học viên. Người vận hành chỉ cần nhớ: đúng học viên, đúng số lượng, đúng thời điểm đã giao thực tế." sections={ISSUE_BOOK_GUIDE_SECTIONS} position="inline" />}
      >
        <div className="space-y-4">
          {bookName ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Mở từ đầu sách</p>
              <p className="mt-0.5 truncate text-base font-bold text-[#0f1729]">{bookName ?? "—"}</p>
              {bookCode && bookCode.trim() !== "0" ? <p className="font-mono text-xs text-[#64748b]">{bookCode}</p> : null}
            </div>
            <div className="flex gap-5 text-right">
              {unitPrice != null ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Giá bán</p>
                  <p className="text-base font-bold tabular-nums text-[#0f1729]">{formatVnd(unitPrice)}</p>
                </div>
              ) : null}
              {onHand != null ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Tồn kho</p>
                  <p className={`text-base font-bold tabular-nums ${onHand <= 0 ? "text-[#dc2626]" : "text-[#0f1729]"}`}>{onHand}</p>
                </div>
              ) : null}
            </div>
          </div>
          ) : null}

          {notice ? <p className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f1729]">{notice}</p> : null}

          {selected ? (
            <div className="space-y-4 rounded-xl border border-[#0f1729] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Học viên nhận sách</p>
                  <p className="mt-0.5 text-base font-bold text-[#0f1729]">{selected.fullName}</p>
                  <p className="font-mono text-xs text-[#64748b]">{selected.studentCode}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="btn-ghost-sm">
                  Chọn người khác
                </button>
              </div>

              <div className="grid gap-4">
                <div className="form-group">
                  <span className="label-sm">Lớp gắn sách</span>
                  {activeClasses.length > 1 ? (
                    <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                      <option value="">-- Chọn lớp --</option>
                      {activeClasses.map((e) => (
                        <option key={e.classId} value={e.classId ?? ""}>
                          {e.class?.classCode} · {e.class?.className}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="input flex items-center bg-[#f8fafc] text-[#0f1729]">
                      {activeClasses[0]?.class ? `${activeClasses[0].class.classCode} · ${activeClasses[0].class.className}` : "Chưa có lớp đang học"}
                    </p>
                  )}
                </div>
              </div>

              <BookBasketPicker books={books} basket={basket} onChange={setBasket} loading={booksLoading} />

              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: true, title: "Đã thu tiền ngay", hint: "Thu lúc đưa sách, không cộng vào học phí." },
                  { value: false, title: "Cộng vào học phí", hint: "Chưa thu — cộng vào phiếu học phí kỳ này để thu chung." },
                ].map((option) => (
                  <button
                    key={option.title}
                    type="button"
                    onClick={() => setPaidNow(option.value)}
                    className={`rounded-xl border p-3 text-left transition ${paidNow === option.value ? "border-[#0f1729] ring-1 ring-[#0f1729]" : "border-[#e2e8f0] hover:border-[#0f1729]"}`}
                  >
                    <p className="text-sm font-bold text-[#0f1729]">{option.title}</p>
                    <p className="mt-0.5 text-xs text-[#64748b]">{option.hint}</p>
                  </button>
                ))}
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button type="button" onClick={() => void issue()} disabled={loading || pickedCount === 0} className="btn-primary w-full">
                {loading
                  ? "Đang xuất..."
                  : pickedCount === 0
                    ? "Chọn sách để xuất"
                    : `Xuất ${pickedCount} cuốn · ${formatVnd(amount)} cho ${selected.fullName}`}
              </button>
            </div>
          ) : (
            <>
              <input
                className="input"
                placeholder="Tìm theo tên, mã học viên, lớp hoặc số điện thoại..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
              <div className="flex items-center justify-between gap-2 text-xs text-[#64748b]">
                <span>{listLoading ? "Đang tải danh sách học viên..." : `${filtered.length} học viên${q ? " khớp" : " đang học"}`}</span>
                {total > students.length ? <span>Gõ ít nhất 2 ký tự để tìm trong {total} học viên</span> : null}
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="max-h-[55vh] divide-y divide-[#f1f5f9] overflow-y-auto rounded-xl border border-[#e2e8f0]">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-[#f8fafc]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#0f1729]">{s.fullName}</span>
                      <span className="font-mono text-xs text-[#64748b]">{s.studentCode}</span>
                    </span>
                    <span className="shrink-0 rounded-md border border-[#e2e8f0] px-2 py-0.5 text-xs font-semibold text-[#475569]">
                      {s.currentClassCode ?? s.currentClassName ?? "Chưa có lớp"}
                    </span>
                  </button>
                ))}
                {!listLoading && filtered.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-[#64748b]">Không có học viên phù hợp.</p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </ResponsiveDrawer>
    </>
  );
}
