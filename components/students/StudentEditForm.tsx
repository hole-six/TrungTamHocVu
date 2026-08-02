"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormGuide from "@/components/ui/FormGuide";

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
};

const STUDENT_EDIT_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu form này",
    items: [
      "Đây là form cập nhật hồ sơ cơ bản của học viên như trạng thái, giới tính, liên hệ và ghi chú nội bộ.",
      "Form này không phải nơi xử lý học phí hay lớp học, mà tập trung vào dữ liệu hồ sơ nền.",
      "Các thay đổi ở đây sẽ ảnh hưởng đến cách hiển thị hồ sơ học viên trên toàn hệ thống.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác nhanh",
    items: [
      "Chỉ đổi trạng thái sang Đã nghỉ khi học viên thực sự ngừng học.",
      "Nếu đánh dấu đã nghỉ, nên điền rõ lý do để đội vận hành sau này tra cứu dễ hơn.",
      "Các ô đánh giá và ghi chú nội bộ nên viết ngắn, rõ ý và phục vụ người xử lý tiếp theo.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Đổi trạng thái học viên không tự thay thế cho thao tác rút lớp ở lớp đang học.",
      "Số điện thoại, địa chỉ và ghi chú là dữ liệu được dùng nhiều khi CSO hoặc giáo viên tra cứu lại.",
      "Nếu chỉ sửa thông tin hồ sơ, không cần đụng sang phần học phí để tránh nhầm luồng xử lý.",
    ],
    tone: "warning" as const,
  },
];

export default function StudentEditForm({ studentId, initial }: Props) {
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
  }

  return (
    <div className="card">
      <FormGuide
        title="Guide cập nhật hồ sơ"
        summary="Giải thích nhanh phần nào là hồ sơ nền, phần nào không nên sửa ở form này."
        sections={STUDENT_EDIT_GUIDE_SECTIONS}
        position="inline"
        buttonLabel="Guide hồ sơ"
      />
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
        <h2 className="font-display text-base font-bold tracking-tight text-ink">Cập nhật hồ sơ</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Status toggle */}
        <div className="form-group">
          <label className="label">Trạng thái học</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "ACTIVE", label: "✅ Đang học", color: "border-emerald-400 bg-emerald-50 text-emerald-700" },
              { value: "LEFT",   label: "🚫 Đã nghỉ",  color: "border-red-400 bg-red-50 text-red-700" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("status", opt.value)}
                className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
                  form.status === opt.value
                    ? opt.color + " shadow-sm"
                    : "border-[#e2e8f0] bg-white text-ink-muted80"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gender + DOB */}
        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="label">Giới tính</label>
            <select className="input" value={form.gender} onChange={(e) => update("gender", e.target.value)}>
              <option value="">— Chọn —</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Ngày sinh</label>
            <input type="date" className="input" value={form.dob} onChange={(e) => update("dob", e.target.value)} />
          </div>
        </div>

        {/* Phone */}
        <div className="form-group">
          <label className="label">Số điện thoại</label>
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted48">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l.38-.38a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 17z"/>
            </svg>
            <input
              className="input pl-9"
              placeholder="0912 345 678"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
        </div>

        {/* Address */}
        <div className="form-group">
          <label className="label">Địa chỉ</label>
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted48">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <input
              className="input pl-9"
              placeholder="Số nhà, đường, phường/xã..."
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>
        </div>

        {/* Leave reason — conditional */}
        {form.status === "LEFT" && (
          <div className="form-group rounded-xl border border-red-200 bg-red-50 p-4">
            <label className="label text-red-700">Lý do nghỉ học</label>
            <input
              className="input border-red-200 bg-white focus:border-red-400 focus:ring-red-200"
              placeholder="VD: Chuyển trường, điều kiện gia đình..."
              value={form.leaveReason}
              onChange={(e) => update("leaveReason", e.target.value)}
            />
            <p className="form-hint text-red-600/70">Ngày nghỉ sẽ được ghi nhận là hôm nay.</p>
          </div>
        )}

        {/* Referred by */}
        <div className="form-group">
          <label className="label">Người giới thiệu</label>
          <input
            className="input"
            placeholder="Tên người giới thiệu (nếu có)"
            value={form.referredBy}
            onChange={(e) => update("referredBy", e.target.value)}
          />
        </div>

        {/* Evaluation */}
        <div className="form-group">
          <label className="label">Đánh giá học viên</label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Nhận xét năng lực, thái độ học tập..."
            value={form.evaluation}
            onChange={(e) => update("evaluation", e.target.value)}
          />
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="label">Ghi chú nội bộ</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Thông tin đặc biệt, lưu ý cho giáo viên, admin..."
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>

        {/* Feedback */}
        {error && <div className="alert-danger text-xs">{error}</div>}
        {saved && (
          <div className="alert-success flex items-center gap-1.5 text-xs">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Đã lưu thay đổi
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
              </svg>
              Đang lưu...
            </span>
          ) : "Lưu thay đổi"}
        </button>
      </form>
    </div>
  );
}
