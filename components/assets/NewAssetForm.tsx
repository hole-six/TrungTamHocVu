"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";
import FormGuide from "@/components/ui/FormGuide";

const INITIAL_FORM = {
  name: "",
  assetCode: "",
  category: "",
  room: "",
  unitName: "cái",
  quantity: "1",
  unitValue: "",
  notes: "",
};

const GUIDE_SECTIONS = [
  {
    title: "Form này dùng khi nào?",
    items: [
      "Dùng khi cơ sở vừa mua mới hoặc vừa tiếp nhận một tài sản/thiết bị cần đưa vào hệ thống.",
      "Mỗi dòng nên đại diện cho một nhóm tài sản cùng loại, cùng đơn giá và cùng vị trí sử dụng để sau này đối chiếu dễ.",
      "Nếu chỉ sửa thông tin tài sản đã có thì không tạo mới, hãy dùng nút sửa để tránh trùng dữ liệu.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cần chuẩn bị trước khi nhập",
    items: [
      "Tên tài sản dễ hiểu, ví dụ: Máy lạnh phòng P.203, Bàn học sinh gỗ nhỏ.",
      "Số lượng hiện có thực tế tại cơ sở.",
      "Đơn giá gốc của 1 đơn vị tài sản để hệ thống tính ra giá trị ban đầu.",
      "Phòng/vị trí đang dùng để người vận hành khác nhìn vào biết tài sản đang ở đâu.",
    ],
    tone: "success" as const,
  },
  {
    title: "Các bước nhập đúng",
    items: [
      "Bước 1: nhập tên tài sản rõ ràng, đừng đặt chung chung như 'bàn' hay 'máy'.",
      "Bước 2: nếu cơ sở có quy tắc mã tài sản thì nhập mã để sau này tìm nhanh và dán tem dễ hơn.",
      "Bước 3: chọn nhóm tài sản theo đúng bản chất: nội thất, điện lạnh, máy tính, thiết bị giảng dạy...",
      "Bước 4: nhập số lượng và đơn giá của 1 đơn vị, hệ thống sẽ tự dùng 2 giá trị này để tính giá trị gốc.",
      "Bước 5: thêm ghi chú nếu có bảo hành, model, nguồn gốc hoặc tình trạng lúc nhận.",
    ],
    tone: "info" as const,
  },
  {
    title: "Lỗi hay gặp cần tránh",
    items: [
      "Không nhập tổng tiền vào ô đơn giá nếu đang có nhiều cái. Ô này chỉ là giá của 1 đơn vị.",
      "Không gom nhiều loại tài sản khác nhau vào cùng một bản ghi vì sau này bảo dưỡng và thanh lý sẽ rất rối.",
      "Không bỏ trống phòng/vị trí nếu tài sản đã được đưa vào sử dụng thực tế.",
    ],
    tone: "warning" as const,
  },
];

export default function NewAssetForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể tạo tài sản.");
      return;
    }

    setForm(INITIAL_FORM);
    setOpen(false);
    router.push(`/assets/${result.item.id}`);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Thêm tài sản
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm tài sản / thiết bị"
        description="Nhập đúng tài sản đang có thực tế để hệ thống theo dõi số lượng, giá gốc và lịch sử vận hành chuẩn ngay từ đầu."
        guide={<FormGuide title="Hướng dẫn thêm tài sản mới" summary="Đây là form khởi tạo tài sản ban đầu cho cơ sở. Nếu nhập chuẩn từ đầu, các bước bảo dưỡng, điều chuyển và đối chiếu giá trị sau này sẽ rất gọn." sections={GUIDE_SECTIONS} position="inline" />}
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group">
              <span className="label">Tên tài sản</span>
              <input required className="input" placeholder="Ví dụ: Bàn học sinh gỗ nhỏ" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Mã tài sản</span>
              <input className="input" placeholder="Ví dụ: TS-BAN-001" value={form.assetCode} onChange={(event) => setForm((current) => ({ ...current, assetCode: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Nhóm tài sản</span>
              <input className="input" placeholder="Ví dụ: Nội thất, điện lạnh, máy tính" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Phòng / vị trí</span>
              <input className="input" placeholder="Ví dụ: Phòng P.102" value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Đơn vị tính</span>
              <input className="input" placeholder="Ví dụ: cái, bộ, chiếc" value={form.unitName} onChange={(event) => setForm((current) => ({ ...current, unitName: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Số lượng hiện có</span>
              <input type="number" min={0} step={1} className="input" placeholder="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Giá trị / 1 đơn vị</span>
              <input type="number" min={0} step={1000} className="input" placeholder="1500000" value={form.unitValue} onChange={(event) => setForm((current) => ({ ...current, unitValue: event.target.value }))} />
              <p className="form-hint">Ví dụ 1 bộ bàn ghế trị giá 1.500.000đ thì nhập đúng giá của 1 bộ.</p>
            </label>
          </div>

          <label className="form-group">
            <span className="label">Ghi chú</span>
            <textarea rows={4} className="input resize-none" placeholder="Ghi chú bảo hành, tình trạng ban đầu, model, xuất xứ..." value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex flex-wrap gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu tài sản"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
