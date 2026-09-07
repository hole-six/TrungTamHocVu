"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

const WITHDRAWABLE_STATUSES = new Set(["ACTIVE", "PAUSED"]);

function WalletWithdrawDialog({
  open,
  walletBalance,
  loading,
  onKeep,
  onRefund,
  onClose,
}: {
  open: boolean;
  walletBalance: number;
  loading: boolean;
  onKeep: () => void;
  onRefund: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loading, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Học viên còn dư Ví buổi học">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        onClick={() => { if (!loading) onClose(); }}
        aria-label="Đóng"
      />
      <div className="relative z-[91] w-full max-w-md rounded-[28px] border border-[#dbe7ff] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
        <h3 className="text-xl font-bold tracking-tight text-[#12304a]">Học viên còn dư Ví buổi học</h3>
        <p className="mt-2 text-sm leading-6 text-[#64748b]">
          Ví còn <strong className="text-[#0f1729]">{walletBalance} buổi</strong> chưa học khi rút lớp. Chọn cách xử lý số buổi
          này — việc chuyển tiền mặt thật (nếu có) diễn ra ngoài hệ thống, ở đây chỉ ghi nhận trạng thái.
        </p>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onRefund}
            disabled={loading}
            className="w-full rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-2.5 text-left text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Đã hoàn tiền
            <span className="block text-xs font-normal text-rose-600">Đóng ví về 0, ghi nhận đã hoàn {walletBalance} buổi cho phụ huynh.</span>
          </button>
          <button
            type="button"
            onClick={onKeep}
            disabled={loading}
            className="w-full rounded-xl border-2 border-[#dbe7ff] bg-[#f8faff] px-4 py-2.5 text-left text-sm font-bold text-[#0f1729] transition hover:bg-[#eef3ff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Giữ lại
            <span className="block text-xs font-normal text-[#64748b]">Treo nguyên ví, dùng nếu học viên quay lại học sau này.</span>
          </button>
        </div>
        <button type="button" onClick={onClose} disabled={loading} className="btn-ghost mt-4 w-full">
          {loading ? "Đang xử lý..." : "Đóng, chưa rút lớp"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default function EnrollmentRowActions({
  enrollmentId,
  status,
  billingModel,
  walletBalance,
  onSuccess,
}: {
  enrollmentId: string;
  status: string;
  /** PERIOD còn dư Ví lúc rút lớp — mở thêm lựa chọn hoàn tiền/giữ lại (mục 3.10). */
  billingModel?: string;
  walletBalance?: number | null;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [walletChoiceOpen, setWalletChoiceOpen] = useState(false);

  async function withdrawEnrollment(walletDecision?: "REFUND" | "KEEP") {
    setLoading(true);

    const res = await fetch(`/api/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "WITHDRAWN", ...(walletDecision ? { walletDecision } : {}) }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setWalletChoiceOpen(false);

    if (!res.ok) {
      alert(data.error ?? "Không thể rút lớp lúc này.");
      return;
    }

    if (data.sessionCreditsGranted) {
      alert(`Đã chuyển ${data.sessionCreditsGranted} buổi chưa học thành buổi bổ trợ.`);
    }

    router.refresh();
    onSuccess?.();
  }

  if (!WITHDRAWABLE_STATUSES.has(status)) return null;

  const hasWalletToDecide = billingModel === "PERIOD" && (walletBalance ?? 0) > 0;

  if (hasWalletToDecide) {
    return (
      <>
        <button
          type="button"
          disabled={loading}
          onClick={() => setWalletChoiceOpen(true)}
          className="inline-flex min-w-[104px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Đang xử lý..." : "Rút lớp"}
        </button>

        <WalletWithdrawDialog
          open={walletChoiceOpen}
          walletBalance={walletBalance ?? 0}
          loading={loading}
          onRefund={() => void withdrawEnrollment("REFUND")}
          onKeep={() => void withdrawEnrollment("KEEP")}
          onClose={() => {
            if (loading) return;
            setWalletChoiceOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <ConfirmActionButton
      title="Xác nhận rút lớp?"
      description="Các buổi chưa học đủ điều kiện sẽ được chuyển thành buổi bổ trợ cho học viên."
      confirmLabel="Rút lớp"
      tone="danger"
      disabled={loading}
      className="inline-flex min-w-[104px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      onConfirm={() => withdrawEnrollment()}
    >
      {loading ? "Đang xử lý..." : "Rút lớp"}
    </ConfirmActionButton>
  );
}
