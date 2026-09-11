"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { useToast } from "@/components/ui/Toast";

// HỦY BUỔI CHO CẢ LỚP — trung tâm cho nghỉ (mưa bão, sự cố, nghỉ đột xuất).
//
// Vì sao cần một nút riêng, tách hẳn khỏi "Dời lịch": dời lịch là buổi đó VẪN HỌC,
// chỉ đổi sang ngày khác. Còn đây là buổi KHÔNG DIỄN RA, và hệ quả về tiền hoàn toàn
// khác — không ai bị trừ buổi trong ví, buổi bổ trợ cấp vì vắng chính buổi này bị thu
// hồi, tiến độ học lùi lại. Đây chính là cột "Số buổi nghỉ trừ ngoại lệ" trong file
// quản lý của trung tâm.
//
// Toàn bộ phần xử lý tiền đã nằm sẵn ở PATCH /api/sessions/[id] từ trước — chỉ thiếu
// đúng chỗ bấm, nên trước đây muốn cho cả lớp nghỉ một buổi là không có cách nào làm
// trên giao diện.
export default function CancelSessionButton({
  sessionId,
  sessionDateLabel,
  onSuccess,
  className,
}: {
  sessionId: string;
  sessionDateLabel: string;
  onSuccess?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    setLoading(true);
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      // Kỳ thu học phí đã chốt sổ thì API chặn để phiếu đã chốt không bị lệch — đây là
      // mâu thuẫn nghiệp vụ thật, phải hiện toast ngăn cấm chứ không nuốt lỗi.
      toast.blocked(data.error ?? "Không hủy được buổi học này.", "Không hủy được buổi");
      return;
    }

    toast.success(
      `Đã đánh dấu buổi ${sessionDateLabel} là trung tâm cho nghỉ. Không học viên nào bị trừ buổi trong ví.`,
      "Đã hủy buổi cho cả lớp",
    );
    onSuccess?.();
    router.refresh();
  }

  return (
    <ConfirmActionButton
      title="Hủy buổi này cho cả lớp?"
      description={
        `Buổi ${sessionDateLabel} sẽ được đánh dấu là TRUNG TÂM CHO NGHỈ: không học viên nào bị trừ buổi trong ví, ` +
        "điểm danh của buổi này bị xóa, buổi bổ trợ đã cấp vì vắng buổi này bị thu hồi và tiến độ học lùi lại tương ứng. " +
        "Chỉ dùng khi buổi này THỰC SỰ KHÔNG DIỄN RA — nếu chỉ đổi sang ngày khác thì dùng Dời lịch."
      }
      confirmLabel="Hủy buổi cho cả lớp"
      tone="danger"
      disabled={loading}
      className={className ?? "btn-danger-sm"}
      onConfirm={cancel}
    >
      {loading ? "Đang hủy..." : "Trung tâm cho nghỉ"}
    </ConfirmActionButton>
  );
}
