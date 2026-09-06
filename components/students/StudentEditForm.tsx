"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";

type Props = {
  studentId: string;
  initial: {
    status: string;
    gender: string;
    dob: string;
    phone: string;
    address: string;
    leaveReason: string;
    evaluation: string;
    referredBy: string;
    notes: string;
  };
  /** Báo cho nơi đang giữ dữ liệu trong state (drawer) nạp lại sau khi lưu. */
  onChanged?: () => void;
};

// Form sửa hồ sơ — CỐ TÌNH không tự vẽ khung/tiêu đề/guide: cả 2 nơi gọi (drawer học
// viên và tab "Hồ sơ" ở trang chi tiết) đều đã có sẵn khung và đã ghi "Cập nhật hồ sơ"
// ngay phía trên, nên khung + icon + tiêu đề của riêng form chỉ tạo khung lồng khung và
// lặp lại đúng dòng chữ đó lần thứ hai.
export default function StudentEditForm({ studentId, initial, onChanged }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        dob: form.dob || null,
        leaveDate: form.status === "LEFT" ? new Date().toISOString() : null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể cập nhật.");
      return;
    }
    setSaved(true);
    router.refresh();
    onChanged?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Một lưới 2 cột duy nhất cho mọi trường — trước đây xen kẽ hàng 2 cột và hàng
          1 cột tràn ngang (địa chỉ, trạng thái) nên các ô không thẳng cột với nhau. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="label-sm">Trạng thái học</span>
          <select
            className={`input font-semibold ${form.status === "LEFT" ? "text-red-700" : "text-emerald-700"}`}
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="ACTIVE">Đang học</option>
            <option value="LEFT">Đã nghỉ</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="label-sm">Giới tính</span>
          <select className="input" value={form.gender} onChange={(e) => update("gender", e.target.value)}>
            <option value="">— Chọn —</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="label-sm">Ngày sinh</span>
          <input type="date" className="input" value={form.dob} onChange={(e) => update("dob", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="label-sm">Số điện thoại</span>
          <input className="input" placeholder="0912 345 678" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="label-sm">Người giới thiệu</span>
          <input
            className="input"
            placeholder="Tên người giới thiệu (nếu có)"
            value={form.referredBy}
            onChange={(e) => update("referredBy", e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="label-sm">Địa chỉ</span>
          <input
            className="input"
            placeholder="Số nhà, đường, phường/xã..."
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </label>
      </div>

      {/* Chỉ hiện khi thực sự chuyển sang đã nghỉ — giữ nguyên viền đỏ vì đây là cảnh
          báo thật (ghi nhận ngày nghỉ), không phải màu trang trí. */}
      {form.status === "LEFT" ? (
        <label className="block space-y-1 rounded-xl border border-red-200 bg-red-50 p-3">
          <span className="label-sm text-red-700">Lý do nghỉ học</span>
          <input
            className="input border-red-200 bg-white focus:border-red-400 focus:ring-red-200"
            placeholder="VD: Chuyển trường, điều kiện gia đình..."
            value={form.leaveReason}
            onChange={(e) => update("leaveReason", e.target.value)}
          />
          <span className="block text-xs text-red-700">Ngày nghỉ sẽ được ghi nhận là hôm nay.</span>
        </label>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="label-sm">Đánh giá học viên</span>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Nhận xét năng lực, thái độ học tập..."
            value={form.evaluation}
            onChange={(e) => update("evaluation", e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="label-sm">Ghi chú nội bộ</span>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Thông tin đặc biệt, lưu ý cho giáo viên, admin..."
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Đã lưu thay đổi.</p> : null}

      <button type="submit" disabled={loading} className={ACTION_CLASS}>
        {loading ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}
