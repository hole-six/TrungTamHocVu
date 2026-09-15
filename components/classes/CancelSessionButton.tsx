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
      `Buổi ${sessionDateLabel}: trung tâm cho nghỉ. Các buổi sau học tiếp đúng tài liệu còn dang dở` +
        (data.extended ? `, lớp được nối thêm ${data.extended} buổi ở cuối khóa.` : ".") +
        " Không học viên nào bị trừ buổi.",
      "Đã cho nghỉ buổi này",
    );
    onSuccess?.();
    router.refresh();
  }

  return (
    <ConfirmActionButton
      title="Hủy buổi này cho cả lớp?"
      description={
        `Buổi ${sessionDateLabel} KHÔNG DIỄN RA: không học viên nào bị trừ buổi, không tính lương buổi này. ` +
        "Tài liệu của buổi này dồn sang buổi học kế tiếp (các buổi sau tịnh tiến theo), lớp tự thêm 1 buổi ở cuối khóa. " +
        "Nếu buổi này vẫn học nhưng đổi sang ngày khác thì dùng Dời lịch — tài liệu sẽ đi theo ngày bù."
      }
      confirmLabel="Cho nghỉ buổi này"
      tone="danger"
      disabled={loading}
      className={className ?? "btn-danger-sm"}
      onConfirm={cancel}
    >
      {loading ? "Đang hủy..." : "Trung tâm cho nghỉ"}
    </ConfirmActionButton>
  );
}

// BỎ CHO NGHỈ — lỡ bấm cho nghỉ, hoặc trung tâm quyết định vẫn học: buổi học lại như cũ, tài
// liệu về đúng vị trí, buổi đã nối thêm ở cuối khóa được bỏ (xem trimExcessUpcomingSessions).
export function RestoreSessionButton({
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

  async function restore() {
    setLoading(true);
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PLANNED", notes: null }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      toast.blocked(data.error ?? "Không khôi phục được buổi học này.", "Không thực hiện được");
      return;
    }
    toast.success(
      `Buổi ${sessionDateLabel} học lại như cũ` + (data.removed ? `, bỏ ${data.removed} buổi đã nối thêm ở cuối khóa.` : "."),
      "Đã bỏ cho nghỉ",
    );
    onSuccess?.();
    router.refresh();
  }

  return (
    <ConfirmActionButton
      title="Bỏ cho nghỉ, học lại buổi này?"
      description={`Buổi ${sessionDateLabel} sẽ học lại bình thường; tài liệu các buổi sau về đúng vị trí cũ và buổi đã nối thêm ở cuối khóa (nếu chưa có dữ liệu) được bỏ.`}
      confirmLabel="Học lại buổi này"
      disabled={loading}
      className={className ?? "status-action"}
      onConfirm={restore}
    >
      {loading ? "Đang khôi phục..." : "Bỏ cho nghỉ"}
    </ConfirmActionButton>
  );
}
