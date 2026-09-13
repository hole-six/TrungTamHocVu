"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { useToast } from "@/components/ui/Toast";
import { formatVnd } from "@/lib/export-utils";

// HỌC VIÊN DÙNG HẾT SỐ BUỔI ĐÃ MUA — hai lối đi còn thiếu.
//
// Trước đây khi hết buổi, giáo vụ chỉ có "Chuyển lớp" hoặc "Rút lớp". Cả hai đều không
// đúng với hai tình huống rất hay gặp:
//
//   1. Phụ huynh muốn HỌC TIẾP ở chính lớp này, mua thêm buổi (50 → 55). Nút "Cộng buổi
//      linh động" sẵn có thì cố ý KHÔNG thu tiền (dành cho đền bù/ưu đãi), dùng nhầm là
//      trung tâm dạy thêm mà không thu đồng nào.
//   2. Học viên HỌC XONG TRỌN VẸN. Bấm "Rút lớp" là sai về nghĩa — rút là bỏ giữa chừng,
//      và hệ thống sẽ đi tính số buổi chưa học để cấp bù. Học xong thì phải là
//      "Đã kết thúc": giữ nguyên toàn bộ lịch sử học tập trong lớp, chỉ làm mờ dòng của
//      họ trong danh sách để không ai gọi nhắc học phí nữa.
export default function FinishEnrollmentActions({
  enrollmentId,
  status,
  billingModel,
  studentName,
  unitPrice,
  purchasedSessions,
  usedSessions,
  onSuccess,
}: {
  enrollmentId: string;
  status: string;
  billingModel: string;
  studentName: string;
  unitPrice: number;
  purchasedSessions: number;
  usedSessions: number;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState("5");
  const [price, setPrice] = useState(String(unitPrice || ""));
  const [loading, setLoading] = useState(false);

  // Chỉ có nghĩa với gói theo khóa đang chạy. Gói theo tháng không có "số buổi đã mua" —
  // phụ huynh đóng tiền là ví tự đầy, không cần mua thêm gì.
  const isCourse = billingModel !== "PERIOD";
  if (status !== "ACTIVE" && status !== "PAUSED") return null;

  const added = Number(sessions) || 0;
  const effectivePrice = Number(price) || 0;
  const addedAmount = added * effectivePrice;
  const remaining = Math.max(0, purchasedSessions - usedSessions);

  async function buyMore() {
    setLoading(true);
    const response = await fetch(`/api/enrollments/${enrollmentId}/purchase-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ additionalSessions: added, unitPrice: effectivePrice }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      toast.blocked(data.error ?? "Không mua thêm buổi được.", "Không thực hiện được");
      return;
    }
    toast.success(data.message ?? "Đã mua thêm buổi.", "Đã cập nhật số buổi");
    setOpen(false);
    onSuccess?.();
    router.refresh();
  }

  async function finish() {
    setLoading(true);
    const response = await fetch(`/api/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", reason: "Đã học xong số buổi đã đăng ký" }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      toast.blocked(data.error ?? "Không kết thúc được ghi danh.", "Không thực hiện được");
      return;
    }
    toast.success(
      `Đã đánh dấu ${studentName} học xong lớp này. Lịch sử học tập giữ nguyên, dòng của em được làm mờ trong danh sách lớp.`,
      "Đã kết thúc",
    );
    onSuccess?.();
    router.refresh();
  }

  return (
    <>
      {isCourse ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="status-action"
        >
          Mua thêm buổi
        </button>
      ) : null}

      <ConfirmActionButton
        title="Đánh dấu đã học xong lớp này?"
        description={
          `${studentName} đã học ${usedSessions}/${purchasedSessions} buổi. ` +
          "Toàn bộ lịch sử điểm danh và học phí trong lớp được giữ nguyên, dòng của em chỉ được làm mờ và ghi “Hoàn thành” trong danh sách lớp, không còn xuất hiện ở điểm danh các buổi sau. " +
          "Dùng mục này khi học xong trọn vẹn — nếu bỏ dở giữa chừng thì dùng “Rút lớp” để hệ thống tính phần buổi chưa học."
        }
        confirmLabel="Đã học xong"
        disabled={loading}
        className="status-action"
        onConfirm={finish}
      >
        {loading ? "Đang xử lý..." : "Đã học xong"}
      </ConfirmActionButton>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Mua thêm buổi cho học viên này"
        description={`${studentName} đã đăng ký ${purchasedSessions} buổi, đã học ${usedSessions}, còn ${remaining}. Mua thêm sẽ cộng vào phiếu học phí của khóa và thành khoản phải thu.`}
      >
        <div className="space-y-4">
          <label className="form-group">
            <span className="label">Số buổi mua thêm</span>
            <input
              type="number"
              min={1}
              max={200}
              className="input"
              value={sessions}
              onChange={(event) => setSessions(event.target.value)}
            />
            <span className="hint">
              Sau khi mua: {purchasedSessions} + {added} = <strong>{purchasedSessions + added} buổi</strong>
            </span>
          </label>

          <label className="form-group">
            <span className="label">Đơn giá / buổi</span>
            <CurrencyInput min={1} value={price} onChange={(next) => setPrice(String(next))} />
            <span className="hint">Để nguyên đơn giá đang áp dụng, chỉ sửa khi phụ huynh chốt giá khác.</span>
          </label>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-sm font-bold text-sky-900">Phải thu thêm: {formatVnd(addedAmount)}</p>
            <p className="mt-1 text-xs text-sky-800">
              Khoản này cộng thẳng vào phiếu học phí của khóa. Nếu học viên đang có tiền đóng trước thì hệ thống
              tự trừ vào đó ngay.
            </p>
          </div>

          <div className="flex gap-3 border-t border-hairline pt-4">
            <button type="button" disabled={loading || added <= 0 || effectivePrice <= 0} onClick={buyMore} className="btn-primary">
              {loading ? "Đang lưu..." : "Xác nhận mua thêm"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </ResponsiveDrawer>
    </>
  );
}
