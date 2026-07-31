"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/ui/DatePicker";

function toYmd(d: Date | string | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default function EditablePlacementTestDateField({
  leadId,
  placementTestId,
  field,
  value,
  width = "w-40",
}: {
  leadId: string;
  placementTestId?: string | null;
  field: "scheduledDate" | "testDate";
  value: Date | string | null;
  width?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(toYmd(value));

  async function save(next: string) {
    setSaving(true);

    const endpoint = placementTestId ? `/api/placement-tests/${placementTestId}` : `/api/leads/${leadId}/placement-test`;
    const method = placementTestId ? "PATCH" : "POST";
    const body =
      field === "scheduledDate"
        ? { scheduledDate: next || null }
        : { testDate: next || null, status: next ? "PASSED" : "SCHEDULED" };

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (res.ok) {
      setCurrent(next);
      router.refresh();
    }
  }

  return (
    <div className={width}>
      <DatePicker value={current} onChange={save} placeholder={saving ? "Đang lưu..." : "Chọn ngày"} />
    </div>
  );
}
