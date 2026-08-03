"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

const NEXT: Record<
  string,
  { to: string; label: string; description: string; confirm?: string } | null
> = {
  DRAFT: null,
  CALCULATED: {
    to: "REVIEWED",
    label: "Bước 2: Xác nhận đã kiểm tra",
    description:
      "Dùng khi bạn đã rà soát xong số giờ, công, lương cứng và điều chỉnh.",
  },
  REVIEWED: {
    to: "APPROVED",
    label: "Bước 3: Duyệt số liệu",
    description:
      "Sau bước này, kỳ lương sẽ được xem là đã chốt số liệu để chuẩn bị khóa.",
    confirm:
      "Duyệt kỳ lương này? Sau khi duyệt, bạn không nên tính lại từ dữ liệu gốc nữa.",
  },
  APPROVED: {
    to: "LOCKED",
    label: "Bước 4: Khóa kỳ lương",
    description: "Khóa kỳ để ngừng chỉnh sửa trước khi trả lương thực tế.",
  },
  LOCKED: {
    to: "PAID",
    label: "Bước 5: Đánh dấu đã trả lương",
    description: "Chỉ dùng khi tiền lương đã được chi trả thực tế.",
  },
  PAID: null,
};

const STATUS_HELP: Record<string, { title: string; description: string }> = {
  DRAFT: {
    title: "Kỳ lương mới tạo",
    description:
      "Việc đầu tiên cần làm là tính lương để kéo dữ liệu buổi dạy, trợ giảng và chấm công vào kỳ này.",
  },
  CALCULATED: {
    title: "Đã lấy xong dữ liệu nguồn",
    description:
      "Giờ hãy kiểm tra số giờ, số công, lương cứng, thưởng và phạt trước khi xác nhận.",
  },
  REVIEWED: {
    title: "Đã kiểm tra xong",
    description:
      "Nếu số liệu đã đúng, bạn có thể duyệt để chốt phần nghiệp vụ.",
  },
  APPROVED: {
    title: "Đã duyệt",
    description:
      "Kỳ lương đang chờ khóa. Chỉ khóa khi bạn chắc chắn không cần sửa gì thêm.",
  },
  LOCKED: {
    title: "Đã khóa",
    description:
      "Kỳ lương không còn chỉnh sửa được. Sau khi chi lương xong thì đánh dấu đã trả.",
  },
  PAID: {
    title: "Đã hoàn tất",
    description: "Kỳ lương này đã được đánh dấu trả xong.",
  },
};

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

  async function generate() {
    setLoading("GENERATE");
    setError(null);
    setResult(null);

    const res = await fetch(`/api/payroll-runs/${runId}/generate`, {
      method: "POST",
    });
    const data = await res.json();

    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Không thể tính lương.");
      return;
    }

    setResult(
      `Đã tạo ${data.created} dòng mới, cập nhật ${data.updated} dòng trên ${data.totalEmployees} nhân sự.`,
    );
    router.refresh();
  }

  async function setStatus(to: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;

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
      setError(data.error ?? "Không thể xóa kỳ lương.");
      return;
    }

    router.push("/payroll");
  }

  const nextAction = NEXT[status] ?? null;
  const statusHelp = STATUS_HELP[status] ?? {
    title: "Trạng thái hiện tại",
    description: "Kiểm tra kỹ dữ liệu trước khi chuyển sang bước tiếp theo.",
  };
  const canGenerate =
    status === "DRAFT" || status === "CALCULATED" || status === "REVIEWED";
  const canDelete = canGenerate;

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-[#fed7aa] bg-white shadow-sm">
      <div className="border-b border-[#ffedd5] bg-gradient-to-r from-[#fff7ed] to-white px-6 py-5">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f97316]">
          Thao tác chính
        </p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-[#111827]">
          {statusHelp.title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b7280]">
          {statusHelp.description}
        </p>
      </div>

      <div className="space-y-4 px-6 py-5">
        <div className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
          <p className="text-sm font-bold text-[#111827]">Việc nên làm lúc này</p>
          <p className="mt-1 text-sm leading-6 text-[#6b7280]">
            {status === "DRAFT"
              ? "Bấm tính lương để tạo toàn bộ dữ liệu kỳ lương từ dữ liệu gốc."
              : nextAction
                ? nextAction.description
                : "Kỳ lương đã hoàn tất. Bạn chỉ cần tra cứu hoặc xuất file nếu cần."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canGenerate ? (
            <button
              onClick={generate}
              disabled={loading === "GENERATE"}
              className="inline-flex items-center justify-center rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading === "GENERATE"
                ? "Đang tính lại..."
                : "Bước 1: Tính lại lương từ dữ liệu gốc"}
            </button>
          ) : null}

          {nextAction ? (
            <button
              onClick={() => setStatus(nextAction.to, nextAction.confirm)}
              disabled={
                loading === nextAction.to ||
                ((nextAction.to === "APPROVED" || nextAction.to === "LOCKED") &&
                  !checklistReady)
              }
              className="inline-flex items-center justify-center rounded-2xl border-2 border-[#fdba74] bg-white px-5 py-3 text-sm font-bold text-[#c2410c] transition hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading === nextAction.to
                ? "Đang chuyển bước..."
                : nextAction.label}
            </button>
          ) : null}
        </div>

        {nextAction ? (
          <div className="rounded-2xl border border-[#fed7aa] bg-[#fffaf5] px-4 py-3 text-sm text-[#7c2d12]">
            <p className="font-bold">Bước tiếp theo</p>
            <p className="mt-1 leading-6">{nextAction.description}</p>
            {(nextAction.to === "APPROVED" || nextAction.to === "LOCKED") &&
            !checklistReady ? (
              <p className="mt-2 font-semibold text-red-600">
                Checklist chưa đạt 100%, hệ thống đang chặn bước này để tránh chốt sai.
              </p>
            ) : null}
          </div>
        ) : null}

        {canDelete ? (
          <details className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
            <summary className="cursor-pointer text-sm font-bold text-[#6b7280]">
              Tác vụ phụ và thao tác nguy hiểm
            </summary>
            <div className="mt-3 rounded-2xl border border-[#f1f5f9] bg-white px-4 py-3">
              <p className="text-sm font-bold text-[#111827]">Xóa kỳ lương</p>
              <p className="mt-1 text-xs leading-5 text-[#6b7280]">
                Chỉ dùng khi bạn muốn làm lại kỳ lương từ đầu. Toàn bộ dòng lương
                hiện tại sẽ bị xóa.
              </p>
              <div className="mt-3">
                <ConfirmActionButton
                  title="Xác nhận xóa kỳ lương?"
                  description="Toàn bộ dòng lương trong kỳ này sẽ bị xóa và không thể hoàn tác."
                  confirmLabel="Xóa kỳ lương"
                  tone="danger"
                  disabled={loading === "DELETE"}
                  className="btn-danger-sm"
                  onConfirm={remove}
                >
                  {loading === "DELETE" ? "Đang xóa..." : "Xóa kỳ lương"}
                </ConfirmActionButton>
              </div>
            </div>
          </details>
        ) : null}

        {result ? <p className="text-sm text-primary">{result}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
