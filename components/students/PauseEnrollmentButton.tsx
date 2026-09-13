"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { useToast } from "@/components/ui/Toast";

// BẢO LƯU / ĐI HỌC LẠI — việc xảy ra thường xuyên ở trung tâm (nghỉ hè, về quê, ốm dài
// ngày) nhưng trước đây KHÔNG có nút nào trong giao diện tạo ra nó, dù trạng thái
// PAUSED đã có sẵn trong hệ thống từ lâu. Giáo vụ chỉ còn hai lựa chọn và cả hai đều sai:
//   - Để nguyên "đang học": vẫn bị sinh học phí, vẫn nằm trong danh sách điểm danh,
//     giáo viên gọi tên mỗi buổi.
//   - Rút lớp: mất chỗ trong lớp, quay lại phải ghi danh mới từ đầu.
//
// Bảo lưu giữ nguyên ghi danh và chỗ trong lớp, chỉ đánh dấu một KHOẢNG thời gian học
// viên không thuộc buổi nào. Học phí tự động không sinh (chỉ sinh cho ghi danh ACTIVE)
// và tên không xuất hiện trong điểm danh những buổi trong kỳ nghỉ — kể cả về sau khi đã
// đi học lại, xem lib/server/class-roster.ts.
export default function PauseEnrollmentButton({
  enrollmentId,
  status,
  studentName,
  onSuccess,
  className,
}: {
  enrollmentId: string;
  status: string;
  studentName?: string;
  onSuccess?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const isPaused = status === "PAUSED";
  if (status !== "ACTIVE" && !isPaused) return null;

  async function setStatus(next: "PAUSED" | "ACTIVE") {
    setLoading(true);
    const response = await fetch(`/api/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: next,
        reason: next === "PAUSED" ? "Bảo lưu theo yêu cầu phụ huynh" : "Đi học lại sau kỳ bảo lưu",
      }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      toast.blocked(data.error ?? "Không đổi được trạng thái ghi danh.", "Không thực hiện được");
      return;
    }

    toast.success(
      next === "PAUSED"
        ? `Đã bảo lưu${studentName ? ` cho ${studentName}` : ""}. Từ hôm nay không sinh học phí và không có tên trong danh sách điểm danh.`
        : `Đã cho đi học lại${studentName ? ` ${studentName}` : ""}. Học phí và điểm danh tính lại từ hôm nay.`,
      next === "PAUSED" ? "Đã bảo lưu" : "Đã đi học lại",
    );
    onSuccess?.();
    router.refresh();
  }

  const buttonClass =
    className ??
    "status-action";

  if (isPaused) {
    return (
      <ConfirmActionButton
        title="Cho đi học lại?"
        description="Ghi danh trở lại bình thường: từ hôm nay học viên có tên trong danh sách điểm danh và được sinh học phí. Các buổi đã diễn ra trong kỳ bảo lưu vẫn giữ nguyên là không học."
        confirmLabel="Đi học lại"
        disabled={loading}
        className={buttonClass}
        onConfirm={() => setStatus("ACTIVE")}
      >
        {loading ? "Đang xử lý..." : "Đi học lại"}
      </ConfirmActionButton>
    );
  }

  return (
    <ConfirmActionButton
      title="Bảo lưu (tạm nghỉ có thời hạn)?"
      description={
        "Học viên GIỮ NGUYÊN chỗ trong lớp, nhưng từ hôm nay: không sinh học phí, không có tên trong danh sách điểm danh, và ví buổi học không bị trừ. " +
        "Khi quay lại chỉ cần bấm “Đi học lại”. Nếu học viên nghỉ hẳn thì dùng “Rút lớp” chứ không dùng mục này."
      }
      confirmLabel="Bảo lưu"
      disabled={loading}
      className={buttonClass}
      onConfirm={() => setStatus("PAUSED")}
    >
      {loading ? "Đang xử lý..." : "Bảo lưu"}
    </ConfirmActionButton>
  );
}
