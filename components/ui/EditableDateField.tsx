"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/ui/DatePicker";

function toYmd(d: Date | string | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

// Ô ngày sửa nhanh dùng chung mọi nơi cần "bấm vào ngày -> chọn trên lịch -> lưu
// luôn" (PATCH endpoint, 1 field) — không cần bấm Lưu riêng, khác ô ghi chú (gõ
// tay nên phải có nút Lưu). Tổng quát hóa từ components/leads/EditableDateCell.tsx
// (trước chỉ dùng được cho Lead) để dùng lại được ở Student và các entity khác.
export default function EditableDateField({
  endpoint,
  field,
  value,
  width = "w-36",
}: {
  endpoint: string;
  field: string;
  value: Date | string | null;
  width?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(toYmd(value));

  async function save(next: string) {
    setSaving(true);
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: next || null }),
    });
    setSaving(false);
    if (res.ok) {
      setCurrent(next);
      router.refresh();
    }
  }

  return (
    <div className={width}>
      <DatePicker value={current} onChange={save} placeholder={saving ? "Đang lưu..." : "Chưa có"} />
    </div>
  );
}
