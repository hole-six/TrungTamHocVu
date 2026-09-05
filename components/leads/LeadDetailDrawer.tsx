"use client";

import { useCallback, useEffect, useState } from "react";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import LeadDetailContent, { type LeadDetailData } from "@/components/leads/LeadDetailContent";

export default function LeadDetailDrawer({
  leadId,
  onClose,
  classOptions = [],
}: {
  leadId: string | null;
  onClose: () => void;
  classOptions?: { id: string; className: string }[];
}) {
  const [data, setData] = useState<LeadDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/leads/${leadId}/detail`);
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Không thể tải chi tiết lead.");
      return;
    }
    setData(result);
  }, [leadId]);

  useEffect(() => {
    if (!leadId) {
      setData(null);
      return;
    }
    load();
  }, [leadId, load]);

  return (
    <ResponsiveDrawer
      open={Boolean(leadId)}
      onClose={onClose}
      title={data?.lead.fullName ?? "Chi tiết lead"}
      widthClassName="max-w-2xl"
    >
      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-sm text-ink-muted48">Đang tải...</div>
      ) : error ? (
        <div className="alert-danger">{error}</div>
      ) : data ? (
        // key theo lead.id — bắt React dựng lại component khi mở lead khác, nếu không
        // state form sửa tại chỗ sẽ giữ nguyên giá trị của lead vừa xem trước đó.
        <LeadDetailContent key={data.lead.id} data={data} classOptions={classOptions} onChanged={load} onDeleted={onClose} />
      ) : null}
    </ResponsiveDrawer>
  );
}
