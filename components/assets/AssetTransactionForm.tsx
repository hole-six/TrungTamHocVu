"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormGuide from "@/components/ui/FormGuide";
import DatePicker from "@/components/ui/DatePicker";
import { formatVnd } from "@/lib/export-utils";

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ACTION_OPTIONS = [
  { value: "MAINTENANCE", label: "Bảo dưỡng" },
  { value: "RECEIPT", label: "Nhập mới" },
  { value: "TRANSFER", label: "Điều chuyển" },
  { value: "ADJUSTMENT", label: "Điều chỉnh" },
  { value: "DISPOSAL", label: "Thanh lý" },
] as const;

const GUIDE_SECTIONS = [
  {
    title: "Chọn đúng loại giao dịch",
    items: [
      "Bảo dưỡng: khi phát sinh chi phí sửa chữa, vệ sinh, thay linh kiện.",
      "Nhập mới: khi cơ sở nhận thêm tài sản hoặc tăng số lượng đang có.",
      "Điều chuyển: khi tài sản được đưa sang phòng/vị trí khác.",
      "Điều chỉnh: khi cần cộng hoặc trừ số lượng để khớp thực tế kiểm kê.",
      "Thanh lý: khi loại bỏ bớt tài sản ra khỏi sử dụng.",
    ],
    tone: "info" as const,
  },
  {
    title: "Nguyên tắc vận hành",
    items: [
      "Bảo dưỡng đi theo tiền, các loại còn lại chủ yếu đi theo số lượng hoặc vị trí.",
      "Nếu giao dịch làm thay đổi số lượng, cần nhập thật cẩn thận vì nó ảnh hưởng trực tiếp tới giá trị gốc đang hiển thị.",
      "Nên ghi chú rõ lý do thao tác để người khác xem lịch sử là hiểu được ngay.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi hay gặp",
    items: [
      "Dùng bảo dưỡng cho việc mua mới là sai luồng.",
      "Điều chỉnh số lượng âm hoặc quá lớn sẽ làm lệch tồn nếu kiểm tra không kỹ.",
      "Điều chuyển mà không nhập vị trí mới thì người sau sẽ không biết tài sản hiện ở đâu.",
    ],
    tone: "warning" as const,
  },
];

export default function AssetTransactionForm({
  assetId,
  assetName,
}: {
  assetId: string;
  assetName?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState("MAINTENANCE");
  const [quantity, setQuantity] = useState("1");
  const [toRoom, setToRoom] = useState("");
  const [amount, setAmount] = useState("");
  const [selfMaintenance, setSelfMaintenance] = useState(false);
  const [txnDate, setTxnDate] = useState(todayYmd);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const res = await fetch(`/api/assets/${assetId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        quantity: Number(quantity),
        toRoom,
        amount: type === "MAINTENANCE" && selfMaintenance ? 0 : Number(amount),
        txnDate,
        notes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Không thể ghi giao dịch.");
      return;
    }

    setQuantity("1");
    setToRoom("");
    setAmount("");
    setSelfMaintenance(false);
    setTxnDate(todayYmd());
    setNotes("");
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card relative">
      <div className="absolute right-5 top-5">
        <FormGuide
          title="Hướng dẫn giao dịch tài sản"
          summary="Khối này dành cho mọi phát sinh sau khi tài sản đã được tạo: tăng thêm, điều chuyển, bảo dưỡng, kiểm kê chênh lệch hoặc thanh lý."
          sections={GUIDE_SECTIONS}
          position="inline"
        />
      </div>

      <div className="space-y-2 pr-28">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">Bảo dưỡng</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Tự cộng vào giá trị tài sản</span>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Ghi nhận giao dịch tài sản</h2>
          <p className="mt-1 text-sm text-ink-muted48">
            Ưu tiên thao tác bảo dưỡng: chỉ cần nhập số tiền, hệ thống sẽ tự cộng vào chi phí bảo dưỡng và tổng giá trị
            {assetName ? ` của ${assetName}` : ""}.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {ACTION_OPTIONS.map((option) => {
          const active = type === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setType(option.value)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                active ? "border-[#1f6feb] bg-[#1f6feb] text-white" : "border-[#dbe7ff] bg-white text-[#235f9d] hover:bg-[#f7fbff]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {type === "MAINTENANCE" ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50/60 p-4">
            <label className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600"
                checked={selfMaintenance}
                onChange={(e) => {
                  setSelfMaintenance(e.target.checked);
                  if (e.target.checked) setAmount("");
                }}
              />
              <span>
                <span className="block text-sm font-semibold text-emerald-800">Tự bảo dưỡng (không mất chi phí)</span>
                <span className="mt-0.5 block text-xs leading-5 text-emerald-700">
                  Dùng khi tự làm (vd: tự vệ sinh lưới lọc điều hòa), không phát sinh chi phí thật. Vẫn lưu lại lịch sử bảo dưỡng nhưng không sinh phiếu chi ở sổ quỹ.
                </span>
              </span>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-group">
                <span className="label">Số tiền bảo dưỡng</span>
                <input
                  required={!selfMaintenance}
                  disabled={selfMaintenance}
                  type="number"
                  min="1"
                  className="input disabled:cursor-not-allowed disabled:bg-[#f3f6fb] disabled:text-ink-muted48"
                  placeholder="VD: 350000"
                  value={selfMaintenance ? "0" : amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="form-hint">
                  {selfMaintenance
                    ? "Tự bảo dưỡng: không mất chi phí, số tiền ghi nhận là 0."
                    : amount
                      ? `Sẽ ghi nhận ${formatVnd(Number(amount) || 0)} vào chi phí bảo dưỡng.`
                      : "Nhập đúng số tiền thực tế đã chi."}
                </p>
              </label>

              <label className="form-group">
                <span className="label">Ghi chú bảo dưỡng</span>
                <input className="input" placeholder="VD: thay linh kiện, vệ sinh máy..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>

              <label className="form-group">
                <span className="label">Ngày bảo dưỡng thực tế</span>
                <DatePicker value={txnDate} onChange={setTxnDate} />
                <p className="form-hint">Nhập trễ thì chọn đúng ngày đã sửa để lịch bảo dưỡng tính đúng hạn kế tiếp.</p>
              </label>
            </div>

            <div className="mt-3 rounded-2xl border border-white bg-white px-4 py-3 text-xs text-amber-800">
              {selfMaintenance ? (
                <>
                  Khoản này sẽ:
                  <div className="mt-2 space-y-1">
                    <p>- lưu vào lịch sử bảo dưỡng của tài sản (0đ)</p>
                    <p>- không cộng chi phí, không sinh phiếu chi trong sổ quỹ</p>
                  </div>
                </>
              ) : (
                <>
                  Khoản này sẽ:
                  <div className="mt-2 space-y-1">
                    <p>- cộng vào tiền bảo dưỡng của tài sản</p>
                    <p>- cộng vào tổng giá trị hiện tại</p>
                    <p>- tự sinh 1 phiếu chi trong sổ quỹ</p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {type !== "TRANSFER" && type !== "MAINTENANCE" ? (
          <label className="form-group">
            <span className="label">Số lượng</span>
            <input type="number" className="input" placeholder={type === "ADJUSTMENT" ? "Số lượng (+/-)" : "Số lượng"} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
        ) : null}

        {type === "TRANSFER" ? (
          <label className="form-group">
            <span className="label">Phòng / vị trí mới</span>
            <input required className="input" placeholder="Phòng/vị trí mới" value={toRoom} onChange={(e) => setToRoom(e.target.value)} />
          </label>
        ) : null}

        {type !== "MAINTENANCE" ? (
          <label className="form-group">
            <span className="label">Ghi chú</span>
            <input className="input" placeholder="Ghi chú ngắn" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {saved && !error ? <p className="text-sm text-emerald-600">Đã lưu giao dịch.</p> : null}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Đang lưu..." : type === "MAINTENANCE" ? "Xác nhận bảo dưỡng" : "Lưu giao dịch"}
        </button>
      </form>
    </div>
  );
}
