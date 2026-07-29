"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const WEEKDAY_LABEL = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

const STATUS_LABEL: Record<string, string> = {
  DONE_ON_TIME: "Đã hoàn thành hôm nay",
  DONE_LATE: "Hoàn thành muộn",
  OVERDUE: "Chưa hoàn thành",
  PENDING: "Chưa tới hạn",
};

const STATUS_CLASS: Record<string, string> = {
  DONE_ON_TIME: "bg-emerald-50 text-emerald-700",
  DONE_LATE: "bg-amber-50 text-amber-700",
  OVERDUE: "bg-red-50 text-red-700",
  PENDING: "bg-ink/5 text-ink-muted48",
};

type ClassTask = {
  id: string;
  title: string;
  recurrence: string;
  dayOfMonth: number | null;
  weekday: number | null;
  onceDate: string | Date | null;
  isActive: boolean;
  dueToday: boolean;
  todayStatus: string | null;
};

function recurrenceDescription(t: ClassTask) {
  if (t.recurrence === "MONTHLY_DAY") return `Ngày ${t.dayOfMonth} hàng tháng`;
  if (t.recurrence === "WEEKDAY") return `${WEEKDAY_LABEL[t.weekday ?? 0]} hàng tuần`;
  if (t.recurrence === "ONE_OFF") return t.onceDate ? new Date(t.onceDate).toLocaleDateString("vi-VN") : "—";
  return t.recurrence;
}

export default function ClassRecurringTaskManager({ classId, tasks }: { classId: string; tasks: ClassTask[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState("MONTHLY_DAY");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [weekday, setWeekday] = useState("1");
  const [onceDate, setOnceDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body: Record<string, unknown> = { title, recurrence };
    if (recurrence === "MONTHLY_DAY") body.dayOfMonth = Number(dayOfMonth);
    if (recurrence === "WEEKDAY") body.weekday = Number(weekday);
    if (recurrence === "ONE_OFF") body.onceDate = onceDate;

    const res = await fetch(`/api/classes/${classId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo nhắc việc.");
      return;
    }
    setTitle("");
    setOpen(false);
    router.refresh();
  }

  async function toggleComplete(taskId: string, undo: boolean) {
    await fetch(`/api/class-tasks/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ undo }),
    });
    router.refresh();
  }

  async function deactivate(taskId: string) {
    await fetch(`/api/class-tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Nhắc việc định kỳ</h2>
        <button onClick={() => setOpen(!open)} className="btn-ghost-sm">
          {open ? "Đóng" : "+ Thêm"}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {tasks.filter((t) => t.isActive).map((t) => (
          <div key={t.id} className="rounded-lg border border-hairline px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">{t.title}</p>
              {t.dueToday && t.todayStatus && (
                <span className={`badge ${STATUS_CLASS[t.todayStatus] ?? "bg-ink/5"}`}>{STATUS_LABEL[t.todayStatus]}</span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between text-ink-muted48">
              <span>{recurrenceDescription(t)}</span>
              {t.dueToday ? (
                t.todayStatus === "DONE_ON_TIME" || t.todayStatus === "DONE_LATE" ? (
                  <button onClick={() => toggleComplete(t.id, true)} className="text-xs text-ink-muted48">
                    Bỏ đánh dấu
                  </button>
                ) : (
                  <button onClick={() => toggleComplete(t.id, false)} className="text-xs text-primary">
                    Đánh dấu xong hôm nay
                  </button>
                )
              ) : (
                <button onClick={() => deactivate(t.id)} className="text-xs text-red-600">
                  Ngừng nhắc
                </button>
              )}
            </div>
          </div>
        ))}
        {tasks.filter((t) => t.isActive).length === 0 && (
          <p className="text-sm text-ink-muted48">Chưa có nhắc việc định kỳ cho lớp này.</p>
        )}
      </div>

      {open && (
        <form onSubmit={addTask} className="mt-3 space-y-2 border-t border-hairline pt-3">
          <input required placeholder="Tên công việc..." className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <select className="input" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              <option value="MONTHLY_DAY">Theo ngày trong tháng</option>
              <option value="WEEKDAY">Theo thứ trong tuần</option>
              <option value="ONE_OFF">Một lần</option>
            </select>
            {recurrence === "MONTHLY_DAY" && (
              <input
                type="number"
                min={1}
                max={31}
                className="input w-24"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
            )}
            {recurrence === "WEEKDAY" && (
              <select className="input" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                {WEEKDAY_LABEL.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            {recurrence === "ONE_OFF" && (
              <input type="date" className="input" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} />
            )}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "..." : "Lưu"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
