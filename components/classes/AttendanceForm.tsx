"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RosterRow = {
  studentId: string;
  fullName: string;
  studentCode: string;
  status: string;
};

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Có mặt", tone: "bg-emerald-500 text-white border-emerald-500" },
  { value: "ABSENT", label: "Vắng", tone: "bg-rose-500 text-white border-rose-500" },
  { value: "MAKEUP", label: "Học bù", tone: "bg-sky-500 text-white border-sky-500" },
  { value: "EXCUSED", label: "Vắng có phép", tone: "bg-amber-500 text-white border-amber-500" },
];

function statusSummary(status: string) {
  switch (status) {
    case "PRESENT":
      return "Đã tham gia buổi học bình thường";
    case "ABSENT":
      return "Vắng mặt và cần theo dõi";
    case "MAKEUP":
      return "Học bù cho lịch khác";
    case "EXCUSED":
      return "Vắng có báo trước / được duyệt";
    default:
      return "Chưa cập nhật";
  }
}

export default function AttendanceForm({ sessionId, initialRoster }: { sessionId: string; initialRoster: RosterRow[] }) {
  const router = useRouter();
  const [roster, setRoster] = useState(initialRoster);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setStudentStatus(studentId: string, status: string) {
    setRoster((current) => current.map((row) => (row.studentId === studentId ? { ...row, status } : row)));
    setSaved(false);
  }

  async function save() {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/sessions/${sessionId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records: roster.map((row) => ({ studentId: row.studentId, status: row.status })),
      }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
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
    <div className="space-y-4">
      <div className="space-y-4">
        {roster.map((row, index) => (
          <div key={row.studentId} className="rounded-[28px] border border-hairline bg-white/90 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef6ff] text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-base font-semibold text-ink">{row.fullName}</p>
                    <p className="text-xs text-ink-muted48">{row.studentCode}</p>
                  </div>
                </div>
                <p className="text-sm text-ink-muted80">{statusSummary(row.status)}</p>
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-[520px] lg:justify-end">
                {STATUS_OPTIONS.map((option) => {
                  const active = row.status === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStudentStatus(row.studentId, option.value)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        active ? option.tone : "border-[#d9e8f8] bg-white text-ink-muted80 hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-primary">Đã lưu điểm danh và đánh dấu hoàn thành buổi học.</p> : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
        <button type="button" onClick={save} disabled={loading} className="btn-primary">
          {loading ? "Đang lưu..." : "Lưu điểm danh & đánh dấu hoàn thành"}
        </button>
        <p className="text-sm text-ink-muted48">Nút này sẽ chốt trạng thái điểm danh hiện tại của cả buổi học.</p>
      </div>
    </div>
  );
}
