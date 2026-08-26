"use client";

import { useCallback, useEffect, useState } from "react";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import LeadDetailContent, { type LeadDetailData } from "@/components/leads/LeadDetailContent";

export default function LeadDetailDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
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
      description={data?.lead.leadCode}
      widthClassName="max-w-7xl"
    >
      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-sm text-ink-muted48">Đang tải chi tiết lead...</div>
      ) : error ? (
        <div className="alert-danger">{error}</div>
      ) : data ? (
        <LeadDetailContent data={data} onChanged={load} />
      ) : null}
    </ResponsiveDrawer>
  );
}
