"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";

type Props = {
  lineId: string;
  otHours: number;
  otAmount: number;
  kpiBonus: number;
  assistantRatingBonus: number;
  parkingAllowance: number;
  supportAllowance: number;
  bonus: number;
  penalty: number;
  socialInsuranceDeduction: number;
  utilityDeduction: number;
  holidayBonus: number;
  otherDeduction: number;
  notes: string | null;
  employeeName: string;
};

// Các khoản cộng/trừ itemize đúng theo phiếu lương thật của trung tâm (ảnh mẫu trong
// ĐỀ XUẤT CHỈNH SỬA.xlsx) — trước đây chỉ có 2 ô Thưởng/Phạt chung, không đủ để phản
// ánh đúng phiếu lương thật gồm 12 dòng cộng/trừ. assistantRatingBonus KHÔNG có ở đây
// vì nó tự tính (đánh giá TG × thu nhập TG tháng) mỗi lần "Tính lại lương", không sửa
// tay được — hiển thị dạng thông tin ở dưới cùng.
export default function PayrollLineAdjustForm({
  lineId,
  otHours,
  otAmount,
  kpiBonus,
  assistantRatingBonus,
  parkingAllowance,
  supportAllowance,
  bonus,
  penalty,
  socialInsuranceDeduction,
  utilityDeduction,
  holidayBonus,
  otherDeduction,
  notes,
  employeeName,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    otHours: String(otHours),
    otAmount: String(otAmount),
    kpiBonus: String(kpiBonus),
    parkingAllowance: String(parkingAllowance),
    supportAllowance: String(supportAllowance),
    bonus: String(bonus),
    penalty: String(penalty),
    socialInsuranceDeduction: String(socialInsuranceDeduction),
    utilityDeduction: String(utilityDeduction),
    holidayBonus: String(holidayBonus),
    otherDeduction: String(otherDeduction),
    notes: notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const num = (key: keyof typeof form) => Number(form[key]) || 0;
  const previewNetAdjustment =
    num("otAmount") +
    num("kpiBonus") +
    assistantRatingBonus +
    num("parkingAllowance") +
    num("supportAllowance") +
    num("bonus") -
    num("penalty") -
    num("socialInsuranceDeduction") -
    num("utilityDeduction") +
    num("holidayBonus") -
    num("otherDeduction");

  async function save() {
    setLoading(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/payroll-lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        otHours: num("otHours"),
        otAmount: num("otAmount"),
        kpiBonus: num("kpiBonus"),
        parkingAllowance: num("parkingAllowance"),
        supportAllowance: num("supportAllowance"),
        bonus: num("bonus"),
        penalty: num("penalty"),
        socialInsuranceDeduction: num("socialInsuranceDeduction"),
        utilityDeduction: num("utilityDeduction"),
        holidayBonus: num("holidayBonus"),
        otherDeduction: num("otherDeduction"),
        notes: form.notes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể lưu điều chỉnh.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function removeLine() {
    setLoading(true);
    const res = await fetch(`/api/payroll-lines/${lineId}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể xóa dòng lương.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-display text-lg font-semibold tracking-tight">Điều chỉnh dòng lương kỳ này</h2>

      <div>
        <p className="mb-2 text-xs font-bold uppercase text-ink-muted48">Làm thêm giờ</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Số giờ OT</span>
            <input type="number" className="input" value={form.otHours} onChange={(e) => set("otHours", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Lương OT</span>
            <CurrencyInput value={form.otAmount} onChange={(next) => set("otAmount", String(next))} />
          </label>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase text-ink-muted48">Khoản cộng</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Thưởng KPI</span>
            <CurrencyInput value={form.kpiBonus} onChange={(next) => set("kpiBonus", String(next))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Phí gửi xe</span>
            <CurrencyInput value={form.parkingAllowance} onChange={(next) => set("parkingAllowance", String(next))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Hỗ trợ</span>
            <CurrencyInput value={form.supportAllowance} onChange={(next) => set("supportAllowance", String(next))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Thưởng tháng</span>
            <CurrencyInput value={form.bonus} onChange={(next) => set("bonus", String(next))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Thưởng lễ/Tết</span>
            <CurrencyInput value={form.holidayBonus} onChange={(next) => set("holidayBonus", String(next))} />
          </label>
        </div>
        <p className="form-hint mt-2">
          Đánh giá TG (tự tính theo % đánh giá tháng): {formatVnd(assistantRatingBonus)}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase text-ink-muted48">Khoản trừ</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Phạt tháng</span>
            <CurrencyInput value={form.penalty} onChange={(next) => set("penalty", String(next))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">BHXH</span>
            <CurrencyInput value={form.socialInsuranceDeduction} onChange={(next) => set("socialInsuranceDeduction", String(next))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Tiền điện nước</span>
            <CurrencyInput value={form.utilityDeduction} onChange={(next) => set("utilityDeduction", String(next))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Khoản trừ khác</span>
            <CurrencyInput value={form.otherDeduction} onChange={(next) => set("otherDeduction", String(next))} />
          </label>
        </div>
      </div>

      <label className="space-y-1 block">
        <span className="text-xs font-medium text-ink-muted48">Ghi chú</span>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>

      <p className="text-sm font-bold text-ink">Tổng cộng/trừ kỳ này (chưa gồm lương dạy/TG/công): {formatVnd(previewNetAdjustment)}</p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved && !error ? <p className="text-sm text-emerald-600">Đã lưu.</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={loading} className="btn-primary">
          {loading ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        <ConfirmActionButton
          title="Xác nhận xóa dòng lương?"
          description={`Dòng lương của ${employeeName} sẽ bị xóa khỏi kỳ hiện tại.`}
          confirmLabel="Xóa dòng lương"
          tone="danger"
          disabled={loading}
          className="btn-danger-sm"
          onConfirm={removeLine}
        >
          Xóa dòng lương
        </ConfirmActionButton>
      </div>
    </div>
  );
}
