"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  fullName: string;
  employeeCode: string;
};

type TimesheetFormProps = {
  employees: Employee[];
  date?: string;
};

export default function TimesheetForm({ employees, date }: TimesheetFormProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(date ?? new Date().toISOString().slice(0, 10));
  const [timesheets, setTimesheets] = useState<Record<string, { checkIn: string; checkOut: string; notes: string }>>(
    Object.fromEntries(employees.map((e) => [e.id, { checkIn: "", checkOut: "", notes: "" }]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateTimesheet(empId: string, field: "checkIn" | "checkOut" | "notes", value: string) {
    setTimesheets((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: value },
    }));
    setSaved(false);
  }

  function calculateHours(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 0;
    const inTime = new Date(`2000-01-01T${checkIn}`);
    const outTime = new Date(`2000-01-01T${checkOut}`);
    const diff = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
    return Math.max(0, diff);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const entries = Object.entries(timesheets)
      .filter(([_, data]) => data.checkIn || data.checkOut)
      .map(([employeeId, data]) => ({
        employeeId,
        date: selectedDate,
        ...data,
      }));

    const res = await fetch("/api/timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể lưu chấm công.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-ink">Chấm công</h2>
            <p className="text-sm text-ink-muted48">{employees.length} nhân viên</p>
          </div>
        </div>

        {/* Date selector */}
        <div className="form-group max-w-xs">
          <label className="label">Ngày chấm công</label>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Employee list */}
        <div className="space-y-3">
          {employees.map((emp) => {
            const data = timesheets[emp.id];
            const hours = calculateHours(data.checkIn, data.checkOut);

            return (
              <div
                key={emp.id}
                className="rounded-xl border border-[#e8edf5] bg-gradient-to-br from-white to-[#fafbff] p-4"
              >
                {/* Employee info */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 shrink-0">
                    <span className="text-sm font-bold text-blue-700">
                      {emp.fullName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-ink">{emp.fullName}</p>
                    <p className="text-xs font-mono text-ink-muted48">{emp.employeeCode}</p>
                  </div>
                  {hours > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2.5 py-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span className="text-xs font-bold text-emerald-700">{hours.toFixed(1)}h</span>
                    </div>
                  )}
                </div>

                {/* Time inputs */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="form-group">
                    <label className="label text-xs">Giờ vào</label>
                    <input
                      type="time"
                      className="input"
                      value={data.checkIn}
                      onChange={(e) => updateTimesheet(emp.id, "checkIn", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label text-xs">Giờ ra</label>
                    <input
                      type="time"
                      className="input"
                      value={data.checkOut}
                      onChange={(e) => updateTimesheet(emp.id, "checkOut", e.target.value)}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group mt-3">
                  <label className="label text-xs">Ghi chú</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="Đi muộn, về sớm, nghỉ phép..."
                    value={data.notes}
                    onChange={(e) => updateTimesheet(emp.id, "notes", e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Feedback */}
        {error && (
          <div className="alert-danger flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
        {saved && (
          <div className="alert-success flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Đã lưu chấm công thành công
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-ghost flex-1 sm:flex-initial"
          >
            Hủy
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
                </svg>
                Đang lưu...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Lưu chấm công
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
