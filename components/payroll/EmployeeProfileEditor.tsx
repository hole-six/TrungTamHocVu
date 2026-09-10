"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stat, ACTION_CLASS } from "@/components/ui/DetailDrawerParts";
import { formatVnd } from "@/lib/export-utils";

type EmployeeProfile = {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string | null;
  dob: string | null;
  phone: string | null;
  email: string | null;
  hometown: string | null;
  permanentAddress: string | null;
  idNumber: string | null;
  idIssueDate: string | null;
  idIssuePlace: string | null;
  resignDate: string | null;
  payMode: string;
  teachingHourlyRate: number | null;
  assistantHourlyRate: number | null;
  staffDailyRate: number | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
};

function toDateInput(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function EmployeeProfileEditor({
  employee,
  canEdit,
  bare = false,
}: {
  employee: EmployeeProfile;
  canEdit: boolean;
  /** Truyền true khi nơi gọi (Section trong drawer) đã có sẵn khung + tiêu đề — bỏ
   *  khung/tiêu đề của chính component này để không bị khung lồng khung. */
  bare?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mở sẵn ô thứ 2 nếu hồ sơ đang thật sự có 2 đơn giá khác nhau (dữ liệu cũ) — nếu
  // không, người sửa sẽ tưởng hệ thống làm mất mức trợ giảng đã nhập trước đó.
  const [splitRates, setSplitRates] = useState(
    employee.assistantHourlyRate != null &&
      employee.teachingHourlyRate != null &&
      employee.assistantHourlyRate !== employee.teachingHourlyRate,
  );
  const [form, setForm] = useState({
    fullName: employee.fullName,
    position: employee.position ?? "",
    dob: toDateInput(employee.dob),
    phone: employee.phone ?? "",
    email: employee.email ?? "",
    hometown: employee.hometown ?? "",
    permanentAddress: employee.permanentAddress ?? "",
    idNumber: employee.idNumber ?? "",
    idIssueDate: toDateInput(employee.idIssueDate),
    idIssuePlace: employee.idIssuePlace ?? "",
    resignDate: toDateInput(employee.resignDate),
    payMode: employee.payMode ?? "HOURLY",
    teachingHourlyRate: employee.teachingHourlyRate != null ? String(employee.teachingHourlyRate) : "",
    assistantHourlyRate: employee.assistantHourlyRate != null ? String(employee.assistantHourlyRate) : "",
    staffDailyRate: employee.staffDailyRate != null ? String(employee.staffDailyRate) : "",
    bankName: employee.bankName ?? "",
    bankAccountNumber: employee.bankAccountNumber ?? "",
    bankAccountHolder: employee.bankAccountHolder ?? "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không lưu được thông tin nhân sự.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const rows: Array<[string, string]> = [
    ["Mã NV", employee.employeeCode],
    ["Họ và tên", employee.fullName],
    ["Vị trí", employee.position ?? "—"],
    ["Ngày sinh", formatDate(employee.dob)],
    ["SĐT", employee.phone ?? "—"],
    ["Mail", employee.email ?? "—"],
    ["Quê quán", employee.hometown ?? "—"],
    ["Địa chỉ thường trú", employee.permanentAddress ?? "—"],
    ["Số CMT/CCCD", employee.idNumber ?? "—"],
    ["Ngày cấp", formatDate(employee.idIssueDate)],
    ["Nơi cấp", employee.idIssuePlace ?? "—"],
    ["Ngày nghỉ", formatDate(employee.resignDate)],
    ["Kiểu tính dạy/TG", employee.payMode === "SESSION" ? "Theo ca" : "Theo giờ"],
    ["Đơn giá dạy", employee.teachingHourlyRate != null ? `${employee.teachingHourlyRate.toLocaleString("vi-VN")}đ/${employee.payMode === "SESSION" ? "ca" : "giờ"}` : "—"],
    ["Đơn giá trợ giảng", employee.assistantHourlyRate != null ? `${employee.assistantHourlyRate.toLocaleString("vi-VN")}đ/${employee.payMode === "SESSION" ? "ca" : "giờ"}` : "—"],
    ["Đơn giá 1 công HC", employee.staffDailyRate != null ? `${employee.staffDailyRate.toLocaleString("vi-VN")}đ/công` : "—"],
    ["Ngân hàng", employee.bankName ?? "—"],
    ["Số tài khoản", employee.bankAccountNumber ?? "—"],
    ["Chủ tài khoản", employee.bankAccountHolder ?? "—"],
  ];

  return (
    <div className={bare ? "" : "card"}>
      {bare && (!canEdit || editing) ? null : (
        <div className="flex items-center justify-between">
          {bare ? <span /> : <h2 className="font-display text-lg font-semibold tracking-tight">Thông tin nhân sự</h2>}
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} className="btn-ghost-sm">
              Sửa hồ sơ
            </button>
          )}
        </div>
      )}

      {!editing ? (
        bare ? (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {rows.map(([label, value]) => (
              <Stat key={label} label={label}>
                {value === "—" ? null : value}
              </Stat>
            ))}
          </div>
        ) : (
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-hairline/60 py-1 sm:justify-start sm:gap-3">
                <dt className="text-ink-muted48">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )
      ) : (
        <form onSubmit={save} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Mã NV</span>
            <input className="input" value={employee.employeeCode} disabled />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Họ và tên</span>
            <input className="input" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Vị trí</span>
            <input className="input" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Ngày sinh</span>
            <input type="date" className="input" value={form.dob} onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">SĐT</span>
            <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Mail</span>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Quê quán</span>
            <input className="input" value={form.hometown} onChange={(e) => setForm((f) => ({ ...f, hometown: e.target.value }))} />
          </label>
          <label className="col-span-full space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Địa chỉ thường trú</span>
            <input className="input" value={form.permanentAddress} onChange={(e) => setForm((f) => ({ ...f, permanentAddress: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Số CMT/CCCD</span>
            <input className="input" value={form.idNumber} onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Ngày cấp</span>
            <input type="date" className="input" value={form.idIssueDate} onChange={(e) => setForm((f) => ({ ...f, idIssueDate: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Nơi cấp</span>
            <input className="input" value={form.idIssuePlace} onChange={(e) => setForm((f) => ({ ...f, idIssuePlace: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Ngày nghỉ (nếu có)</span>
            <input type="date" className="input" value={form.resignDate} onChange={(e) => setForm((f) => ({ ...f, resignDate: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Kiểu tính dạy/TG</span>
            <select className="input" value={form.payMode} onChange={(e) => setForm((f) => ({ ...f, payMode: e.target.value }))}>
              <option value="HOURLY">Theo giờ</option>
              <option value="SESSION">Theo ca</option>
            </select>
          </label>
          {/* Một người một đơn giá là thực tế đang dùng (đối chiếu file quản lý: chỉ 1
              người làm cả 2 vai và trả cùng giá) — gõ 1 lần áp cho cả dạy lẫn trợ giảng,
              chỉ tách đôi khi thật sự trả khác nhau. */}
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">
              {form.payMode === "SESSION" ? "Đơn giá đứng lớp/ca" : "Đơn giá đứng lớp/giờ"}
            </span>
            <input
              className="input"
              type="number"
              value={form.teachingHourlyRate}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  teachingHourlyRate: e.target.value,
                  assistantHourlyRate: splitRates ? f.assistantHourlyRate : e.target.value,
                }))
              }
            />
            <div className="flex items-center justify-between gap-2">
              <p className="form-hint">{form.teachingHourlyRate ? formatVnd(Number(form.teachingHourlyRate) || 0) : ""}</p>
              <button
                type="button"
                onClick={() => setSplitRates((current) => !current)}
                className="text-[11px] font-semibold text-[#2563eb] hover:underline"
              >
                {splitRates ? "Dùng chung 1 đơn giá" : "Trả khác khi trợ giảng?"}
              </button>
            </div>
          </label>
          {splitRates ? (
            <label className="space-y-1">
              <span className="text-xs font-medium text-ink-muted48">
                {form.payMode === "SESSION" ? "Đơn giá trợ giảng/ca" : "Đơn giá trợ giảng/giờ"}
              </span>
              <input className="input" type="number" value={form.assistantHourlyRate} onChange={(e) => setForm((f) => ({ ...f, assistantHourlyRate: e.target.value }))} />
              <p className="form-hint">{form.assistantHourlyRate ? formatVnd(Number(form.assistantHourlyRate) || 0) : ""}</p>
            </label>
          ) : null}
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Đơn giá 1 công HC</span>
            <input className="input" type="number" value={form.staffDailyRate} onChange={(e) => setForm((f) => ({ ...f, staffDailyRate: e.target.value }))} />
            <p className="form-hint">{form.staffDailyRate ? formatVnd(Number(form.staffDailyRate) || 0) : ""}</p>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Ngân hàng</span>
            <input className="input" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Số tài khoản</span>
            <input className="input" value={form.bankAccountNumber} onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Chủ tài khoản</span>
            <input className="input" value={form.bankAccountHolder} onChange={(e) => setForm((f) => ({ ...f, bankAccountHolder: e.target.value }))} />
          </label>
          {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
          <div className="col-span-full flex gap-2">
            <button type="submit" disabled={loading} className={ACTION_CLASS}>
              {loading ? "Đang lưu..." : "Lưu"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
