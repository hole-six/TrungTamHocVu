"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormGuide from "@/components/ui/FormGuide";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(periodName: string) {
  const [yearText, monthText] = periodName.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return currentMonth();
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

type BillingPeriodPayload = {
  id: string;
  periodName: string;
};

const PERIOD_GUIDE_SECTIONS = [
  {
    title: "Khi nào tạo kỳ thu mới?",
    items: [
      "Dùng khi trung tâm bắt đầu một kỳ/tháng thu học phí mới cần tách riêng để vận hành và in phiếu.",
      "Mỗi kỳ thu thường là một mốc dạng YYYY-MM như 2026-08, 2026-09.",
      "Nếu kỳ đã tồn tại rồi, hệ thống sẽ mở lại kỳ đó thay vì tạo trùng thêm một bản mới.",
    ],
    tone: "info" as const,
  },
  {
    title: "Nguyên tắc vận hành",
    items: [
      "Tạo đúng kỳ đang cần xử lý trước khi sinh danh sách thu hoặc xuất phiếu hàng loạt.",
      "Kỳ thu là cái khung để hệ thống nhóm công nợ, hóa đơn và danh sách cần xử lý.",
      "Sau khi tạo xong, bạn có thể tạo tiếp kỳ kế tiếp nếu đang setup trước cho nhiều tháng.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi hay gặp",
    items: [
      "Tạo nhầm tháng làm người vận hành nhìn sai danh sách cần thu.",
      "Tưởng rằng bấm tạo lại sẽ sinh bản ghi mới, trong khi thực tế có thể chỉ đang mở lại kỳ cũ.",
      "Chưa hiểu rõ kỳ đang xem là tháng nào nên thao tác xuất phiếu/thu tiền bị nhầm ngữ cảnh.",
    ],
    tone: "warning" as const,
  },
];

export default function NewPeriodForm({
  onCreated,
}: {
  onCreated?: (period: BillingPeriodPayload, options: { existing: boolean }) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [periodName, setPeriodName] = useState(currentMonth());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/billing-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodName }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không thể tạo kỳ thu.");
      return;
    }

    if (onCreated) {
      onCreated(data.item, { existing: Boolean(data.existing) });
      setNotice(
        data.existing
          ? `Kỳ ${data.item.periodName} đã có sẵn, đã mở lại trong workspace.`
          : `Đã tạo kỳ ${data.item.periodName}. Bạn có thể tạo tiếp kỳ kế tiếp.`,
      );
      setPeriodName(nextMonth(data.item.periodName));
      return;
    }

    router.push(`/tuition/${data.item.id}`);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        + Tạo kỳ thu
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <FormGuide
        title="Hướng dẫn tạo kỳ thu"
        summary="Đây là bước mở một kỳ/tháng thu học phí để hệ thống nhóm đúng công nợ và danh sách xuất phiếu. Chọn đúng tháng là điều quan trọng nhất."
        sections={PERIOD_GUIDE_SECTIONS}
        position="inline"
      />
      <input
        type="month"
        required
        className="input"
        value={periodName}
        onChange={(event) => setPeriodName(event.target.value)}
      />
      <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
        {loading ? "Đang tạo..." : "Tạo kỳ"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost whitespace-nowrap">
        Đóng
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
    </form>
  );
}
