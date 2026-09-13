"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormGuide from "@/components/ui/FormGuide";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";
import EnrollmentChargesPanel, { type EnrollmentCharge } from "@/components/tuition/EnrollmentChargesPanel";

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
  onSuccess,
}: {
  classId: string;
  courseTotalAmount?: number;
  defaultMainSessionCount?: number;
  defaultUnitPrice?: number;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [billingModel, setBillingModel] = useState<"COURSE" | "PERIOD" | "INSTALLMENT">("COURSE");
  const [installments, setInstallments] = useState<InstallmentDraft[]>(() => splitInstallments(courseTotalAmount, 3));
  // Người dùng đã tự sửa số tiền từng đợt hay chưa. Khi CHƯA sửa thì các đợt phải tự
  // chia lại theo tổng tiền THẬT của học viên (số buổi họ đăng ký × đơn giá) — nếu cứ
  // giữ bản chia theo tổng của lớp thì vừa mở form đã báo lệch tiền.
  const [installmentsTouched, setInstallmentsTouched] = useState(false);
  // KHÔNG điền sẵn số buổi của lớp (defaultMainSessionCount). Số buổi là cam kết của
  // TỪNG học viên, do người ghi danh chốt với phụ huynh — lớp chỉ là cái mác xếp lịch.
  // Điền sẵn thì thực tế không ai sửa, và lớp lại thành người quyết định số buổi, kéo
  // theo ngày kết thúc của mọi học viên giống hệt nhau. Số của lớp hiện làm gợi ý ngay
  // dưới ô nhập.
  const [mainSessionCount, setMainSessionCount] = useState("");
  // Đóng theo tháng: số buổi của khóa (điền sẵn số buổi lớp dự kiến) — thu từng tháng tới
  // khi đủ số này; vào giữa khóa vẫn học đủ, lớp hết lịch thì học nối sang lớp sau.
  const [courseSessionCount, setCourseSessionCount] = useState(defaultMainSessionCount > 0 ? String(defaultMainSessionCount) : "");
  const [unitPrice, setUnitPrice] = useState(String(defaultUnitPrice || ""));
  // Chiết khấu ngay lúc ghi danh — cùng khái niệm với mục "Chiết khấu" trong hồ sơ học
  // viên. KHÔNG giữ lại cho người kế tiếp khi ghi danh liên tiếp (xem enroll()): mỗi em
  // một mức ưu đãi riêng, giữ lại dễ giảm nhầm cho cả lượt.
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  // Ghi danh giữa chừng là việc hàng ngày — phải hỏi rõ NGÀY BẮT ĐẦU HỌC (không mặc
  // định hôm nay), vì tháng đầu chỉ thu từ ngày đó trở đi (xem generateChargesForPeriod).
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<null | {
    unitPrice: number;
    firstMonth: { periodName: string; sessionCount: number; amount: number };
    firstSession: { date: string; startTime: string | null; endTime: string | null; orderInClass: number } | null;
    selectableSessions?: {
      id: string;
      date: string;
      startTime: string | null;
      endTime: string | null;
      orderInClass: number;
      isPast: boolean;
    }[];
    sessionsAlreadyTaught: number;
    expectedEndDate: string | null;
    purchasedAmount: number | null;
  }>(null);
  const [paidCatchupSessionCount, setPaidCatchupSessionCount] = useState("0");
  const [paidCatchupUnitPrice, setPaidCatchupUnitPrice] = useState(String(defaultUnitPrice || ""));
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Học viên VỪA ghi danh + phiếu vừa lập — giữ riêng vì form xóa chọn học viên ngay sau
  // khi ghi danh (để ghi danh người tiếp theo), mà vẫn phải thu tiền/in phiếu người vừa rồi.
  const [lastEnrolled, setLastEnrolled] = useState<{ studentId: string; fullName: string; charges: EnrollmentCharge[] } | null>(null);
  // Ghi danh làm phát sinh phiếu học phí — xác nhận lại số tiền trước khi lưu.
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Xem trước theo lớp + ngày bắt đầu + số buổi mua. Dùng chung đúng cách đếm buổi với
  // lúc sinh học phí thật, để số hiện ở đây không lệch số thu sau này.
  useEffect(() => {
    if (!open || !startDate) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const sessions = billingModel === "PERIOD" ? 0 : Number(mainSessionCount) || 0;
        const search = new URLSearchParams({
          date: startDate,
          sessions: String(sessions),
          discount: String(Number(discountPercent) || 0),
          price: String(Number(unitPrice) || 0),
        });
        const response = await fetch(`/api/classes/${classId}/enrollment-preview?${search.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        setPreview(await response.json());
      } catch {
        /* huỷ do gõ tiếp — bỏ qua */
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, classId, startDate, billingModel, mainSessionCount, discountPercent, unitPrice]);

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

  function requestEnroll() {
    if (!selected) return;
    setError(null);
    if (billingModel === "PERIOD" && (!courseSessionCount || Number(courseSessionCount) <= 0)) {
      setError("Cần nhập số buổi của khóa — đóng theo tháng vẫn thu tới khi đủ số buổi này.");
      return;
    }
    if (billingModel !== "PERIOD" && (!mainSessionCount || Number(mainSessionCount) <= 0)) {
      setError("Cần nhập số buổi học viên đăng ký.");
      return;
    }
    if (installmentsMismatch) {
      setError("Tổng các đợt trả góp chưa khớp với tổng học phí — kiểm tra lại trước khi ghi danh.");
      return;
    }
    setConfirmOpen(true);
  }

  async function enroll() {
    setConfirmOpen(false);
    if (!selected) return;
    if (billingModel === "PERIOD" && (!courseSessionCount || Number(courseSessionCount) <= 0)) {
      setError("Cần nhập số buổi của khóa — đóng theo tháng vẫn thu tới khi đủ số buổi này.");
      return;
    }
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
        enrollDate: startDate,
        purchasedMainSessionCount: Number(mainSessionCount),
        periodCourseSessionCount: billingModel === "PERIOD" ? Number(courseSessionCount) : undefined,
        tuitionUnitPriceSnapshot: Number(unitPrice),
        paidCatchupSessionCount: Number(paidCatchupSessionCount),
        paidCatchupUnitPrice: Number(paidCatchupUnitPrice || unitPrice),
        installments: billingModel === "INSTALLMENT" ? installments.map((item) => ({ ...item, amount: Number(item.amount) })) : undefined,
        discountPercent: Number(discountPercent) || 0,
        discountReason: discountReason.trim() || undefined,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể ghi danh học viên.");
      return;
    }
    // Ghi danh thành công nhưng phiếu học phí có thể chưa sinh được (vd kỳ thu đã khóa sổ).
    if (result.billingWarning) {
      setError(`Đã ghi danh, nhưng chưa sinh được phiếu học phí: ${result.billingWarning}`);
    }
    setDiscountPercent("");
    setDiscountReason("");

    // GHI DANH NHIỀU NGƯỜI LIÊN TIẾP (đầu khóa thường có cả chục em vào cùng lúc):
    // giữ nguyên form đang mở và GIỮ LẠI các lựa chọn vừa nhập — số buổi, đơn giá, kiểu
    // thu, ngày/buổi bắt đầu — chỉ xóa phần chọn học viên. Người thứ hai trở đi chỉ cần
    // gõ tên rồi bấm, nhanh gần bằng ghi danh hàng loạt.
    //
    // Cố tình KHÔNG làm ghi danh hàng loạt thật (chọn nhiều học viên rồi ghi một lượt):
    // mỗi em một cam kết riêng về số buổi, học bổng và ngày bắt đầu, làm hàng loạt thì
    // buộc phải áp chung một bộ giá trị cho cả nhóm — quay lại đúng cái vừa gỡ bỏ, là
    // để lớp quyết định số buổi thay cho người ghi danh.
    setLastEnrolled({
      studentId: selected.id,
      fullName: selected.fullName,
      charges: Array.isArray(result.charges) ? result.charges : [],
    });
    setSuccess(`Đã ghi danh ${selected.fullName} vào lớp. Chọn học viên tiếp theo để ghi danh với cùng thiết lập này.`);
    setSelected(null);
    setResults([]);
    setQ("");
    router.refresh();
    onSuccess?.();
  }

  // Cùng công thức làm tròn với server (computeEffectiveUnitPrice) — tổng trả góp phải
  // khớp đúng tới từng đồng, không thì server từ chối.
  const discountedUnitPrice = Math.round((Number(unitPrice) || 0) * Math.max(0, 1 - (Number(discountPercent) || 0) / 100));
  const mainTuitionAmount = (Number(mainSessionCount) || 0) * discountedUnitPrice;
  const catchupAmount = (Number(paidCatchupSessionCount) || 0) * (Number(paidCatchupUnitPrice || unitPrice) || 0);
  const enrollmentTotalAmount = mainTuitionAmount + catchupAmount;
  const installmentsSum = installments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const installmentsDiff = enrollmentTotalAmount - installmentsSum;
  const installmentsMismatch = billingModel === "INSTALLMENT" && installmentsDiff !== 0;
  const installmentCount = installments.length;

  // Chia đều lại các đợt theo tổng tiền thật, chừng nào người dùng chưa tự sửa tay.
  useEffect(() => {
    if (installmentsTouched) return;
    if (enrollmentTotalAmount <= 0) return;
    setInstallments(splitInstallments(enrollmentTotalAmount, installmentCount || 3));
  }, [enrollmentTotalAmount, installmentCount, installmentsTouched]);

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
              {/* Chọn ĐÍCH DANH buổi đầu tiên của học viên này — xem enrollment-preview. */}
              {(preview?.selectableSessions?.length ?? 0) > 0 ? (
                <label className="form-group border-t border-emerald-200 pt-4">
                  <span className="label-sm">Bắt đầu từ buổi nào</span>
                  <select
                    className="input"
                    value={preview?.selectableSessions?.find((item) => item.date === startDate)?.id ?? ""}
                    onChange={(event) => {
                      const picked = preview?.selectableSessions?.find((item) => item.id === event.target.value);
                      if (picked) setStartDate(picked.date);
                    }}
                  >
                    <option value="">-- Chọn buổi học đầu tiên của học viên --</option>
                    {preview?.selectableSessions?.map((item) => (
                      <option key={item.id} value={item.id}>
                        Buổi {item.orderInClass} · {new Date(item.date).toLocaleDateString("vi-VN")}
                        {item.startTime ? ` · ${item.startTime}` : ""}
                        {item.isPast ? " (đã qua)" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] leading-tight text-ink-muted48">
                    Buổi đã hủy không nằm trong danh sách. Tháng đầu chỉ thu từ buổi này trở đi.
                  </span>
                </label>
              ) : null}

              <label className={`form-group ${(preview?.selectableSessions?.length ?? 0) > 0 ? "mt-3" : "border-t border-emerald-200 pt-4"}`}>
                <span className="label-sm">
                  {(preview?.selectableSessions?.length ?? 0) > 0 ? "Hoặc nhập thẳng ngày bắt đầu" : "Ngày bắt đầu học"}
                </span>
                <input type="date" className="input" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                <span className="text-[10px] leading-tight text-ink-muted48">
                  Tháng đầu chỉ thu từ ngày này trở đi — các buổi lớp đã dạy trước đó không tính tiền.
                </span>
              </label>

              {/* Trả lời thẳng 2 câu nhân viên luôn phải tự tính tay khi ghi danh giữa
                  chừng: học viên vào từ buổi nào, và tháng đầu thu bao nhiêu. Số ở đây
                  đếm bằng ĐÚNG cách mà lúc sinh học phí thật dùng. */}
              {preview ? (
                <div className="rounded-xl border border-emerald-300 bg-white/70 p-3 text-sm">
                  <p className="font-bold text-emerald-900">Vào lớp từ ngày này thì:</p>
                  <ul className="mt-1.5 space-y-1 text-emerald-900">
                    <li>
                      • Buổi đầu tiên:{" "}
                      {preview.firstSession ? (
                        <strong>
                          {new Date(preview.firstSession.date).toLocaleDateString("vi-VN")}
                          {preview.firstSession.startTime ? ` lúc ${preview.firstSession.startTime}` : ""} — buổi thứ{" "}
                          {preview.firstSession.orderInClass} của lớp
                        </strong>
                      ) : (
                        <strong>lớp chưa có buổi nào sau ngày này</strong>
                      )}
                    </li>
                    {preview.sessionsAlreadyTaught > 0 ? (
                      <li>
                        • Lớp đã dạy {preview.sessionsAlreadyTaught} buổi trước đó — không thu tiền phần này,{" "}
                        <strong>nhưng học viên chưa học nội dung buổi 1–{preview.sessionsAlreadyTaught}</strong>. Cân nhắc xếp buổi bổ trợ.
                      </li>
                    ) : null}
                    {billingModel === "PERIOD" ? (
                      <li>
                        • Tháng {preview.firstMonth.periodName}: còn{" "}
                        <strong>{preview.firstMonth.sessionCount} buổi</strong> ={" "}
                        <strong>{formatVnd(preview.firstMonth.amount)}</strong> — sinh phiếu ngay khi ghi danh, không thu nguyên tháng
                      </li>
                    ) : (
                      <>
                        <li>
                          • Mua {Number(mainSessionCount) || 0} buổi ={" "}
                          <strong>{formatVnd(preview.purchasedAmount ?? 0)}</strong> — thu một lần khi ghi danh
                        </li>
                        <li>
                          • Dự kiến học xong:{" "}
                          <strong>
                            {preview.expectedEndDate
                              ? new Date(preview.expectedEndDate).toLocaleDateString("vi-VN")
                              : "chưa đủ dữ liệu lịch để ước tính"}
                          </strong>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-3 border-t border-emerald-200 pt-4 md:grid-cols-2">
                {/* Đóng theo tháng KHÔNG có "đã mua N buổi" — quyền học nằm trong Ví buổi
                    học (nạp mỗi lần đóng tiền), không phải 1 tổng cố định lúc ghi danh.
                    Ẩn "Số buổi" và "Tạm tính Tổng" khi PERIOD để khỏi hiện số gây hiểu
                    lầm là đã chốt tổng tiền — thực tế học phí sinh theo từng tháng. */}
                {billingModel !== "PERIOD" ? (
                  <label className="form-group">
                    <span className="label-sm">Số buổi học viên này đăng ký</span>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={mainSessionCount}
                      onChange={(event) => setMainSessionCount(event.target.value)}
                      placeholder="Nhập số buổi phụ huynh đã chốt"
                    />
                    <span className="text-[10px] leading-tight text-ink-muted48">
                      {defaultMainSessionCount > 0
                        ? `Lớp dự kiến ${defaultMainSessionCount} buổi — chỉ để tham khảo.`
                        : "Lớp chưa đặt số buổi dự kiến."}
                    </span>
                  </label>
                ) : null}
                <label className="form-group">
                  <span className="label-sm">Đơn giá / buổi</span>
                  <CurrencyInput value={unitPrice} onChange={(next) => setUnitPrice(String(next))} />
                  <span className="text-[10px] leading-tight text-ink-muted48">
                    {formatVnd(Number(unitPrice) || 0)}
                  </span>
                </label>
                <label className="form-group">
                  <span className="label-sm">Chiết khấu (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input"
                    value={discountPercent}
                    onChange={(event) => setDiscountPercent(event.target.value)}
                    placeholder="0"
                  />
                  <span className="text-[10px] leading-tight text-ink-muted48">
                    {Number(discountPercent) > 0
                      ? `Còn ${formatVnd(billingModel === "PERIOD" ? preview?.unitPrice ?? 0 : discountedUnitPrice)}/buổi sau chiết khấu`
                      : "Để trống nếu không giảm."}
                  </span>
                </label>
                {Number(discountPercent) > 0 ? (
                  <label className="form-group">
                    <span className="label-sm">Lý do chiết khấu</span>
                    <input
                      className="input"
                      value={discountReason}
                      onChange={(event) => setDiscountReason(event.target.value)}
                      placeholder="VD: Anh chị em ruột, ưu đãi khai giảng..."
                    />
                  </label>
                ) : null}
                {billingModel !== "PERIOD" ? (
                  <>
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
                  </>
                ) : (
                  <label className="form-group md:col-span-2">
                    <span className="label-sm">Số buổi của khóa</span>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={courseSessionCount}
                      onChange={(event) => setCourseSessionCount(event.target.value)}
                      placeholder="VD: 48"
                    />
                    <span className="text-[10px] leading-tight text-ink-muted48">
                      Mỗi tháng thu số buổi lớp dạy trong tháng × đơn giá, tới khi đủ số buổi này thì dừng (tháng cuối chỉ thu phần còn lại). Lớp hết lịch trước thì học nối sang lớp tiếp theo.
                    </span>
                  </label>
                )}
              </div>
              <div className="border-t border-emerald-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Kế hoạch đóng học phí</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setBillingModel("COURSE")} className={`rounded-xl border p-3 text-left transition ${billingModel === "COURSE" ? "border-[#0f1729] bg-white shadow-sm" : "border-[#e2e8f0] bg-white"}`}>
                    <p className="text-sm font-semibold text-ink">Đóng trọn khóa</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted80">Tạo một khoản thu sau khi ghi danh; các kỳ tháng sau sẽ tự bỏ qua học viên này.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillingModel("PERIOD");
                      // Bổ trợ đầu khóa tính phí chưa hỗ trợ cho PERIOD (server chặn) —
                      // reset về 0 nếu trước đó staff đã gõ khi đang ở COURSE.
                      setPaidCatchupSessionCount("0");
                    }}
                    className={`rounded-xl border p-3 text-left transition ${billingModel === "PERIOD" ? "border-[#0f1729] bg-white shadow-sm" : "border-[#e2e8f0] bg-white"}`}
                  >
                    <p className="text-sm font-semibold text-ink">Đóng theo tháng</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted80">Trả dần theo từng tháng (tính từ ngày vào lớp) tới khi đủ số buổi của khóa.</p>
                  </button>
                  <button type="button" onClick={() => setBillingModel("INSTALLMENT")} className={`rounded-xl border p-3 text-left transition ${billingModel === "INSTALLMENT" ? "border-[#0f1729] bg-white shadow-sm" : "border-[#e2e8f0] bg-white"}`}>
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
                            <CurrencyInput min={1} value={item.amount} onChange={(next) => { setInstallmentsTouched(true); setInstallments((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: String(next) } : row)); }} className="input-sm" />
                            <span className="text-[10px] leading-tight text-ink-muted48">{formatVnd(Number(item.amount) || 0)}</span>
                          </span>
                          {installments.length > 2 ? <button type="button" onClick={() => { setInstallmentsTouched(true); setInstallments((current) => current.filter((_, rowIndex) => rowIndex !== index)); }} className="btn-ghost-sm px-3 text-red-600">×</button> : <span />}
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
          {lastEnrolled && lastEnrolled.charges.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#64748b]">Thu tiền / in phiếu cho {lastEnrolled.fullName}</p>
              <EnrollmentChargesPanel studentId={lastEnrolled.studentId} charges={lastEnrolled.charges} onChanged={onSuccess} />
            </div>
          ) : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="button" onClick={requestEnroll} disabled={!selected || loading || installmentsMismatch} className="btn-primary">
              {loading ? "Đang ghi danh..." : "Xác nhận ghi danh"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </ResponsiveDrawer>

      <ConfirmDialog
        open={confirmOpen}
        title={
          billingModel === "PERIOD"
            ? `Ghi danh theo tháng — phiếu đầu ${formatVnd(preview?.firstMonth?.amount ?? 0)}?`
            : billingModel === "INSTALLMENT"
              ? `Ghi danh trả góp — tổng ${formatVnd(enrollmentTotalAmount)}?`
              : `Ghi danh trọn khóa — ${formatVnd(enrollmentTotalAmount)}?`
        }
        description={[
          `Học viên: ${selected?.fullName ?? ""}${selected?.studentCode ? ` (${selected.studentCode})` : ""}`,
          `Ngày bắt đầu: ${startDate}`,
          `Đơn giá: ${formatVnd(Number(unitPrice) || 0)}/buổi${Number(discountPercent) > 0 ? ` · chiết khấu ${discountPercent}%` : ""}`,
          billingModel === "PERIOD"
            ? [
                `Cách thu: theo tháng · khóa ${courseSessionCount || "—"} buổi`,
                preview?.firstMonth
                  ? `Phiếu tháng ${preview.firstMonth.periodName}: ${preview.firstMonth.sessionCount} buổi = ${formatVnd(preview.firstMonth.amount)} (lập ngay khi ghi danh)`
                  : "",
              ]
                .filter(Boolean)
                .join("\n")
            : [
                `Cách thu: ${billingModel === "INSTALLMENT" ? "trả góp theo đợt" : "trọn khóa"} · ${mainSessionCount || "—"} buổi`,
                `Học phí khóa chính: ${formatVnd(mainTuitionAmount)}`,
                catchupAmount > 0 ? `Buổi học thêm đầu khóa: ${formatVnd(catchupAmount)}` : "",
                `Tổng: ${formatVnd(enrollmentTotalAmount)}`,
              ]
                .filter(Boolean)
                .join("\n"),
          "",
          "Phiếu học phí sẽ được lập ngay sau khi ghi danh — phụ huynh nhận đúng số tiền này.",
        ]
          .filter(Boolean)
          .join("\n")}
        confirmLabel="Ghi danh"
        loading={loading}
        onConfirm={() => void enroll()}
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
      />
    </>
  );
}
