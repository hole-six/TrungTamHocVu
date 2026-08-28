"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CASH_TXN_TYPE_LABEL } from "@/lib/server/cash-rules";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { formatVnd } from "@/lib/export-utils";

type Category = { id: string; type: string; name: string; detail: string | null };

function CategoryRow({
  category,
  type,
  amount,
  onSaved,
}: {
  category: Category;
  type: "THU" | "CHI";
  amount: number | undefined;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [detail, setDetail] = useState(category.detail ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/cash-categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, detail }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể lưu danh mục.");
      return;
    }
    setEditing(false);
    onSaved();
  }

  async function remove() {
    const res = await fetch(`/api/cash-categories/${category.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Không thể xóa danh mục.");
      return;
    }
    onSaved();
  }

  if (editing) {
    return (
      <tr className="border-b border-hairline last:border-0 bg-[#fbfdff]">
        <td className="px-4 py-2">
          <span className={`badge ${type === "THU" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            {CASH_TXN_TYPE_LABEL[type]}
          </span>
        </td>
        <td className="px-4 py-2">
          <input className="input h-8 text-xs" value={name} onChange={(e) => setName(e.target.value)} />
        </td>
        <td className="px-4 py-2">
          <input className="input h-8 text-xs" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Chi tiết" />
        </td>
        <td className="px-4 py-2 text-right text-ink-muted48">—</td>
        <td className="px-4 py-2">
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={save} disabled={loading} className="text-xs font-semibold text-primary">
              {loading ? "..." : "Lưu"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-muted48">
              Hủy
            </button>
          </div>
          {error ? <p className="mt-1 text-right text-[11px] text-red-600">{error}</p> : null}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-hairline last:border-0">
      <td className="px-4 py-3">
        <span className={`badge ${type === "THU" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
          {CASH_TXN_TYPE_LABEL[type]}
        </span>
      </td>
      <td className="px-4 py-3 font-medium text-ink">{category.name}</td>
      <td className="px-4 py-3 text-ink-muted80">{category.detail || "—"}</td>
      <td className={`px-4 py-3 text-right font-semibold ${type === "THU" ? "text-emerald-700" : "text-rose-700"}`}>
        {amount ? formatVnd(amount) : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-primary">
            Sửa
          </button>
          <ConfirmActionButton
            title="Xác nhận xóa danh mục?"
            description={`Xóa danh mục "${category.name}"${category.detail ? ` (${category.detail})` : ""}. Chỉ xóa được khi chưa có giao dịch nào dùng danh mục này.`}
            confirmLabel="Xóa danh mục"
            tone="danger"
            className="text-xs text-red-600"
            onConfirm={remove}
          >
            Xóa
          </ConfirmActionButton>
        </div>
        {error ? <p className="mt-1 text-right text-[11px] text-red-600">{error}</p> : null}
      </td>
    </tr>
  );
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
  const [typeFilter, setTypeFilter] = useState<"ALL" | "THU" | "CHI">("ALL");
  const [nameFilter, setNameFilter] = useState("");
  const [detailFilter, setDetailFilter] = useState("");
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");

  // Trước đây tách riêng 2 bảng THU/CHI cạnh nhau (2 tiêu đề + 2 khung riêng) — người
  // dùng muốn gộp thành đúng 1 bảng, phân biệt loại bằng cột "Loại" thay vì tách khối.
  // THU xếp trước CHI (đúng thứ tự "thu chi" quen thuộc), mỗi nhóm sắp theo tên.
  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => {
        if (a.type !== b.type) return a.type === "THU" ? -1 : 1;
        return a.name.localeCompare(b.name, "vi");
      }),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const name = nameFilter.trim().toLowerCase();
    const detail = detailFilter.trim().toLowerCase();
    return sortedCategories.filter((category) => {
      if (typeFilter !== "ALL" && category.type !== typeFilter) return false;
      if (name && !category.name.toLowerCase().includes(name)) return false;
      if (detail && !(category.detail ?? "").toLowerCase().includes(detail)) return false;
      const amount = amountByCategory[category.name] ?? 0;
      if (amountFrom && amount < Number(amountFrom)) return false;
      if (amountTo && amount > Number(amountTo)) return false;
      return true;
    });
  }, [sortedCategories, typeFilter, nameFilter, detailFilter, amountFrom, amountTo, amountByCategory]);

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

      <div className="mt-5 overflow-hidden rounded-2xl border border-hairline bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-[#f9fbff] text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Loại</th>
              <th className="px-4 py-3 font-medium">Tên danh mục</th>
              <th className="px-4 py-3 font-medium">Chi tiết</th>
              <th className="px-4 py-3 text-right font-medium">Số tiền kỳ này</th>
              <th className="px-4 py-3 text-right font-medium">Thao tác</th>
            </tr>
            <tr className="border-b border-hairline bg-[#f9fbff]">
              <th className="px-2 py-2 align-top">
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as "ALL" | "THU" | "CHI")}
                  className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-xs font-normal normal-case text-ink focus:border-primary focus:outline-none"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="THU">Thu</option>
                  <option value="CHI">Chi</option>
                </select>
              </th>
              <th className="px-2 py-2 align-top">
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(event) => setNameFilter(event.target.value)}
                  placeholder="Lọc tên..."
                  className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-xs font-normal normal-case text-ink placeholder:text-[#9ca3af] focus:border-primary focus:outline-none"
                />
              </th>
              <th className="px-2 py-2 align-top">
                <input
                  type="text"
                  value={detailFilter}
                  onChange={(event) => setDetailFilter(event.target.value)}
                  placeholder="Lọc chi tiết..."
                  className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-xs font-normal normal-case text-ink placeholder:text-[#9ca3af] focus:border-primary focus:outline-none"
                />
              </th>
              <th className="px-2 py-2 align-top">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={amountFrom}
                    onChange={(event) => setAmountFrom(event.target.value)}
                    placeholder="Từ"
                    className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  />
                  <input
                    type="number"
                    value={amountTo}
                    onChange={(event) => setAmountTo(event.target.value)}
                    placeholder="Đến"
                    className="w-full min-w-0 rounded-lg border border-[#d1d5db] bg-white px-2 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  />
                </div>
              </th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {filteredCategories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                type={category.type as "THU" | "CHI"}
                amount={amountByCategory[category.name]}
                onSaved={() => router.refresh()}
              />
            ))}
            {filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-ink-muted48">
                  Không có danh mục nào khớp bộ lọc hiện tại.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
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
