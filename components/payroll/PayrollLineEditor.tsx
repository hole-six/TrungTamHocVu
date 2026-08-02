"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

export default function PayrollLineEditor({ lineId, bonus, penalty, employeeName }: { lineId: string; bonus: number; penalty: number; employeeName: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bonus: String(bonus), penalty: String(penalty) });
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    await fetch(`/api/payroll-lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bonus: Number(form.bonus), penalty: Number(form.penalty) }),
    });
    setLoading(false);
    setEditing(false);
    router.refresh();
  }

  async function removeLine() {
    setLoading(true);
    const res = await fetch(`/api/payroll-lines/${lineId}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Không thể xóa dòng lương.");
      return;
    }
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-end gap-2">
        <button 
          onClick={() => setEditing(true)} 
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#fed7aa] bg-white px-3 py-2 text-xs font-bold text-[#f97316] transition-all hover:bg-[#fff7ed] hover:shadow-md"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Sửa
        </button>
        <ConfirmActionButton
          title="Xác nhận xóa dòng lương?"
          description={`Dòng lương của ${employeeName} sẽ bị xóa khỏi kỳ hiện tại.`}
          confirmLabel="Xóa dòng lương"
          tone="danger"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-50 hover:shadow-md"
          onConfirm={removeLine}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          Xóa
        </ConfirmActionButton>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Thưởng</label>
          <input 
            type="number" 
            placeholder="0" 
            className="w-24 rounded-lg border-2 border-[#e5e7eb] px-2 py-1.5 text-xs font-semibold text-emerald-600 focus:border-[#f97316] focus:outline-none" 
            value={form.bonus} 
            onChange={(e) => setForm((f) => ({ ...f, bonus: e.target.value }))} 
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Phạt</label>
          <input 
            type="number" 
            placeholder="0" 
            className="w-24 rounded-lg border-2 border-[#e5e7eb] px-2 py-1.5 text-xs font-semibold text-red-600 focus:border-[#f97316] focus:outline-none" 
            value={form.penalty} 
            onChange={(e) => setForm((f) => ({ ...f, penalty: e.target.value }))} 
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button 
          onClick={save} 
          disabled={loading} 
          className="inline-flex items-center justify-center gap-1 rounded-lg border-2 border-emerald-200 bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {loading ? "Lưu..." : "Lưu"}
        </button>
        <button 
          onClick={() => setEditing(false)} 
          disabled={loading}
          className="inline-flex items-center justify-center gap-1 rounded-lg border-2 border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-bold text-[#6b7280] transition-all hover:bg-[#fafafa] disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Hủy
        </button>
      </div>
    </div>
  );
}
