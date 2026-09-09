"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";

const NEXT: Record<string, { to: string; label: string; confirm: string } | null> = {
  DRAFT: null,
  CALCULATED: {
    to: "REVIEWED",
    label: "Xác nhận đã kiểm tra",
    confirm: "Xác nhận đã kiểm tra xong số liệu tháng này? Hãy chắc chắn giờ dạy, công và các khoản điều chỉnh đã đúng.",
  },
  REVIEWED: {
    to: "APPROVED",
    label: "Duyệt số liệu",
    confirm: "Duyệt lương tháng này? Sau khi duyệt, không nên tính lại từ dữ liệu gốc nữa.",
  },
  APPROVED: {
    to: "LOCKED",
    label: "Khóa tháng lương",
    confirm: "Khóa lương tháng này? Sau khi khóa, các dòng lương sẽ không còn sửa được.",
  },
  LOCKED: {
    to: "PAID",
    label: "Đánh dấu đã trả lương",
    confirm: "Đánh dấu tháng lương này ĐÃ TRẢ? Chỉ xác nhận khi tiền lương đã thực sự được chi trả.",
  },
  PAID: {
    to: "REOPENED",
    label: "Mở lại tháng lương",
    confirm: "Mở lại tháng lương đã trả? Chỉ dùng khi thực sự cần đính chính.",
  },
  // Không có nút "bước tiếp theo" riêng ở REOPENED — giống hệt DRAFT, việc bấm "Tính
  // lại lương" sẽ tự đưa trạng thái sang CALCULATED, từ đó đi tiếp REVIEWED→APPROVED→
  // LOCKED→PAID theo đúng quy trình bình thường.
  REOPENED: null,
};

// Thứ tự các bước để hiển thị người dùng đang ở đâu — thay cho 2 khối chữ mô tả dài
// (STATUS_HELP + "việc nên làm lúc này" + "bước tiếp theo") vốn nói đi nói lại cùng
// một điều ở 3 chỗ khác nhau.
const STEPS: { status: string; label: string }[] = [
  { status: "DRAFT", label: "Tính lương" },
  { status: "CALCULATED", label: "Kiểm tra" },
  { status: "REVIEWED", label: "Duyệt" },
  { status: "APPROVED", label: "Khóa" },
  { status: "LOCKED", label: "Trả lương" },
  { status: "PAID", label: "Xong" },
];

export default function PayrollRunActions({
  runId,
  status,
  checklistReady = true,
}: {
  runId: string;
  status: string;
  checklistReady?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // Cảnh báo cấu hình thiếu do server trả về (vd có ngày công nhưng chưa có đơn giá
  // ngày công nên lương ra 0đ) — phải hiện thẳng ở đây, nếu không nhân sự chỉ thấy
  // bảng lương 0đ mà không biết vì sao.
  const [warnings, setWarnings] = useState<string[]>([]);

  async function generate() {
    setLoading("GENERATE");
    setError(null);
    setResult(null);
    setWarnings([]);

    const res = await fetch(`/api/payroll-runs/${runId}/generate`, { method: "POST" });
    const data = await res.json();

    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Không thể tính lương.");
      return;
    }

    setResult(`Đã tạo ${data.created} dòng mới, cập nhật ${data.updated} dòng trên ${data.totalEmployees} nhân sự.`);
    setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    router.refresh();
  }

  async function setStatus(to: string) {
    setLoading(to);
    setError(null);

    const res = await fetch(`/api/payroll-runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });

    setLoading(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể đổi trạng thái.");
      return;
    }

    router.refresh();
  }

  async function remove() {
    setLoading("DELETE");
    setError(null);

    const res = await fetch(`/api/payroll-runs/${runId}`, { method: "DELETE" });

    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể xóa tháng lương.");
      return;
    }

    router.push("/payroll");
  }

  const nextAction = NEXT[status] ?? null;
  const canGenerate = status === "DRAFT" || status === "CALCULATED" || status === "REVIEWED" || status === "REOPENED";
  const canDelete = canGenerate;
  const currentStepIndex = STEPS.findIndex((step) => step.status === status);
  const blockedByChecklist = Boolean(nextAction && (nextAction.to === "APPROVED" || nextAction.to === "LOCKED") && !checklistReady);

  return (
    <div className="space-y-4">
      {/* Đang ở bước nào — 1 dòng thay cho 3 khối chữ mô tả trạng thái trước đây */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {STEPS.map((step, index) => (
          <span
            key={step.status}
            className={`rounded-md px-2 py-1 font-bold ${
              index === currentStepIndex
                ? "bg-[#0f1729] text-white"
                : index < currentStepIndex
                  ? "border border-[#e2e8f0] bg-white text-[#94a3b8]"
                  : "border border-[#e2e8f0] bg-white text-[#475569]"
            }`}
          >
            {index + 1}. {step.label}
          </span>
        ))}
        {status === "REOPENED" ? <span className="rounded-md bg-[#b45309] px-2 py-1 font-bold text-white">Đã mở lại</span> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {canGenerate ? (
          <button onClick={generate} disabled={loading === "GENERATE"} className={ACTION_CLASS}>
            {loading === "GENERATE" ? "Đang tính lại..." : "Tính lại lương từ dữ liệu gốc"}
          </button>
        ) : null}

        {nextAction ? (
          <ConfirmActionButton
            title="Xác nhận chuyển bước?"
            description={nextAction.confirm}
            confirmLabel={nextAction.label}
            tone={nextAction.to === "PAID" ? "danger" : "default"}
            disabled={loading === nextAction.to || blockedByChecklist}
            className={ACTION_CLASS}
            onConfirm={() => setStatus(nextAction.to)}
          >
            {loading === nextAction.to ? "Đang chuyển bước..." : nextAction.label}
          </ConfirmActionButton>
        ) : null}
      </div>

      {blockedByChecklist ? (
        <p className="text-sm font-semibold text-rose-700">Checklist chưa đạt, hệ thống đang chặn bước này để tránh chốt sai.</p>
      ) : null}

      {result ? <p className="text-sm text-emerald-700">{result}</p> : null}
      {warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-bold text-amber-900">
            {warnings.length} nhân sự có công nhưng chưa ra tiền — cần bổ sung đơn giá trong hồ sơ nhân sự:
          </p>
          <ul className="mt-1.5 space-y-1">
            {warnings.map((item, index) => (
              <li key={index} className="text-sm text-amber-900">• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {canDelete ? (
        <div className="border-t border-[#f1f5f9] pt-3">
          <ConfirmActionButton
            title="Xác nhận xóa tháng lương?"
            description="Toàn bộ dòng lương của tháng này sẽ bị xóa và không thể hoàn tác."
            confirmLabel="Xóa tháng lương"
            tone="danger"
            disabled={loading === "DELETE"}
            className="btn-danger-sm"
            onConfirm={remove}
          >
            {loading === "DELETE" ? "Đang xóa..." : "Xóa tháng lương"}
          </ConfirmActionButton>
        </div>
      ) : null}
    </div>
  );
}
