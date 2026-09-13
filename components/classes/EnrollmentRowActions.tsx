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
        <h3 className="text-xl font-bold tracking-tight text-[#12304a]">Học viên còn dư {walletBalance} buổi</h3>
        {/* CHÍNH SÁCH TRUNG TÂM: bỏ dở thì KHÔNG hoàn tiền. Trước đây hộp này hỏi nhân
            viên chọn "Đã hoàn tiền" hay "Giữ lại" — cả hai đều trái chính sách, và tệ
            hơn là đặt một quyết định về tiền lên vai người đang bận nghe điện thoại.
            Nay chỉ còn nói rõ hậu quả để họ báo lại phụ huynh ngay lúc đó. */}
        <p className="mt-2 text-sm leading-6 text-[#64748b]">
          Rút lớp giữa chừng thì số buổi này <strong className="text-[#0f1729]">mất, không hoàn tiền</strong> theo chính sách
          trung tâm. Hệ thống vẫn ghi lại đầy đủ mất bao nhiêu buổi và vì lý do gì để tra cứu về sau.
        </p>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Nên báo phụ huynh trước khi bấm.</p>
          <p className="mt-1 text-xs text-amber-800">
            Nếu phụ huynh muốn giữ lại số buổi này, đừng rút lớp — dùng <strong>Bảo lưu</strong> để tạm nghỉ, hoặc
            <strong> Chuyển lớp</strong> để mang nguyên giá trị sang lớp khác.
          </p>
        </div>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onRefund}
            disabled={loading}
            className="w-full rounded-lg border border-[#e2e8f0] bg-white px-4 py-2.5 text-center text-sm font-bold text-[#0f1729] transition hover:border-[#0f1729] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang xử lý..." : `Vẫn rút lớp, chấp nhận mất ${walletBalance} buổi`}
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
  className,
}: {
  enrollmentId: string;
  status: string;
  /** PERIOD còn dư Ví lúc rút lớp — hiện cảnh báo số buổi sẽ mất trước khi xác nhận. */
  billingModel?: string;
  walletBalance?: number | null;
  onSuccess?: () => void;
  /** Ghi đè kiểu nút để đứng cạnh các nút khác cùng cỡ (VD: hàng nút trong drawer). */
  className?: string;
}) {
  const router = useRouter();
  const buttonClass =
    className ??
    "status-action";
  const [loading, setLoading] = useState(false);
  const [walletChoiceOpen, setWalletChoiceOpen] = useState(false);

  async function withdrawEnrollment() {
    setLoading(true);

    const res = await fetch(`/api/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "WITHDRAWN" }),
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
          className={buttonClass}
        >
          {loading ? "Đang xử lý..." : "Rút lớp"}
        </button>

        <WalletWithdrawDialog
          open={walletChoiceOpen}
          walletBalance={walletBalance ?? 0}
          loading={loading}
          onRefund={() => void withdrawEnrollment()}
          onKeep={() => void withdrawEnrollment()}
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
      description={
        "Rút lớp giữa chừng thì phần học phí đã đóng cho các buổi chưa học sẽ MẤT, không hoàn tiền và không quy đổi thành buổi bổ trợ — đúng chính sách trung tâm. " +
        "Nếu phụ huynh chỉ muốn tạm nghỉ thì dùng Bảo lưu; nếu muốn giữ giá trị đã đóng thì dùng Chuyển lớp."
      }
      confirmLabel="Rút lớp"
      tone="danger"
      disabled={loading}
      className={buttonClass}
      onConfirm={() => withdrawEnrollment()}
    >
      {loading ? "Đang xử lý..." : "Rút lớp"}
    </ConfirmActionButton>
  );
}
