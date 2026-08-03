"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RateSetupItem = {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string | null;
  payMode: string;
  teachingHourlyRate: number | null;
  assistantHourlyRate: number | null;
  staffDailyRate: number | null;
  teachingHours: number;
  assistantHours: number;
  staffDays: number;
};

export type { RateSetupItem };

function formatMetric(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function defaultFormFor(item: RateSetupItem) {
  return {
    payMode: item.payMode ?? "HOURLY",
    teachingHourlyRate: item.teachingHourlyRate != null ? String(item.teachingHourlyRate) : "",
    assistantHourlyRate: item.assistantHourlyRate != null ? String(item.assistantHourlyRate) : "",
    staffDailyRate: item.staffDailyRate != null ? String(item.staffDailyRate) : "",
  };
}

export default function PayrollRateSetupPanel({
  items,
  title = "Sửa đơn giá ngay trong Payroll",
  summary = "Chỉ hiện những người đang có phát sinh nhưng còn thiếu đơn giá. Lưu xong có thể bấm tính lương lại ngay.",
}: {
  items: RateSetupItem[];
  title?: string;
  summary?: string;
}) {
  const router = useRouter();
  const [forms, setForms] = useState<Record<string, { payMode: string; teachingHourlyRate: string; assistantHourlyRate: string; staffDailyRate: string }>>(
    Object.fromEntries(items.map((item) => [item.id, defaultFormFor(item)])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(itemId: string) {
    const item = items.find((candidate) => candidate.id === itemId);
    const form = forms[itemId] ?? (item ? defaultFormFor(item) : undefined);
    if (!form) return;
    setSavingId(itemId);
    setError(null);
    const res = await fetch(`/api/employees/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok) {
      setError(data.error ?? "Không thể lưu đơn giá.");
      return;
    }
    router.refresh();
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-3xl border-2 border-red-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Thiết lập nhanh</p>
      <h2 className="mt-2 text-xl font-black text-[#111827]">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6b7280]">{summary}</p>

      <div className="mt-4 space-y-4">
        {items.map((item) => {
          const form = forms[item.id] ?? defaultFormFor(item);
          const missingLabels = [
            item.teachingHours > 0 && item.teachingHourlyRate == null ? "đơn giá dạy" : null,
            item.assistantHours > 0 && item.assistantHourlyRate == null ? "đơn giá trợ giảng" : null,
            item.staffDays > 0 && item.staffDailyRate == null ? "đơn giá công HC" : null,
          ].filter(Boolean);

          return (
            <div key={item.id} className="rounded-2xl border border-[#e5e7eb] bg-[#fffaf5] p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-black text-[#111827]">{item.fullName}</p>
                    <span className="rounded-full border border-[#fed7aa] bg-white px-3 py-1 text-xs font-bold text-[#9a3412]">
                      {item.employeeCode}
                    </span>
                    {missingLabels.length > 0 ? (
                      <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                        Thiếu: {missingLabels.join(", ")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-[#6b7280]">{item.position ?? "Chưa có vị trí"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.teachingHours > 0 ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                        Dạy: {formatMetric(item.teachingHours)} {item.payMode === "SESSION" ? "ca" : "giờ"}
                      </span>
                    ) : null}
                    {item.assistantHours > 0 ? (
                      <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                        TG: {formatMetric(item.assistantHours)} {item.payMode === "SESSION" ? "ca" : "giờ"}
                      </span>
                    ) : null}
                    {item.staffDays > 0 ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        HC: {formatMetric(item.staffDays)} công
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:max-w-3xl xl:grid-cols-5">
                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9ca3af]">Kiểu tính</span>
                    <select
                      className="input"
                      value={form.payMode}
                      onChange={(e) =>
                        setForms((current) => ({
                          ...current,
                          [item.id]: { ...(current[item.id] ?? defaultFormFor(item)), payMode: e.target.value },
                        }))
                      }
                    >
                      <option value="HOURLY">Theo giờ</option>
                      <option value="SESSION">Theo ca</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
                      {form.payMode === "SESSION" ? "Dạy/ca" : "Dạy/giờ"}
                    </span>
                    <input
                      className="input"
                      type="number"
                      value={form.teachingHourlyRate}
                      onChange={(e) =>
                        setForms((current) => ({
                          ...current,
                          [item.id]: { ...(current[item.id] ?? defaultFormFor(item)), teachingHourlyRate: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
                      {form.payMode === "SESSION" ? "TG/ca" : "TG/giờ"}
                    </span>
                    <input
                      className="input"
                      type="number"
                      value={form.assistantHourlyRate}
                      onChange={(e) =>
                        setForms((current) => ({
                          ...current,
                          [item.id]: { ...(current[item.id] ?? defaultFormFor(item)), assistantHourlyRate: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9ca3af]">1 công HC</span>
                    <input
                      className="input"
                      type="number"
                      value={form.staffDailyRate}
                      onChange={(e) =>
                        setForms((current) => ({
                          ...current,
                          [item.id]: { ...(current[item.id] ?? defaultFormFor(item)), staffDailyRate: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => save(item.id)}
                      disabled={savingId === item.id}
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {savingId === item.id ? "Đang lưu..." : "Lưu đơn giá"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
