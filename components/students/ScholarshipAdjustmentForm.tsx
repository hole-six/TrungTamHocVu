"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import FormGuide from "@/components/ui/FormGuide";

// Trước đây đây là 2 khái niệm tách riêng (tab "Học bổng" / "Điều chỉnh HP") — với
// người dùng cả hai chỉ là MỘT thứ: chiết khấu, giảm % học phí. Sự khác nhau thật sự
// duy nhất ở tầng dữ liệu là PHẠM VI ÁP DỤNG (1 lớp cụ thể hay tất cả các lớp đang
// học) — không phải 2 loại chiết khấu khác nhau. Gộp thành 1 khái niệm "Chiết khấu"
// duy nhất, chỉ còn 1 lựa chọn "Áp dụng cho" quyết định gọi API Scholarship (khi chọn
// đúng 1 lớp — giữ đúng hành vi "mang chiết khấu theo khi chuyển lớp" đã có từ trước)
// hay API Adjustment (khi chọn "tất cả các lớp"). Không đổi dữ liệu cũ, không đổi
// hành vi chuyển lớp — chỉ gộp giao diện cho không còn 2 khái niệm nhìn như tách biệt.
type Item = {
  id: string;
  percentage: number;
  reason: string | null;
  effectiveFrom: string | Date;
  effectiveTo: string | Date | null;
  enrollment?: { id: string; class?: { className: string } | null } | null;
};

type MergedItem = Item & { kind: "scholarship" | "adjustment" };

type EnrollmentOption = { id: string; className: string; status: string };

const DISCOUNT_GUIDE_SECTIONS = [
  {
    title: "Dùng để làm gì",
    items: [
      "Chiết khấu dùng để giảm % học phí cho học viên — không giảm tiền sách.",
      "Áp dụng cho đúng 1 lớp: chiết khấu đi theo học viên khi chuyển sang lớp mới.",
      "Áp dụng cho tất cả các lớp: dùng cho ưu đãi chung (vd anh chị em, nhân viên).",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách làm đúng",
    items: [
      "Chọn đúng phạm vi áp dụng trước khi nhập %.",
      "Muốn đổi mục cũ thì bấm Sửa, không tạo chồng mục mới.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý",
    items: [
      "Hệ thống sẽ tính lại học phí sau khi thêm, sửa hoặc xóa.",
      "Chưa ghi danh thì chưa thể gắn chiết khấu theo lớp.",
      "Nên ghi rõ lý do để sau này đối soát.",
    ],
    tone: "warning" as const,
  },
];

export default function ScholarshipAdjustmentForm({
  studentId,
  scholarships,
  adjustments,
  enrollments,
}: {
  studentId: string;
  scholarships: Item[];
  adjustments: Item[];
  enrollments: EnrollmentOption[];
}) {
  const router = useRouter();
  const [percentage, setPercentage] = useState("");
  const [reason, setReason] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editing, setEditing] = useState<{ id: string; kind: "scholarship" | "adjustment" } | null>(null);

  const list: MergedItem[] = [
    ...scholarships.map((item) => ({ ...item, kind: "scholarship" as const })),
    ...adjustments.map((item) => ({ ...item, kind: "adjustment" as const })),
  ].sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());

  function apiPathFor(kind: "scholarship" | "adjustment", id?: string) {
    const base = kind === "scholarship" ? `/api/students/${studentId}/scholarships` : `/api/students/${studentId}/adjustments`;
    return id ? `${base}/${id}` : base;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Chọn đúng 1 lớp cụ thể -> Scholarship (mang theo khi chuyển lớp). Chọn "tất cả
    // các lớp" (để trống) -> Adjustment. Người dùng chỉ thấy 1 form, không thấy 2 khái
    // niệm — lựa chọn API chỉ là chi tiết bên trong.
    const kind: "scholarship" | "adjustment" = enrollmentId ? "scholarship" : "adjustment";
    if (kind === "scholarship" && enrollments.length === 0) {
      setError("Học viên chưa có ghi danh nào để gắn chiết khấu theo lớp.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    const endpoint = apiPathFor(kind, editing?.id);
    const res = await fetch(endpoint, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        percentage: Number(percentage) / 100,
        reason,
        enrollmentId: enrollmentId || null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể lưu.");
      return;
    }
    setPercentage("");
    setReason("");
    setEnrollmentId("");
    setEditing(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    router.refresh();
  }

  async function removeItem(item: MergedItem) {
    setLoading(true);
    setError(null);
    const res = await fetch(apiPathFor(item.kind, item.id), { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể xóa.");
      return;
    }
    if (editing?.id === item.id) {
      setEditing(null);
      setPercentage("");
      setReason("");
      setEnrollmentId("");
    }
    router.refresh();
  }

  function startEdit(item: MergedItem) {
    setEditing({ id: item.id, kind: item.kind });
    setPercentage(String(Math.round(item.percentage * 100)));
    setReason(item.reason ?? "");
    setEnrollmentId(item.enrollment?.id ?? "");
  }

  return (
    <div className="card">
      <FormGuide
        title="Hướng dẫn chiết khấu"
        summary="Cách thêm chiết khấu học phí và chọn đúng phạm vi áp dụng."
        sections={DISCOUNT_GUIDE_SECTIONS}
        position="inline"
        buttonLabel="Guide"
      />
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
          </svg>
        </div>
        <h2 className="font-display text-base font-bold tracking-tight text-ink">Chiết khấu</h2>
      </div>

      <div className="space-y-2 mb-4">
        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#e2e8f0] py-6 text-center">
            <p className="text-sm text-ink-muted48">Chưa có chiết khấu nào.</p>
          </div>
        ) : (
          list.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-[#e8edf5] bg-[#f8fafc] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{item.reason ?? "Không có ghi chú"}</p>
                <p className="text-xs font-medium text-primary mt-0.5">
                  {item.enrollment ? `Áp dụng: ${item.enrollment.class?.className ? `Lớp ${item.enrollment.class.className}` : "Gói học"}` : "Áp dụng: Tất cả các lớp"}
                </p>
                <p className="text-xs text-ink-muted48 mt-0.5">
                  Từ {new Date(item.effectiveFrom).toLocaleDateString("vi-VN")}
                  {item.effectiveTo ? ` → ${new Date(item.effectiveTo).toLocaleDateString("vi-VN")}` : " (còn hiệu lực)"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-amber-600">-{Math.round(item.percentage * 100)}%</span>
                <button type="button" onClick={() => startEdit(item)} className="btn-ghost-sm">
                  Sửa
                </button>
                <ConfirmActionButton
                  title="Xác nhận xóa mục này?"
                  description="Hệ thống sẽ xóa mục này và tính lại học phí tương ứng."
                  confirmLabel="Xóa mục"
                  tone="danger"
                  className="btn-ghost-sm text-red-600 hover:text-red-700"
                  onConfirm={() => removeItem(item)}
                >
                  Xóa
                </ConfirmActionButton>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/edit form */}
      <div className="rounded-xl border border-[#e8edf5] bg-[#fafbff] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted48 mb-3">
          {editing ? "Đang sửa chiết khấu" : "Thêm chiết khấu"}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="form-group">
            <label className="label">Áp dụng cho</label>
            <select className="input" value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)}>
              <option value="">Tất cả các lớp học viên đang học</option>
              {enrollments.map((en) => (
                <option key={en.id} value={en.id}>
                  Chỉ lớp: {en.className} {en.status !== "ACTIVE" ? `(${en.status})` : ""}
                </option>
              ))}
            </select>
            {enrollments.length === 0 ? (
              <p className="form-hint text-amber-700">Học viên chưa có ghi danh — chỉ chọn được "Tất cả các lớp".</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Tỉ lệ (%)</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  placeholder="VD: 20"
                  className="input pr-8"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-muted48">%</span>
              </div>
            </div>
            <div className="form-group">
              <label className="label">Lý do</label>
              <input
                className="input"
                placeholder="VD: Học sinh xuất sắc, ưu đãi anh chị em..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          {error && <div className="alert-danger text-xs">{error}</div>}
          {success && <div className="alert-success text-xs">Đã lưu thành công!</div>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-ghost-sm w-full border-dashed hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Đang lưu..." : editing ? "Lưu chỉnh sửa" : "Thêm chiết khấu"}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setPercentage("");
                  setReason("");
                  setEnrollmentId("");
                }}
                className="btn-ghost-sm"
              >
                Hủy sửa
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
