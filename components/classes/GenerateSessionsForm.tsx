"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";

const GENERATE_SESSIONS_GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng?",
    items: [
      "Dùng để biến lịch chuẩn thành các buổi học thực tế trong một khoảng ngày.",
      "Có thể chạy nhiều lần; hệ thống tự bỏ qua buổi đã tồn tại.",
      "Cần dạy tiếp sau các buổi đã sinh trước đó thì chọn khoảng ngày kế tiếp và sinh thêm ở đây.",
    ],
    tone: "info" as const,
  },
  {
    title: "Sinh thêm buổi là có thêm tiền",
    items: [
      "Học viên đóng THEO THÁNG (đa số): mỗi buổi lớp dạy trừ 1 buổi trong ví học của em đó, hết ví là phải đóng tiếp — sinh thêm buổi nghĩa là kỳ sau thu thêm tiền, không phải dạy thêm miễn phí.",
      "Học viên mua TRỌN KHÓA: đã trả đủ số buổi đã mua, buổi vượt quá số đó không thu thêm.",
      "Muốn dạy bù/dạy thêm mà KHÔNG thu tiền thì đừng sinh buổi mới ở đây — dùng buổi bổ trợ cho từng học viên.",
    ],
    tone: "warning" as const,
  },
  {
    title: "Cần nhớ",
    items: [
      "Tổng số buổi của lớp chỉ là số buổi dự kiến của lộ trình, không phải trần cứng của lịch.",
      "Sinh buổi chỉ tạo trong khoảng ngày đang chọn; nếu bỏ qua một thời gian dài rồi sinh lại, buổi mới sẽ nằm theo lịch chuẩn trong khoảng mới đó.",
      "Sửa lịch chuẩn chỉ ảnh hưởng lần sinh buổi mới về sau, không sửa buổi quá khứ.",
      "Buổi học lệch lịch hoặc đổi buổi nên xử lý trên từng session riêng.",
    ],
    tone: "warning" as const,
  },
  {
    title: "Sinh tiếp lịch trong thực tế",
    items: [
      "Ví dụ lớp có thời gian học từ 28/09 đến 28/11 nhưng chỉ sinh trước 2 buổi, thời khóa biểu chỉ hiển thị đúng 2 buổi đã sinh.",
      "Nếu sau đó cần sinh thêm từ ngày 14/11, hãy chọn khoảng sinh bắt đầu từ 14/11; buổi mới sẽ nằm trong khoảng mới theo lịch chuẩn, không tự lấp các tuần đã bỏ qua.",
      "Một buổi cụ thể cần đổi ngày/giờ thì mở chi tiết buổi học hoặc dùng chức năng Đổi lịch của buổi đó, không sửa lịch chuẩn để kỳ vọng buổi cũ đổi theo.",
      "Lớp bổ trợ nên sinh đúng số buổi thật sự cần dùng để dễ kiểm soát lịch, nhân sự và công nợ liên quan.",
    ],
    tone: "success" as const,
  },
];

export default function GenerateSessionsForm({
  classId,
  totalSessions,
  existingSessionCount = 0,
  onSuccess,
}: {
  classId: string;
  /** Tổng số buổi cam kết/học phí của lớp — để hiện so sánh cụ thể thay vì mô tả chung chung. */
  totalSessions?: number | null;
  /** Số buổi đã sinh sẵn tính đến thời điểm mở form. */
  existingSessionCount?: number;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const remainingToCommitment = totalSessions ? Math.max(0, totalSessions - existingSessionCount) : null;

  function fillNext90Days() {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 90);
    setFromDate(today.toISOString().slice(0, 10));
    setToDate(end.toISOString().slice(0, 10));
    setError(null);
    setResult(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const response = await fetch(`/api/classes/${classId}/generate-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate, toDate }),
    });
    const resultData = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(resultData.error ?? "Không thể sinh buổi học.");
      return;
    }

    setResult(`Đã sinh ${resultData.created} buổi mới, bỏ qua ${resultData.skipped} buổi đã tồn tại.`);
    router.refresh();
    onSuccess?.();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost">
        Sinh buổi học
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Sinh buổi học theo lịch chuẩn"
        description="Tạo buổi học thực tế từ lịch chuẩn của lớp. Học viên đóng theo tháng trả tiền theo số buổi lớp thật sự dạy, nên sinh thêm buổi là kỳ sau thu thêm."
        guide={
          <FormGuide
            title="Hướng dẫn sinh buổi học"
            summary="Dùng form này khi cần tạo thêm các buổi học thực tế để giáo viên điểm danh và ghi nhật ký."
            sections={GENERATE_SESSIONS_GUIDE_SECTIONS}
            position="inline"
          />
        }
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-[#64748b]">
            <p className="font-semibold text-[#0f1729]">Lưu ý vận hành</p>
            <p className="mt-1">
              {totalSessions
                ? remainingToCommitment && remainingToCommitment > 0
                  ? `Lớp dự kiến ${totalSessions} buổi — đã sinh ${existingSessionCount} buổi, còn thiếu ${remainingToCommitment} buổi để đủ lộ trình. Chọn khoảng ngày bên dưới để sinh tiếp.`
                  : `Lớp dự kiến ${totalSessions} buổi — đã sinh đủ ${existingSessionCount} buổi. Sinh thêm ở đây là lớp dạy thêm buổi thật: học viên đóng theo tháng sẽ bị trừ ví mỗi buổi và phải đóng tiền cho những buổi đó.`
                : "Tổng số buổi chỉ là số buổi dự kiến của lộ trình, không phải trần cứng của lịch — nhưng tiền thì tính theo số buổi lớp thật sự dạy."}
            </p>
            <button type="button" onClick={fillNext90Days} className="mt-3 text-xs font-bold text-primary">
              Điền nhanh 90 ngày tới
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group">
              <span className="label">Từ ngày</span>
              <input type="date" required className="input" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>

            <label className="form-group">
              <span className="label">Đến ngày</span>
              <input type="date" required className="input" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </div>

          {result ? <div className="alert-success">{result}</div> : null}
          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang sinh..." : "Xác nhận sinh buổi học"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </form>
      </ResponsiveDrawer>
    </>
  );
}
