"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Holiday = {
  id: string;
  date: string | Date;
  name: string;
  branch: { name: string };
};

type BranchOption = { id: string; name: string };

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

export default function HolidayManager({
  holidays,
  branches,
  defaultBranchId,
}: {
  holidays: Holiday[];
  branches: BranchOption[];
  defaultBranchId: string;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addHoliday(event: React.FormEvent) {
    event.preventDefault();
    if (!branchId || !date || !name.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, date, name: name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Không thể thêm ngày nghỉ lễ.");
      return;
    }
    setDate("");
    setName("");
    router.refresh();
  }

  async function removeHoliday(id: string) {
    setDeletingId(id);
    await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addHoliday} className="card flex flex-wrap items-end gap-3">
        <label className="form-group">
          <span className="label-sm">Cơ sở</span>
          <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-group">
          <span className="label-sm">Ngày nghỉ lễ</span>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="form-group flex-1 min-w-[200px]">
          <span className="label-sm">Tên ngày lễ</span>
          <input
            type="text"
            className="input"
            placeholder="Ví dụ: Giỗ Tổ Hùng Vương"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Đang lưu..." : "+ Thêm ngày nghỉ lễ"}
        </button>
        {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Ngày</th>
              <th className="px-4 py-3 font-medium">Tên ngày lễ</th>
              <th className="px-4 py-3 font-medium">Cơ sở</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id} className="border-b border-hairline last:border-0">
                <td className="px-4 py-3 font-medium">{formatDate(h.date)}</td>
                <td className="px-4 py-3">{h.name}</td>
                <td className="px-4 py-3 text-ink-muted80">{h.branch.name}</td>
                <td className="px-4 py-3 text-right">
                  <ConfirmActionButton
                    title="Xác nhận xóa ngày nghỉ?"
                    description={`Ngày nghỉ "${h.name}" tại ${h.branch.name} sẽ bị xóa khỏi lịch hệ thống.`}
                    confirmLabel="Xóa ngày nghỉ"
                    tone="danger"
                    disabled={deletingId === h.id}
                    className="text-xs text-red-600"
                    onConfirm={() => removeHoliday(h.id)}
                  >
                    {deletingId === h.id ? "..." : "Xóa"}
                  </ConfirmActionButton>
                </td>
              </tr>
            ))}
            {holidays.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa khai báo ngày nghỉ lễ nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
