"use client";

import { useEffect, useState } from "react";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import PrintInvoiceButton from "@/components/tuition/PrintInvoiceButton";
import { formatVnd } from "@/lib/export-utils";

export type EnrollmentCharge = {
  id: string;
  periodName: string;
  billingModel: string;
  totalAmount: number;
  remainingAmount: number;
};

function periodLabel(periodName: string, billingModel: string) {
  if (billingModel === "COURSE") return "Học phí trọn khóa";
  const [year, month] = periodName.split("-");
  return year && month ? `Học phí tháng ${Number(month)}/${year}` : periodName;
}

// Phiếu vừa sinh ngay sau khi gán lớp — thu tiền và in phiếu LUÔN TẠI CHỖ, đúng lúc phụ
// huynh đang đứng ở quầy. Thu tiền đi qua cùng API với trang Học phí (phân bổ vào phiếu
// học phí, nạp ví buổi học), in phiếu mở cùng file phiếu với trang Học phí — nên hai
// nơi không bao giờ lệch số với nhau.
export default function EnrollmentChargesPanel({
  studentId,
  charges: initialCharges,
  onChanged,
}: {
  studentId: string;
  charges: EnrollmentCharge[];
  onChanged?: () => void;
}) {
  const [charges, setCharges] = useState(initialCharges);
  useEffect(() => setCharges(initialCharges), [initialCharges]);

  // Thu tiền xong thì đọc lại số còn lại của từng phiếu — nếu không bảng này vẫn hiện
  // "Cần thu" số cũ dù tiền đã vào, nhân viên dễ bấm thu lần hai.
  async function refreshAfterPayment() {
    const next = await Promise.all(
      charges.map(async (charge) => {
        const response = await fetch(`/api/charges/${charge.id}`);
        if (!response.ok) return charge;
        const data = await response.json().catch(() => null);
        return data?.item ? { ...charge, totalAmount: data.item.totalAmount, remainingAmount: data.item.remainingAmount } : charge;
      }),
    );
    setCharges(next);
    onChanged?.();
  }

  if (charges.length === 0) return null;
  const totalRemaining = charges.reduce((sum, charge) => sum + charge.remainingAmount, 0);

  return (
    <div className="space-y-2 rounded-xl border border-[#e2e8f0] bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Phiếu học phí vừa lập</p>
      <div className="divide-y divide-[#f1f5f9]">
        {charges.map((charge) => (
          <div key={charge.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-bold text-[#0f1729]">{periodLabel(charge.periodName, charge.billingModel)}</p>
              <p className="text-xs text-[#64748b]">
                {formatVnd(charge.totalAmount)}
                {charge.remainingAmount < charge.totalAmount ? ` · đã trừ tiền đóng trước, còn ${formatVnd(charge.remainingAmount)}` : ""}
              </p>
            </div>
            <PrintInvoiceButton chargeId={charge.id} />
          </div>
        ))}
      </div>
      {totalRemaining > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f1f5f9] pt-2">
          <p className="text-sm text-[#0f1729]">
            Cần thu <strong>{formatVnd(totalRemaining)}</strong>
          </p>
          <QuickPaymentButton studentId={studentId} suggestedAmount={totalRemaining} onChanged={() => void refreshAfterPayment()} />
        </div>
      ) : (
        <p className="border-t border-[#f1f5f9] pt-2 text-sm font-semibold text-emerald-700">Đã thu đủ.</p>
      )}
    </div>
  );
}
