"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEmployeeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    shortName: "",
    position: "",
    phone: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountHolder: "",
    payMode: "HOURLY",
    teachingHourlyRate: "",
    assistantHourlyRate: "",
    staffDailyRate: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo nhân viên.");
      return;
    }
    setForm({
      fullName: "",
      shortName: "",
      position: "",
      phone: "",
      bankName: "",
      bankAccountNumber: "",
      bankAccountHolder: "",
      payMode: "HOURLY",
      teachingHourlyRate: "",
      assistantHourlyRate: "",
      staffDailyRate: "",
    });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Thêm nhân viên
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <input required placeholder="Họ tên *" className="input" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
      <input required placeholder="Tên ngắn *" className="input" value={form.shortName} onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))} />
      <input placeholder="Vị trí" className="input" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
      <input placeholder="SĐT" className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      <input placeholder="Ngân hàng" className="input" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
      <input placeholder="Số tài khoản" className="input" value={form.bankAccountNumber} onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))} />
      <input placeholder="Chủ tài khoản" className="input" value={form.bankAccountHolder} onChange={(e) => setForm((f) => ({ ...f, bankAccountHolder: e.target.value }))} />
      <select className="input" value={form.payMode} onChange={(e) => setForm((f) => ({ ...f, payMode: e.target.value }))}>
        <option value="HOURLY">Tính dạy/TG theo giờ</option>
        <option value="SESSION">Tính dạy/TG theo ca</option>
      </select>
      <input
        type="number"
        placeholder={form.payMode === "SESSION" ? "Đơn giá dạy/ca" : "Đơn giá dạy/giờ"}
        className="input"
        value={form.teachingHourlyRate}
        onChange={(e) => setForm((f) => ({ ...f, teachingHourlyRate: e.target.value }))}
      />
      <input
        type="number"
        placeholder={form.payMode === "SESSION" ? "Đơn giá TG/ca" : "Đơn giá TG/giờ"}
        className="input"
        value={form.assistantHourlyRate}
        onChange={(e) => setForm((f) => ({ ...f, assistantHourlyRate: e.target.value }))}
      />
      <input
        type="number"
        placeholder="Đơn giá 1 công HC"
        className="input"
        value={form.staffDailyRate}
        onChange={(e) => setForm((f) => ({ ...f, staffDailyRate: e.target.value }))}
      />
      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      <div className="col-span-full flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Đang lưu..." : "Lưu"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Hủy
        </button>
      </div>
    </form>
  );
}
