"use client";

import { useState } from "react";
import FormGuide from "@/components/ui/FormGuide";

type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "EWALLET" | "CHECK";

type TuitionPaymentFormProps = {
  invoiceId: string;
  studentName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  onSubmit: (data: PaymentData) => Promise<void>;
  onCancel: () => void;
};

type PaymentData = {
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  discount?: number;
  late_fee?: number;
};

const PAYMENT_METHODS = [
  { value: "CASH", label: "Tiền mặt", icon: "💵" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản", icon: "🏦" },
  { value: "CARD", label: "Thẻ", icon: "💳" },
  { value: "EWALLET", label: "Ví điện tử", icon: "📱" },
  { value: "CHECK", label: "Séc", icon: "📝" },
];

const PAYMENT_GUIDE_SECTIONS = [
  {
    title: "Form này dùng khi nào?",
    items: [
      "Dùng khi xác nhận một khoản thanh toán cho đúng hóa đơn học phí này.",
      "Có thể dùng để thu đủ một lần hoặc thu từng phần nhiều lần trên cùng một hóa đơn.",
      "Mục tiêu là ghi nhận đúng số tiền, đúng ngày, đúng phương thức và các khoản điều chỉnh nếu có.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách nhập đúng",
    items: [
      "Số tiền thanh toán là số phụ huynh trả trong lần này, không bắt buộc bằng toàn bộ số còn lại.",
      "Giảm giá chỉ nhập khi thực sự có ưu đãi hoặc điều chỉnh được chấp thuận.",
      "Phí trễ hạn chỉ nhập khi trung tâm có quy định tính thêm khoản này.",
      "Nếu không phải tiền mặt, nên ghi mã giao dịch để tra soát sau này.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ sai",
    items: [
      "Nhập nhầm giảm giá hoặc phí trễ làm lệch tổng thanh toán.",
      "Chọn sai phương thức thanh toán gây khó đối soát.",
      "Không ghi mã giao dịch đối với chuyển khoản làm mất dấu vết tra cứu.",
    ],
    tone: "warning" as const,
  },
];

export default function TuitionPaymentForm({
  invoiceId,
  studentName,
  totalAmount,
  paidAmount,
  remainingAmount,
  onSubmit,
  onCancel,
}: TuitionPaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState(remainingAmount);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [lateFee, setLateFee] = useState(0);

  const finalAmount = amount + lateFee - discount;
  const changeAmount = finalAmount > remainingAmount ? finalAmount - remainingAmount : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount <= 0) {
      alert("Số tiền thanh toán phải lớn hơn 0");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        amount,
        paymentMethod,
        paymentDate,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
        discount: discount > 0 ? discount : undefined,
        late_fee: lateFee > 0 ? lateFee : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-end">
        <FormGuide
          title="Hướng dẫn xác nhận thanh toán hóa đơn"
          summary="Đây là form chốt thanh toán cho một hóa đơn cụ thể. Người vận hành nên kiểm tra kỹ số tiền trả lần này, phương thức thanh toán và các khoản giảm/phụ phí trước khi xác nhận."
          sections={PAYMENT_GUIDE_SECTIONS}
          position="inline"
        />
      </div>

      <div
        className="rounded-xl border p-4"
        style={{
          background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
          borderColor: "var(--border-primary)",
        }}
      >
        <div className="text-white">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Học viên</p>
              <p className="text-lg font-bold">{studentName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">Mã hóa đơn</p>
              <p className="text-base font-semibold">#{invoiceId}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-white/20 pt-3">
            <div>
              <p className="text-xs opacity-75">Tổng tiền</p>
              <p className="text-base font-bold">{totalAmount.toLocaleString("vi-VN")}₫</p>
            </div>
            <div>
              <p className="text-xs opacity-75">Đã thanh toán</p>
              <p className="text-base font-bold text-emerald-300">{paidAmount.toLocaleString("vi-VN")}₫</p>
            </div>
            <div>
              <p className="text-xs opacity-75">Còn lại</p>
              <p className="text-base font-bold text-amber-300">{remainingAmount.toLocaleString("vi-VN")}₫</p>
            </div>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label className="label">Phương thức thanh toán</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.value}
              type="button"
              onClick={() => setPaymentMethod(method.value as PaymentMethod)}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all ${
                paymentMethod === method.value ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 hover:border-primary/50"
              }`}
            >
              <span className="text-3xl">{method.icon}</span>
              <span className={`text-sm font-medium ${paymentMethod === method.value ? "text-primary" : "text-gray-600"}`}>{method.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="form-group">
          <label className="label">Số tiền thanh toán</label>
          <div className="relative">
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input pr-12" step="1000" min="0" max={remainingAmount + 10000000} required />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              ₫
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setAmount(remainingAmount)} className="flex-1 btn-ghost-sm">
              Tất cả
            </button>
            <button type="button" onClick={() => setAmount(Math.floor(remainingAmount / 2))} className="flex-1 btn-ghost-sm">
              50%
            </button>
            <button type="button" onClick={() => setAmount(1000000)} className="flex-1 btn-ghost-sm">
              1tr
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="label">Ngày thanh toán</label>
          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="input" required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="form-group">
          <label className="label">Giảm giá (nếu có)</label>
          <div className="relative">
            <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="input pr-12" step="1000" min="0" placeholder="0" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              ₫
            </span>
          </div>
        </div>

        <div className="form-group">
          <label className="label">Phí trễ hạn (nếu có)</label>
          <div className="relative">
            <input type="number" value={lateFee} onChange={(e) => setLateFee(Number(e.target.value))} className="input pr-12" step="1000" min="0" placeholder="0" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              ₫
            </span>
          </div>
        </div>
      </div>

      {paymentMethod !== "CASH" && (
        <div className="form-group">
          <label className="label">
            Mã giao dịch / Số tham chiếu
            {paymentMethod === "BANK_TRANSFER" && " (Mã chuyển khoản)"}
            {paymentMethod === "CHECK" && " (Số séc)"}
          </label>
          <input
            type="text"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            className="input"
            placeholder={
              paymentMethod === "BANK_TRANSFER" ? "VD: FT2024012912345" : paymentMethod === "CHECK" ? "VD: CHK123456" : "Nhập mã giao dịch"
            }
          />
        </div>
      )}

      <div className="form-group">
        <label className="label">Ghi chú</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-[80px] resize-none" placeholder="Ghi chú thêm về thanh toán này..." rows={3} />
      </div>

      <div
        className="space-y-2 rounded-xl border p-4"
        style={{
          backgroundColor: "var(--bg-muted)",
          borderColor: "var(--border-primary)",
        }}
      >
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Số tiền</span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {amount.toLocaleString("vi-VN")}₫
          </span>
        </div>

        {discount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: "var(--text-secondary)" }}>Giảm giá</span>
            <span className="font-semibold text-emerald-600">-{discount.toLocaleString("vi-VN")}₫</span>
          </div>
        )}

        {lateFee > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: "var(--text-secondary)" }}>Phí trễ hạn</span>
            <span className="font-semibold text-red-600">+{lateFee.toLocaleString("vi-VN")}₫</span>
          </div>
        )}

        <div className="border-t pt-2" style={{ borderColor: "var(--border-secondary)" }}>
          <div className="flex items-center justify-between">
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Tổng thanh toán
            </span>
            <span className="text-lg font-bold text-primary">{finalAmount.toLocaleString("vi-VN")}₫</span>
          </div>
        </div>

        {changeAmount > 0 && (
          <div className="rounded-lg p-2 text-sm" style={{ backgroundColor: "var(--bg-card)" }}>
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--text-secondary)" }}>Tiền thừa</span>
              <span className="font-semibold text-amber-600">{changeAmount.toLocaleString("vi-VN")}₫</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-ghost flex-1" disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? (
            <>
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
              </svg>
              Đang xử lý...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Xác nhận thanh toán
            </>
          )}
        </button>
      </div>
    </form>
  );
}
