"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EmployeeProfile = {
  id: string;
  dob: string | null;
  phone: string | null;
  email: string | null;
  hometown: string | null;
  permanentAddress: string | null;
  idNumber: string | null;
  idIssueDate: string | null;
  idIssuePlace: string | null;
  resignDate: string | null;
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
}: {
  employee: EmployeeProfile;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    dob: toDateInput(employee.dob),
    phone: employee.phone ?? "",
    email: employee.email ?? "",
    hometown: employee.hometown ?? "",
    permanentAddress: employee.permanentAddress ?? "",
    idNumber: employee.idNumber ?? "",
    idIssueDate: toDateInput(employee.idIssueDate),
    idIssuePlace: employee.idIssuePlace ?? "",
    resignDate: toDateInput(employee.resignDate),
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
    ["Ngày sinh", formatDate(employee.dob)],
    ["SĐT", employee.phone ?? "—"],
    ["Mail", employee.email ?? "—"],
    ["Quê quán", employee.hometown ?? "—"],
    ["Địa chỉ thường trú", employee.permanentAddress ?? "—"],
    ["Số CMT/CCCD", employee.idNumber ?? "—"],
    ["Ngày cấp", formatDate(employee.idIssueDate)],
    ["Nơi cấp", employee.idIssuePlace ?? "—"],
    ["Ngày nghỉ", formatDate(employee.resignDate)],
  ];

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Thông tin nhân sự</h2>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost text-sm">
            Sửa
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-hairline/60 py-1 sm:justify-start sm:gap-3">
              <dt className="text-ink-muted48">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <form onSubmit={save} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
          <div className="col-span-full flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary">
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
