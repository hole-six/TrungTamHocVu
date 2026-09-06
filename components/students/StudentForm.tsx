"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";
import { useStudentDrawer } from "@/contexts/StudentDrawerContext";

type StudentFormProps = {
  initialData?: any;
  studentId?: string;
  /** Dùng khi form được mở trong drawer (vd danh sách học viên) thay vì trang riêng —
   *  đóng drawer thay vì điều hướng trang. */
  onCancel?: () => void;
  onCreated?: () => void;
};

function toDateInput(value: unknown) {
  if (!value) return "";
  return new Date(value as string).toISOString().slice(0, 10);
}

// Form tạo/sửa học viên — trước đây dựng bằng SmartForm: mỗi nhóm trường là 1 thẻ bo
// góc lớn có nền gradient + icon tròn, cộng 1 thanh "stepper" và 1 thanh nút dính ở
// đáy, tức là 6 khung lồng trong drawer vốn đã là 1 khung. Lưới của SmartForm còn là
// 3 cột trong khi drawer chỉ đủ rộng cho 2, nên các ô không bao giờ thẳng hàng. Giờ
// viết thẳng: 1 lưới 2 cột duy nhất, các nhóm ngăn nhau bằng 1 đường kẻ mảnh.
export default function StudentForm({ initialData, studentId, onCancel, onCreated }: StudentFormProps) {
  const router = useRouter();
  const { openDrawer } = useStudentDrawer();
  const isEdit = !!studentId;

  const [form, setForm] = useState({
    fullName: initialData?.fullName ?? "",
    gender: initialData?.gender ?? "",
    dob: toDateInput(initialData?.dob),
    phone: initialData?.phone ?? "",
    address: initialData?.address ?? "",
    enrollDate: initialData?.enrollDate ? toDateInput(initialData.enrollDate) : new Date().toISOString().slice(0, 10),
    referredBy: initialData?.referredBy ?? "",
    status: initialData?.status ?? "ACTIVE",
    notes: initialData?.notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "phone") setPhoneError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.phone && !/^[0-9]{10,11}$/.test(form.phone)) {
      setPhoneError("Số điện thoại không hợp lệ (10-11 chữ số)");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch(isEdit ? `/api/students/${studentId}` : "/api/students", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, dob: form.dob || null }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSubmitting(false);
      setError(data.error ?? "Có lỗi xảy ra");
      return;
    }

    const result = await res.json();
    setSubmitting(false);
    onCreated?.();
    openDrawer(result.item.id);
    router.refresh();
  }

  function handleCancel() {
    if (onCancel) onCancel();
    else if (isEdit) router.push(`/students/${studentId}`);
    else router.push("/students");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="label-sm">Họ và tên *</span>
          <input
            required
            className="input"
            placeholder="Nguyễn Văn A"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
          />
        </label>
        {isEdit ? (
          <label className="space-y-1">
            <span className="label-sm">Mã học viên</span>
            <input className="input" value={initialData?.studentCode ?? ""} disabled />
          </label>
        ) : null}
        <label className="space-y-1">
          <span className="label-sm">Giới tính</span>
          <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="">— Chọn —</option>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="label-sm">Ngày sinh</span>
          <input type="date" className="input" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="label-sm">Số điện thoại</span>
          <input className="input" placeholder="0912345678" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          {phoneError ? <span className="block text-xs text-red-600">{phoneError}</span> : null}
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="label-sm">Địa chỉ</span>
          <input
            className="input"
            placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-[#f1f5f9] pt-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="label-sm">Ngày nhập học</span>
          <input type="date" className="input" value={form.enrollDate} onChange={(e) => set("enrollDate", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="label-sm">Trạng thái</span>
          <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="ACTIVE">Đang học</option>
            <option value="LEFT">Đã nghỉ</option>
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="label-sm">Người giới thiệu</span>
          <input
            className="input"
            placeholder="Tên người/tổ chức giới thiệu"
            value={form.referredBy}
            onChange={(e) => set("referredBy", e.target.value)}
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="label-sm">Ghi chú</span>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Tình trạng sức khỏe, sở thích, mục tiêu học tập..."
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className={ACTION_CLASS}>
          {submitting ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo học viên"}
        </button>
        <button type="button" onClick={handleCancel} disabled={submitting} className="btn-ghost-sm">
          Hủy
        </button>
      </div>
    </form>
  );
}
