"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RosterRow = { studentId: string; fullName: string; studentCode: string; status: string };

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Có mặt" },
  { value: "ABSENT", label: "Vắng" },
  { value: "MAKEUP", label: "Học bù" },
  { value: "EXCUSED", label: "Vắng có phép" },
];

export default function AttendanceForm({ sessionId, initialRoster }: { sessionId: string; initialRoster: RosterRow[] }) {
  const router = useRouter();
  const [roster, setRoster] = useState(initialRoster);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setStudentStatus(studentId: string, status: string) {
    setRoster((r) => r.map((row) => (row.studentId === studentId ? { ...row, status } : row)));
    setSaved(false);
  }

  async function save() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: roster.map((r) => ({ studentId: r.studentId, status: r.status })) }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Không thể lưu điểm danh.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  if (roster.length === 0) {
    return <p className="text-sm text-ink-muted48">Lớp chưa có học viên đang học để điểm danh.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-hairline rounded-lg border border-hairline">
        {roster.map((row) => (
          <div key={row.studentId} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{row.fullName}</p>
              <p className="text-xs text-ink-muted48">{row.studentCode}</p>
            </div>
            <div className="flex gap-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStudentStatus(row.studentId, opt.value)}
                  className={`rounded-full px-2.5 py-1 text-xs transition ${
                    row.status === opt.value ? "bg-primary text-white" : "bg-canvas-parchment text-ink-muted48"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-primary">Đã lưu điểm danh — buổi học được đánh dấu hoàn thành.</p>}
      <button onClick={save} disabled={loading} className="btn-primary w-full">
        {loading ? "Đang lưu..." : "Lưu điểm danh & đánh dấu hoàn thành"}
      </button>
    </div>
  );
}
