"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CASH_TXN_TYPE_LABEL } from "@/lib/server/cash-rules";

type Category = { id: string; type: string; name: string; detail: string | null };

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

export default function CategoryManager({
  categories,
  amountByCategory = {},
}: {
  categories: Category[];
  amountByCategory?: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "CHI", name: "", detail: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const grouped = useMemo(
    () => ({
      THU: categories.filter((category) => category.type === "THU"),
      CHI: categories.filter((category) => category.type === "CHI"),
    }),
    [categories],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/cash-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không thể tạo danh mục.");
      return;
    }

    setForm({ type: "CHI", name: "", detail: "" });
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Phân loại giao dịch</p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">Danh mục thu chi</h2>
          <p className="mt-1 text-sm text-ink-muted48">Dùng để gắn đúng loại cho từng giao dịch thu hoặc chi.</p>
        </div>
        <button className="btn-ghost text-xs" onClick={() => setOpen((current) => !current)}>
          {open ? "Đóng form" : "+ Thêm danh mục"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(["THU", "CHI"] as const).map((type) => (
          <div key={type} className={`rounded-[24px] border p-4 ${type === "THU" ? "border-emerald-100 bg-emerald-50/60" : "border-rose-100 bg-rose-50/60"}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${type === "THU" ? "text-emerald-700" : "text-rose-700"}`}>
                  {CASH_TXN_TYPE_LABEL[type]}
                </p>
                <p className="mt-1 text-sm text-ink-muted48">{grouped[type].length} danh mục</p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/80 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-hairline bg-[#f9fbff] text-xs uppercase tracking-wide text-ink-muted48">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tên danh mục</th>
                    <th className="px-4 py-3 font-medium">Chi tiết</th>
                    <th className="px-4 py-3 text-right font-medium">Số tiền kỳ này</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[type].map((category) => (
                    <tr key={category.id} className="border-b border-hairline last:border-0">
                      <td className="px-4 py-3 font-medium text-ink">{category.name}</td>
                      <td className="px-4 py-3 text-ink-muted80">{category.detail || "—"}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${type === "THU" ? "text-emerald-700" : "text-rose-700"}`}>
                        {amountByCategory[category.name] ? formatVnd(amountByCategory[category.name]) : "—"}
                      </td>
                    </tr>
                  ))}
                  {grouped[type].length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-ink-muted48">
                        Chưa có danh mục nào.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-5 grid gap-4 rounded-3xl border border-line/70 bg-surface/70 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="form-group">
              <span className="label-sm">Loại danh mục</span>
              <select className="input" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                <option value="CHI">Chi</option>
                <option value="THU">Thu</option>
              </select>
            </label>
            <label className="form-group">
              <span className="label-sm">Tên danh mục</span>
              <input required placeholder="VD: Thu học phí ngoài hệ thống, chi mua vật tư..." className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="form-group">
              <span className="label-sm">Chi tiết loại</span>
              <input placeholder="Mô tả ngắn để người nhập tiền hiểu đúng" className="input" value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} />
            </label>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu danh mục"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
