"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { PLACEMENT_TEST_STATUSES, PLACEMENT_TEST_STATUS_LABEL } from "@/lib/server/lead-rules";
import DatePicker from "@/components/ui/DatePicker";

type LatestTest = {
  id: string;
  scheduledDate: Date | string | null;
  testDate: Date | string | null;
  status: string;
  result: string | null;
} | null;

function toYmd(d: Date | string | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default function TestQuickAction({
  leadId,
  latestTest,
  expectedStartDate,
  actualEnrollDate,
  interestedClassId,
  classOptions,
  onSaved,
}: {
  leadId: string;
  latestTest: LatestTest;
  expectedStartDate?: Date | string | null;
  actualEnrollDate?: Date | string | null;
  interestedClassId?: string | null;
  classOptions: { id: string; className: string }[];
  /** Nơi gọi tự giữ dữ liệu trong state phải nạp lại sau khi lưu. */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    scheduledDate: toYmd(latestTest?.scheduledDate ?? null),
    testDate: toYmd(latestTest?.testDate ?? null),
    status: latestTest?.status ?? "SCHEDULED",
    result: latestTest?.result ?? "",
    expectedStartDate: toYmd(expectedStartDate ?? null),
    actualEnrollDate: toYmd(actualEnrollDate ?? null),
  });
  const [selectedClassId, setSelectedClassId] = useState(interestedClassId ?? "");
  const canSetStartDate = form.status === "PASSED";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setForm({
      scheduledDate: toYmd(latestTest?.scheduledDate ?? null),
      testDate: toYmd(latestTest?.testDate ?? null),
      status: latestTest?.status ?? "SCHEDULED",
      result: latestTest?.result ?? "",
      expectedStartDate: toYmd(expectedStartDate ?? null),
      actualEnrollDate: toYmd(actualEnrollDate ?? null),
    });
    setSelectedClassId(interestedClassId ?? "");
    setError(null);
  }, [open, latestTest?.id, latestTest?.scheduledDate, latestTest?.testDate, latestTest?.status, expectedStartDate, actualEnrollDate, interestedClassId]);

  async function save() {
    setSaving(true);
    setError(null);
    const expectedStartDateInput = form.expectedStartDate;
    const testForm = {
      scheduledDate: form.scheduledDate,
      testDate: form.testDate,
      status: form.status,
      result: form.result,
    };
    const url = latestTest ? `/api/placement-tests/${latestTest.id}` : `/api/leads/${leadId}/placement-test`;
    const res = await fetch(url, {
      method: latestTest ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testForm),
    });
    if (!res.ok) {
      setSaving(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể lưu lịch/kết quả test.");
      return;
    }

    const testData = await res.json().catch(() => ({}));
    const leadStatusMessage: string | null = testData?.leadStatusMessage ?? null;

    const leadPatch: Record<string, unknown> = {
      interestedClassId: selectedClassId || null,
    };
    if (canSetStartDate) {
      leadPatch.expectedStartDate = expectedStartDateInput || null;
      leadPatch.subStatus = selectedClassId ? "CLASS_ASSIGNED" : "WAITING_CLASS";
    }

    const leadRes = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadPatch),
    });
    if (!leadRes.ok) {
      setSaving(false);
      const data = await leadRes.json().catch(() => ({}));
      setError(data.error ?? "Đã lưu test nhưng chưa lưu được lớp/ngày dự kiến.");
      return;
    }

    setSaving(false);
    setOpen(false);
    if (leadStatusMessage) toast.success(leadStatusMessage, "Đã đồng bộ trạng thái lead");
    toast.success(
      form.status === "PASSED"
        ? "Đã lưu kết quả Đạt. Muốn chuyển thành học viên thì bấm Gán lớp ở danh sách."
        : "Đã lưu lịch/kết quả test.",
      "Đã lưu",
    );
    onSaved?.();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#0f1729] hover:border-[#0f1729]"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        {latestTest ? "Cập nhật test" : "Hẹn test"}
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex justify-end">
              <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
              <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-[slideInRight_0.2s_ease-out]">
                <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
                  <h3 className="font-display text-base font-bold text-ink">{latestTest ? "Cập nhật test" : "Hẹn lịch test mới"}</h3>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-muted48 hover:bg-ink/5 hover:text-ink">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-800">
                    Lưu ở đây chỉ cập nhật lịch/kết quả test và lớp dự kiến. Khi học viên đạt test, phải bấm riêng nút Gán lớp ở danh sách để tạo học viên.
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="label">Ngày hẹn test</label>
                      <DatePicker value={form.scheduledDate} onChange={(v) => setForm((f) => ({ ...f, scheduledDate: v }))} />
                    </div>
                    <div className="form-group">
                      <label className="label">Ngày đến test</label>
                      <DatePicker value={form.testDate} onChange={(v) => setForm((f) => ({ ...f, testDate: v }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label">Tình trạng test</label>
                    <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                      {PLACEMENT_TEST_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {PLACEMENT_TEST_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Lớp dự kiến</label>
                    <select className="input" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
                      <option value="">-- Chưa xác định --</option>
                      {classOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.className}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Ngày dự kiến đi học</label>
                    {canSetStartDate ? (
                      <DatePicker value={form.expectedStartDate} onChange={(v) => setForm((f) => ({ ...f, expectedStartDate: v }))} />
                    ) : (
                      <>
                        <div className="input flex items-center gap-2 text-ink-muted48">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {form.expectedStartDate ? new Date(form.expectedStartDate).toLocaleDateString("vi-VN") : "Chưa xác định"}
                        </div>
                        <p className="form-hint">Chỉ chỉnh được sau khi chọn tình trạng test là "Đạt".</p>
                      </>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="label">Kết quả / nhận xét</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={form.result}
                      onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
                    />
                  </div>
                  {error && <div className="alert-danger text-xs">{error}</div>}
                </div>

                <div className="flex justify-end gap-2 border-t border-hairline px-5 py-4">
                  <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">
                    Hủy
                  </button>
                  <button type="button" onClick={save} disabled={saving} className="btn-primary text-xs">
                    {saving ? "Đang lưu..." : "Lưu test"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
