"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

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

export default function ScholarshipAdjustmentForm({
  studentId,
  scholarships,
  adjustments,
  enrollments,
  onChanged,
  bare = false,
}: {
  studentId: string;
  scholarships: Item[];
  adjustments: Item[];
  enrollments: EnrollmentOption[];
  onChanged?: () => void;
  /** Truyền true khi nơi gọi (drawer) đã tự có khung viền riêng — bỏ khung/nền của
   *  chính component này để không bị khung lồng khung. */
  bare?: boolean;
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
    onChanged?.();
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
    onChanged?.();
  }

  function startEdit(item: MergedItem) {
    setEditing({ id: item.id, kind: item.kind });
    setPercentage(String(Math.round(item.percentage * 100)));
    setReason(item.reason ?? "");
    setEnrollmentId(item.enrollment?.id ?? "");
  }

  // Cùng vocabulary bảng với "Giáo trình" trong StudentFinanceDesk (header xám hoa,
  // dòng bo góc trái/phải, nền #fbfdff) — trước đây chiết khấu tự vẽ 1 kiểu khác hẳn
  // (icon tròn, khung form riêng), nhìn như 2 phần mềm khác nhau ghép lại.
  return (
    <div className={bare ? "" : "card"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-[#0f1729]">Chiết khấu</p>
          <p className="mt-0.5 text-xs text-[#64748b]">Giảm % học phí theo lớp hoặc cho tất cả các lớp đang học — không giảm tiền sách.</p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-2 text-base">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-muted48">
              <th className="px-3 pb-1">Áp dụng</th>
              <th className="px-3 pb-1">Lý do</th>
              <th className="px-3 pb-1">Hiệu lực</th>
              <th className="px-3 pb-1 text-right">Tỉ lệ</th>
              <th className="px-3 pb-1 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item) => (
              <tr key={item.id} className="bg-[#fbfdff]">
                <td className="rounded-l-2xl px-3 py-3 align-top text-ink-muted80">
                  {item.enrollment ? `Lớp ${item.enrollment.class?.className ?? "?"}` : "Tất cả các lớp"}
                </td>
                <td className="px-3 py-3 align-top text-ink-muted80">{item.reason || "—"}</td>
                <td className="px-3 py-3 align-top text-xs text-ink-muted48">
                  Từ {new Date(item.effectiveFrom).toLocaleDateString("vi-VN")}
                  {item.effectiveTo ? ` → ${new Date(item.effectiveTo).toLocaleDateString("vi-VN")}` : " (còn hiệu lực)"}
                </td>
                <td className="px-3 py-3 text-right align-top font-black text-amber-600">-{Math.round(item.percentage * 100)}%</td>
                <td className="rounded-r-2xl px-3 py-3 text-right align-top">
                  <div className="inline-flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-full border border-[#e2e8f0] bg-white px-3 py-1 text-xs font-semibold text-[#0f1729] hover:border-[#f97316] hover:text-[#f97316]"
                    >
                      Sửa
                    </button>
                    <ConfirmActionButton
                      title="Xác nhận xóa mục này?"
                      description="Hệ thống sẽ xóa mục này và tính lại học phí tương ứng."
                      confirmLabel="Xóa mục"
                      tone="danger"
                      className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      onConfirm={() => removeItem(item)}
                    >
                      Xóa
                    </ConfirmActionButton>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-muted48">
                  Chưa có chiết khấu nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Add/edit form */}
      <div className="mt-4 border-t border-[#f1f5f9] pt-4">
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
              className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-bold text-[#0f1729] hover:border-[#f97316] hover:text-[#f97316] disabled:cursor-not-allowed disabled:opacity-50"
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
