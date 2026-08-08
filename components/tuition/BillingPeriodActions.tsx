"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

const NEXT: Record<string, { to: string; label: string; confirm: string; danger?: boolean }[]> = {
  DRAFT: [],
  GENERATED: [
    {
      to: "REVIEWED",
      label: "Đánh dấu đã soát",
      confirm: "Xác nhận đã soát xong các khoản học phí trong kỳ này? Hãy chắc chắn số buổi, số tiền từng khoản đã đúng trước khi qua bước chốt sổ.",
    },
  ],
  REVIEWED: [
    { to: "POSTED", label: "Chốt sổ", confirm: "Chốt sổ sẽ khóa kỳ này khỏi việc sinh/sửa học phí. Tiếp tục?", danger: true },
  ],
  POSTED: [
    { to: "CLOSED", label: "Đóng kỳ", confirm: "Đóng kỳ thu này? Sau khi đóng, kỳ sẽ được xem là hoàn tất và chỉ mở lại được qua thao tác riêng.", danger: true },
  ],
  CLOSED: [
    { to: "REOPENED", label: "Mở lại kỳ", confirm: "Mở lại kỳ thu đã đóng? Các khoản học phí trong kỳ sẽ có thể sinh/sửa lại — chỉ dùng khi thực sự cần đính chính." },
  ],
  REOPENED: [],
};

type GenerationException = {
  studentId: string;
  classId: string;
  reason: string;
};

type GenerationResult = {
  created: number;
  updated: number;
  skippedCourseMode?: number;
  skippedCourseBilled?: number;
  skippedInstallmentNotDue?: number;
  exceptionCount?: number;
  exceptions?: GenerationException[];
  totalEnrollments: number;
};

export default function BillingPeriodActions({ periodId, status }: { periodId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [showExceptions, setShowExceptions] = useState(false);

  async function generate() {
    setLoading("GENERATE");
    setError(null);
    setResult(null);
    setGenerationResult(null);

    const res = await fetch(`/api/billing-periods/${periodId}/generate-charges`, { method: "POST" });
    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      setError(data.error ?? "Không thể sinh học phí.");
      return;
    }

    const payload = data as GenerationResult;
    setGenerationResult(payload);
    setShowExceptions((payload.exceptionCount ?? 0) > 0);
    setResult(
      `Đã sinh ${payload.created} khoản mới, cập nhật ${payload.updated} khoản, bỏ qua ${payload.skippedCourseMode ?? 0} ca thu trọn khóa, ${payload.skippedInstallmentNotDue ?? 0} ca installment chưa đến hạn (${payload.totalEnrollments} ghi danh đang học).`,
    );
    router.refresh();
  }

  async function setStatus(to: string) {
    setLoading(to);
    setError(null);
    const res = await fetch(`/api/billing-periods/${periodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể đổi trạng thái kỳ thu.");
      return;
    }
    router.refresh();
  }

  const options = NEXT[status] ?? [];
  const canGenerate = status === "DRAFT" || status === "GENERATED" || status === "REOPENED";

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Thao tác kỳ thu</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {canGenerate && (
          <button onClick={generate} disabled={loading === "GENERATE"} className="btn-primary">
            {loading === "GENERATE" ? "Đang sinh..." : "Sinh học phí từ dữ liệu lớp học"}
          </button>
        )}
        {options.map((option) => (
          <ConfirmActionButton
            key={option.to}
            title="Xác nhận chuyển trạng thái kỳ thu?"
            description={option.confirm}
            confirmLabel={option.label}
            tone={option.danger ? "danger" : "default"}
            disabled={loading === option.to}
            className="btn-ghost"
            onConfirm={() => setStatus(option.to)}
          >
            {loading === option.to ? "..." : option.label}
          </ConfirmActionButton>
        ))}
      </div>

      {result ? <p className="mt-3 text-sm text-primary">{result}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {generationResult ? (
        <div className="mt-4 space-y-3 rounded-3xl border border-[#dfe8f2] bg-[#f8fbff] p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-hairline bg-white px-4 py-3">
              <p className="text-xs text-ink-muted48">Tạo mới</p>
              <p className="mt-1 text-lg font-semibold text-ink">{generationResult.created}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white px-4 py-3">
              <p className="text-xs text-ink-muted48">Cập nhật</p>
              <p className="mt-1 text-lg font-semibold text-ink">{generationResult.updated}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white px-4 py-3">
              <p className="text-xs text-ink-muted48">Ngoại lệ</p>
              <p className="mt-1 text-lg font-semibold text-red-600">{generationResult.exceptionCount ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white px-4 py-3">
              <p className="text-xs text-ink-muted48">Bỏ qua trọn khóa</p>
              <p className="mt-1 text-lg font-semibold text-ink">{generationResult.skippedCourseMode ?? 0}</p>
            </div>
          </div>

          {(generationResult.exceptionCount ?? 0) > 0 ? (
            <div className="rounded-2xl border border-[#f6d67b] bg-[#fff8e8] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#8a5a00]">Có ca cần kiểm tra thủ công</p>
                  <p className="mt-1 text-xs text-[#c76700]">
                    Hệ thống đã chặn các trường hợp có rủi ro thay vì sinh sai học phí.
                  </p>
                </div>
                <button type="button" onClick={() => setShowExceptions((current) => !current)} className="btn-ghost">
                  {showExceptions ? "Ẩn ngoại lệ" : "Xem ngoại lệ"}
                </button>
              </div>

              {showExceptions ? (
                <div className="mt-4 space-y-2">
                  {(generationResult.exceptions ?? []).map((item, index) => (
                    <div key={`${item.studentId}-${item.classId}-${index}`} className="rounded-2xl border border-[#f6d67b] bg-white px-4 py-3">
                      <p className="text-sm font-medium text-ink">
                        Học viên:{" "}
                        <Link href={`/students/${item.studentId}?tab=hocphi`} className="text-primary hover:underline">
                          {item.studentId}
                        </Link>
                      </p>
                      <p className="mt-1 text-xs text-ink-muted48">Lớp: {item.classId}</p>
                      <p className="mt-2 text-sm text-[#8a5a00]">{item.reason}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-[#e8f8f1] px-4 py-3 text-sm text-[#0f7a4f]">
              Không có ngoại lệ nguy hiểm trong lần sinh học phí này.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
