"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Item = {
  id: string;
  percentage: number;
  reason: string | null;
  effectiveFrom: string | Date;
  effectiveTo: string | Date | null;
  enrollment?: { id: string; class: { className: string } } | null;
};

type EnrollmentOption = { id: string; className: string; status: string };

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
  const [tab, setTab] = useState<"scholarship" | "adjustment">("scholarship");
  const [percentage, setPercentage] = useState("");
  const [reason, setReason] = useState("");
  const [enrollmentId, setEnrollmentId] = useState(enrollments[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "scholarship" && !enrollmentId) {
      setError("Học viên chưa có ghi danh nào để gắn học bổng.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    const endpoint =
      tab === "scholarship"
        ? editingId
          ? `/api/students/${studentId}/scholarships/${editingId}`
          : `/api/students/${studentId}/scholarships`
        : editingId
          ? `/api/students/${studentId}/adjustments/${editingId}`
          : `/api/students/${studentId}/adjustments`;
    const res = await fetch(endpoint, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        percentage: Number(percentage) / 100,
        reason,
        ...(tab === "scholarship" ? { enrollmentId } : {}),
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
    setEditingId(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    router.refresh();
  }

  async function removeItem(id: string) {
    setLoading(true);
    setError(null);
    const endpoint = tab === "scholarship" ? `/api/students/${studentId}/scholarships/${id}` : `/api/students/${studentId}/adjustments/${id}`;
    const res = await fetch(endpoint, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể xóa.");
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setPercentage("");
      setReason("");
    }
    router.refresh();
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setPercentage(String(Math.round(item.percentage * 100)));
    setReason(item.reason ?? "");
    if (isScholarship && item.enrollment?.id) setEnrollmentId(item.enrollment.id);
  }

  const list = tab === "scholarship" ? scholarships : adjustments;
  const isScholarship = tab === "scholarship";

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
          </svg>
        </div>
        <h2 className="font-display text-base font-bold tracking-tight text-ink">Học bổng & Điều chỉnh</h2>
      </div>

      {/* Tab */}
      <div className="tab-bar mb-4">
        <button
          type="button"
          onClick={() => setTab("scholarship")}
          className={tab === "scholarship" ? "tab-item-active" : "tab-item"}
        >
          🏆 Học bổng
        </button>
        <button
          type="button"
          onClick={() => setTab("adjustment")}
          className={tab === "adjustment" ? "tab-item-active" : "tab-item"}
        >
          ✏️ Điều chỉnh HP
        </button>
      </div>

      {/* List */}
      <div className="space-y-2 mb-4">
        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#e2e8f0] py-6 text-center">
            <p className="text-sm text-ink-muted48">
              {isScholarship ? "Chưa có học bổng nào." : "Chưa có điều chỉnh nào."}
            </p>
          </div>
        ) : (
          list.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-[#e8edf5] bg-[#f8fafc] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{item.reason ?? "Không có lý do"}</p>
                {isScholarship && item.enrollment ? (
                  <p className="text-xs font-medium text-primary mt-0.5">{item.enrollment.class.className}</p>
                ) : null}
                <p className="text-xs text-ink-muted48 mt-0.5">
                  Từ {new Date(item.effectiveFrom).toLocaleDateString("vi-VN")}
                  {item.effectiveTo ? ` → ${new Date(item.effectiveTo).toLocaleDateString("vi-VN")}` : " (còn hiệu lực)"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-base font-bold ${isScholarship ? "text-emerald-600" : "text-amber-600"}`}>
                  -{Math.round(item.percentage * 100)}%
                </span>
                <button type="button" onClick={() => startEdit(item)} className="btn-ghost-sm">
                  Sửa
                </button>
                <ConfirmActionButton
                  title="Xác nhận xóa mục này?"
                  description="Hệ thống sẽ xóa mục này và tính lại học phí tương ứng."
                  confirmLabel="Xóa mục"
                  tone="danger"
                  className="btn-ghost-sm text-red-600 hover:text-red-700"
                  onConfirm={() => removeItem(item.id)}
                >
                  Xóa
                </ConfirmActionButton>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-[#e8edf5] bg-[#fafbff] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted48 mb-3">
          {editingId ? `Đang sửa ${isScholarship ? "học bổng" : "điều chỉnh"}` : `+ ${isScholarship ? "Thêm học bổng mới" : "Thêm điều chỉnh mới"}`}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {isScholarship && (
            <div className="form-group">
              <label className="label">Áp dụng cho lớp/khóa</label>
              {enrollments.length === 0 ? (
                <p className="text-xs text-red-600">Học viên chưa có ghi danh nào — cần ghi danh vào lớp trước khi thêm học bổng.</p>
              ) : (
                <select className="input" value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} required>
                  {enrollments.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.className} {en.status !== "ACTIVE" ? `(${en.status})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
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
                placeholder={isScholarship ? "VD: Học sinh xuất sắc" : "VD: Ưu đãi anh chị em"}
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
              disabled={loading || (isScholarship && enrollments.length === 0)}
              className="btn-ghost-sm w-full border-dashed hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Đang lưu..." : editingId ? "Lưu chỉnh sửa" : `+ Thêm ${isScholarship ? "học bổng" : "điều chỉnh"}`}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setPercentage("");
                  setReason("");
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
