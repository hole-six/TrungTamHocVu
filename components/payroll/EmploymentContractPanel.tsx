"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";

type Contract = {
  contractNo: string | null;
  signDate: string | null;
  expiryDate: string | null;
  contractType: string | null;
  baseSalary: number | null;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "—";
}

function toDateInput(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

// Trước đây ngày ký/hết hạn HĐ chỉ ĐỌC được — DB có model EmploymentContract nhưng
// hoàn toàn không có API/form tạo. Mỗi lần ký hợp đồng mới tạo 1 dòng mới (không sửa
// đè hợp đồng cũ, xem app/api/employees/[id]/contracts/route.ts) — đúng bản chất lịch
// sử, danh sách/hồ sơ luôn hiển thị hợp đồng ký gần nhất.
export default function EmploymentContractPanel({ employeeId, contract, canEdit }: { employeeId: string; contract: Contract | null; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    contractNo: "",
    signDate: toDateInput(null),
    expiryDate: "",
    contractType: "",
    baseSalary: 0,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.signDate) {
      setError("Thiếu ngày ký hợp đồng");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không tạo được hợp đồng.");
      return;
    }
    setOpen(false);
    setForm({ contractNo: "", signDate: "", expiryDate: "", contractType: "", baseSalary: 0 });
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Hợp đồng lao động</h2>
        {canEdit && !open && (
          <button onClick={() => setOpen(true)} className="btn-ghost text-sm">
            Ký hợp đồng mới
          </button>
        )}
      </div>

      {!open ? (
        contract ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink-muted48">Số HĐ</dt>
              <dd className="font-medium">{contract.contractNo ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted48">Loại HĐ</dt>
              <dd className="font-medium">{contract.contractType ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted48">Ngày ký HĐ</dt>
              <dd className="font-medium">{formatDate(contract.signDate)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted48">Hạn HĐ</dt>
              <dd className="font-medium">{formatDate(contract.expiryDate)}</dd>
            </div>
            {contract.baseSalary ? (
              <div>
                <dt className="text-ink-muted48">Lương cơ bản HĐ</dt>
                <dd className="font-medium">{formatVnd(contract.baseSalary)}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ink-muted48">Chưa có hợp đồng nào được ghi nhận.</p>
        )
      ) : (
        <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Số HĐ</span>
            <input className="input" value={form.contractNo} onChange={(e) => setForm((f) => ({ ...f, contractNo: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Loại HĐ</span>
            <input className="input" placeholder="Thử việc / Xác định thời hạn / Không xác định thời hạn" value={form.contractType} onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Ngày ký HĐ *</span>
            <input type="date" required className="input" value={form.signDate} onChange={(e) => setForm((f) => ({ ...f, signDate: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Hạn HĐ</span>
            <input type="date" className="input" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-ink-muted48">Lương cơ bản HĐ (nếu có)</span>
            <CurrencyInput value={form.baseSalary} onChange={(next) => setForm((f) => ({ ...f, baseSalary: next }))} />
          </label>
          {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
          <div className="col-span-full flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu hợp đồng"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
