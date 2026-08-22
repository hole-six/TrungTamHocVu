"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";

const GUIDE_SECTIONS = [
  {
    title: "Khi nào nên sửa tài sản?",
    items: [
      "Dùng khi cần cập nhật tên, nhóm, vị trí, đơn vị tính, đơn giá hoặc trạng thái vận hành của tài sản đang có.",
      "Nếu mục đích là ghi nhận chi phí sửa chữa thì không sửa trực tiếp ở đây, hãy dùng thao tác bảo dưỡng để hệ thống cộng tiền đúng.",
      "Nếu tài sản di chuyển sang phòng khác nhiều lần, nên cập nhật đúng vị trí hiện tại để người sau tra cứu không bị lệch.",
    ],
    tone: "info" as const,
  },
  {
    title: "Các bước chỉnh an toàn",
    items: [
      "Kiểm tra đúng tên tài sản trước khi sửa để tránh chạm nhầm dòng dữ liệu khác.",
      "Đơn giá là giá gốc của 1 đơn vị tài sản, không phải tổng giá trị của cả nhóm.",
      "Trạng thái nên phản ánh thực tế hiện tại: đang dùng, đang bảo trì, hỏng hoặc đã thanh lý.",
    ],
    tone: "success" as const,
  },
  {
    title: "Điểm dễ nhầm",
    items: [
      "Không đổi trạng thái sang thanh lý nếu tài sản vẫn đang được dùng hoặc chưa có quyết định chốt bỏ.",
      "Không dùng form này để tăng tiền sửa chữa, vì như vậy sẽ làm sai lịch sử chi phí bảo dưỡng.",
      "Nếu chỉ sửa ghi chú, vẫn nên mô tả rõ lý do để người sau đọc lịch sử dễ hiểu.",
    ],
    tone: "warning" as const,
  },
];

export default function AssetEditForm({
  assetId,
  initial,
  compact = false,
}: {
  assetId: string;
  initial: {
    status: string;
    name: string;
    category: string;
    room: string;
    unitName: string;
    unitValue: string;
    maintenanceIntervalMonths: string;
    notes: string;
  };
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không lưu được thay đổi.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex min-w-[84px] items-center justify-center gap-1 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
            : "btn-ghost w-full"
        }
      >
        Sửa{!compact ? " thông tin tài sản" : ""}
      </button>

      <ResponsiveDrawer 
        open={open}
        onClose={() => setOpen(false)}
        title="Sửa tài sản"
        description="Cập nhật thông tin nền của tài sản để danh sách, đối chiếu và vận hành phản ánh đúng thực tế hiện tại."
        guide={<FormGuide title="Hướng dẫn sửa tài sản" summary="Form này chỉ dành cho việc chỉnh thông tin gốc của tài sản. Những phát sinh tiền sửa chữa, bảo trì hoặc điều chuyển nên đi đúng luồng riêng để hệ thống giữ được lịch sử rõ ràng." sections={GUIDE_SECTIONS} position="inline" />}
      >
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group md:col-span-2">
              <span className="label">Tên tài sản</span>
              <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Nhóm</span>
              <input className="input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Phòng / vị trí</span>
              <input className="input" value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Đơn vị tính</span>
              <input className="input" value={form.unitName} onChange={(event) => setForm((current) => ({ ...current, unitName: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Giá trị / đơn vị</span>
              <CurrencyInput value={form.unitValue} onChange={(next) => setForm((current) => ({ ...current, unitValue: String(next) }))} />
              <p className="form-hint">{form.unitValue ? formatVnd(Number(form.unitValue) || 0) : "Giá gốc của 1 đơn vị tài sản."}</p>
            </label>

            <label className="form-group">
              <span className="label">Chu kỳ bảo dưỡng (tháng)</span>
              <input
                type="number"
                min={1}
                step={1}
                className="input"
                placeholder="VD: 3, 6, 12"
                value={form.maintenanceIntervalMonths}
                onChange={(event) => setForm((current) => ({ ...current, maintenanceIntervalMonths: event.target.value }))}
              />
              <p className="form-hint">Để trống nếu tài sản này không cần lịch bảo dưỡng định kỳ.</p>
            </label>

            <label className="form-group md:col-span-2">
              <span className="label">Trạng thái</span>
              <select className="input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="ACTIVE">Đang sử dụng</option>
                <option value="MAINTENANCE">Đang bảo trì</option>
                <option value="BROKEN">Hỏng</option>
                <option value="DISPOSED">Đã thanh lý</option>
              </select>
            </label>
          </div>

          <label className="form-group">
            <span className="label">Ghi chú</span>
            <textarea className="input resize-none" rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex flex-wrap gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      </ResponsiveDrawer>
    </>
  );
}
