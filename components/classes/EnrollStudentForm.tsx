"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";

type StudentHit = { id: string; fullName: string; studentCode: string };
type InstallmentDraft = { dueMonth: string; amount: string };

function monthOffset(offset: number) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function splitInstallments(total: number, count: number): InstallmentDraft[] {
  const base = Math.floor(total / count / 1000) * 1000;
  return Array.from({ length: count }, (_, index) => ({
    dueMonth: monthOffset(index),
    amount: String(index === count - 1 ? total - base * (count - 1) : base),
  }));
}

const GUIDE_SECTIONS = [
  {
    title: "Form này giải quyết việc gì?",
    items: [
      "Dùng khi lớp đã có sẵn và bạn cần đưa một học viên đang hoạt động vào lớp đó.",
      "Đây là bước vừa ghi danh vào lớp, vừa chốt cách thu học phí ban đầu cho học viên này.",
      "Sau khi ghi danh xong, luồng học phí và phiếu thu của học viên sẽ đi theo lựa chọn ở đây.",
    ],
    tone: "info" as const,
  },
  {
    title: "Chọn đúng kiểu đóng tiền",
    items: [
      "Đóng trọn khóa: phù hợp khi phụ huynh chốt thanh toán toàn bộ khóa ngay từ đầu.",
      "Đóng theo tháng: phù hợp khi phụ huynh đóng theo từng kỳ/tháng học thực tế.",
      "Trả góp theo đợt: phù hợp khi muốn chốt sẵn các mốc phải thu theo tháng và số tiền từng đợt.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ sai nhất",
    items: [
      "Chọn nhầm học viên trùng tên, nên luôn nhìn thêm mã học viên trước khi xác nhận.",
      "Dựng lịch trả góp mà tổng tiền các đợt không hợp lý với tổng giá trị khóa.",
      "Chọn thu trọn khóa cho phụ huynh vẫn đang muốn đóng tháng sẽ làm batch học phí về sau nhìn sai mong đợi vận hành.",
    ],
    tone: "warning" as const,
  },
];

export default function EnrollStudentForm({
  classId,
  courseTotalAmount = 0,
  defaultMainSessionCount = 0,
  defaultUnitPrice = 0,
}: {
  classId: string;
  courseTotalAmount?: number;
  defaultMainSessionCount?: number;
  defaultUnitPrice?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [billingModel, setBillingModel] = useState<"COURSE" | "PERIOD" | "INSTALLMENT">("COURSE");
  const [installments, setInstallments] = useState<InstallmentDraft[]>(() => splitInstallments(courseTotalAmount, 3));
  const [mainSessionCount, setMainSessionCount] = useState(String(defaultMainSessionCount || ""));
  const [unitPrice, setUnitPrice] = useState(String(defaultUnitPrice || ""));
  const [paidCatchupSessionCount, setPaidCatchupSessionCount] = useState("0");
  const [paidCatchupUnitPrice, setPaidCatchupUnitPrice] = useState(String(defaultUnitPrice || ""));
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Luôn hiện sẵn 1 danh sách học viên duyệt được khi mở form (không bắt gõ tìm trước
  // mới thấy ai) — gõ vào ô tìm sẽ lọc lại theo tên/mã, debounce 300ms.
  useEffect(() => {
    if (!open || selected) return;
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const trimmed = q.trim();
      const response = await fetch(`/api/students?q=${encodeURIComponent(trimmed)}&status=ACTIVE&pageSize=30`);
      const result = await response.json().catch(() => ({}));
      if (!cancelled) {
        const items: StudentHit[] = result.items ?? [];
        setResults(trimmed ? items : [...items].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi")));
        setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, q, selected]);

  async function enroll() {
    if (!selected) return;
    if (installmentsMismatch) {
      setError("Tổng các đợt trả góp chưa khớp với tổng học phí — kiểm tra lại trước khi ghi danh.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/classes/${classId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: selected.id,
        billingModel,
        purchasedMainSessionCount: Number(mainSessionCount),
        tuitionUnitPriceSnapshot: Number(unitPrice),
        paidCatchupSessionCount: Number(paidCatchupSessionCount),
        paidCatchupUnitPrice: Number(paidCatchupUnitPrice || unitPrice),
        installments: billingModel === "INSTALLMENT" ? installments.map((item) => ({ ...item, amount: Number(item.amount) })) : undefined,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể ghi danh học viên.");
      return;
    }

    setSuccess(`Đã ghi danh ${selected.fullName} vào lớp.`);
    setSelected(null);
    setResults([]);
    setQ("");
    router.refresh();
  }

  const mainTuitionAmount = (Number(mainSessionCount) || 0) * (Number(unitPrice) || 0);
  const catchupAmount = (Number(paidCatchupSessionCount) || 0) * (Number(paidCatchupUnitPrice || unitPrice) || 0);
  const enrollmentTotalAmount = mainTuitionAmount + catchupAmount;
  const installmentsSum = installments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const installmentsDiff = enrollmentTotalAmount - installmentsSum;
  const installmentsMismatch = billingModel === "INSTALLMENT" && installmentsDiff !== 0;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Ghi danh học viên
      </button>

      <ResponsiveDrawer 
        open={open}
        onClose={() => setOpen(false)}
        title="Ghi danh học viên vào lớp"
        description="Tìm học viên đang hoạt động, chọn đúng người rồi chốt luôn cách thu học phí phù hợp với phụ huynh."
        guide={<FormGuide title="Hướng dẫn ghi danh học viên vào lớp" summary="Đây là một trong những form quan trọng nhất của vận hành vì nó nối học viên với lớp và kéo theo logic học phí phía sau. Chọn đúng học viên và đúng kiểu thu là mấu chốt." sections={GUIDE_SECTIONS} position="inline" />}
      >
        <div className="space-y-5">
          <input
            className="input"
            placeholder="Tìm theo tên hoặc mã học viên... (để trống để xem cả danh sách)"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            autoFocus
          />

          {results.length > 0 ? (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              <p className="text-sm font-medium text-ink-muted48">Chọn học viên phù hợp</p>
              {results.map((student) => (
                <button key={student.id} type="button" onClick={() => setSelected(selected?.id === student.id ? null : student)} className={selected?.id === student.id ? "search-result-item-active" : "search-result-item"}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{student.fullName}</p>
                      <p className="mt-1 text-xs font-mono text-ink-muted48">{student.studentCode}</p>
                    </div>
                    {selected?.id === student.id ? <span className="badge-green">Đã chọn</span> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {!results.length && !searching ? (
            <div className="empty-state rounded-2xl border border-dashed border-[#dbe7ff]">
              <p className="empty-state-title">Không tìm thấy học viên phù hợp</p>
              <p className="empty-state-desc">Thử tìm bằng mã học viên hoặc tên ngắn hơn.</p>
            </div>
          ) : null}

          {selected ? (
            <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Sẵn sàng ghi danh</p>
              <p className="mt-2 text-base font-semibold text-emerald-950">{selected.fullName}</p>
              <p className="mt-1 text-sm text-emerald-800">{selected.studentCode}</p>
              <div className="grid gap-3 border-t border-emerald-200 pt-4 md:grid-cols-2">
                <label className="form-group">
                  <span className="label-sm">Số buổi khóa chính</span>
                  <input type="number" min={1} className="input" value={mainSessionCount} onChange={(event) => setMainSessionCount(event.target.value)} />
                </label>
                <label className="form-group">
                  <span className="label-sm">Đơn giá khóa chính</span>
                  <CurrencyInput value={unitPrice} onChange={(next) => setUnitPrice(String(next))} />
                  <span className="text-[10px] leading-tight text-ink-muted48">{formatVnd(Number(unitPrice) || 0)}</span>
                </label>
                <label className="form-group">
                  <span className="label-sm">Buổi học thêm đầu khóa (tính phí)</span>
                  <input type="number" min={0} className="input" value={paidCatchupSessionCount} onChange={(event) => setPaidCatchupSessionCount(event.target.value)} />
                  <span className="text-[10px] leading-tight text-ink-muted48">Khác với "bổ trợ vắng" (miễn phí, sinh ra khi vắng buổi chính) — đây là buổi mua thêm riêng, có tính phí.</span>
                </label>
                <label className="form-group">
                  <span className="label-sm">Đơn giá buổi học thêm đầu khóa</span>
                  <CurrencyInput value={paidCatchupUnitPrice} onChange={(next) => setPaidCatchupUnitPrice(String(next))} />
                  <span className="text-[10px] leading-tight text-ink-muted48">{formatVnd(Number(paidCatchupUnitPrice || unitPrice) || 0)}</span>
                </label>
                <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Tạm tính</p>
                  <p className="mt-1 text-sm text-emerald-900">
                    Học phí khóa chính {formatVnd(mainTuitionAmount)} · buổi học thêm đầu khóa {formatVnd(catchupAmount)}
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-950">Tổng {formatVnd(enrollmentTotalAmount)}</p>
                </div>
              </div>
              <div className="border-t border-emerald-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Kế hoạch đóng học phí</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setBillingModel("COURSE")} className={`rounded-xl border p-3 text-left transition ${billingModel === "COURSE" ? "border-emerald-500 bg-white shadow-sm" : "border-emerald-200 bg-emerald-50/50"}`}>
                    <p className="text-sm font-semibold text-ink">Đóng trọn khóa</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted80">Tạo một khoản thu sau khi ghi danh; các kỳ tháng sau sẽ tự bỏ qua học viên này.</p>
                  </button>
                  <button type="button" onClick={() => setBillingModel("PERIOD")} className={`rounded-xl border p-3 text-left transition ${billingModel === "PERIOD" ? "border-emerald-500 bg-white shadow-sm" : "border-emerald-200 bg-emerald-50/50"}`}>
                    <p className="text-sm font-semibold text-ink">Đóng theo tháng</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted80">Sinh khoản thu theo từng kỳ tháng và chỉ tính các buổi thực tế từ ngày ghi danh.</p>
                  </button>
                  <button type="button" onClick={() => setBillingModel("INSTALLMENT")} className={`rounded-xl border p-3 text-left transition ${billingModel === "INSTALLMENT" ? "border-emerald-500 bg-white shadow-sm" : "border-emerald-200 bg-emerald-50/50"}`}>
                    <p className="text-sm font-semibold text-ink">Trả góp theo đợt</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted80">Chốt số tiền và tháng thu của từng đợt; batch sẽ sinh đúng hóa đơn đến hạn.</p>
                  </button>
                </div>
                {billingModel === "INSTALLMENT" ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-white/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">Lịch trả góp</p>
                      <p className="text-xs text-ink-muted48">Tổng phải bằng {formatVnd(enrollmentTotalAmount)}</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {installments.map((item, index) => (
                        <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                          <input aria-label={`Tháng thu đợt ${index + 1}`} type="month" value={item.dueMonth} onChange={(event) => setInstallments((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, dueMonth: event.target.value } : row))} className="input-sm" />
                          <span className="flex flex-col">
                            <CurrencyInput min={1} value={item.amount} onChange={(next) => setInstallments((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: String(next) } : row))} className="input-sm" />
                            <span className="text-[10px] leading-tight text-ink-muted48">{formatVnd(Number(item.amount) || 0)}</span>
                          </span>
                          {installments.length > 2 ? <button type="button" onClick={() => setInstallments((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="btn-ghost-sm px-3 text-red-600">×</button> : <span />}
                        </div>
                      ))}
                    </div>
                    <button type="button" disabled={installments.length >= 12} onClick={() => setInstallments((current) => [...current, { dueMonth: monthOffset(current.length), amount: "0" }])} className="mt-3 text-xs font-semibold text-primary">
                      + Thêm đợt
                    </button>
                    <p className={`mt-3 text-xs font-semibold ${installmentsMismatch ? "text-red-600" : "text-emerald-700"}`}>
                      Đã phân bổ: {formatVnd(installmentsSum)} / Cần: {formatVnd(enrollmentTotalAmount)}
                      {installmentsMismatch ? ` — ${installmentsDiff > 0 ? "còn thiếu" : "đang thừa"} ${formatVnd(Math.abs(installmentsDiff))}` : " — đã khớp"}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? <div className="alert-danger">{error}</div> : null}
          {success ? <div className="alert-success">{success}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="button" onClick={enroll} disabled={!selected || loading || installmentsMismatch} className="btn-primary">
              {loading ? "Đang ghi danh..." : "Xác nhận ghi danh"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </ResponsiveDrawer>
    </>
  );
}
