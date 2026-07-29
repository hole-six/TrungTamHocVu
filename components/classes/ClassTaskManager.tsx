"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Task = { id: string; title: string; description: string | null; dueDate: string | Date | null; status: string };

function formatDate(d: string | Date | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
}

export default function ClassTaskManager({ classId, tasks }: { classId: string; tasks: Task[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dueDate, relatedType: "Class", relatedId: classId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể tạo việc cần làm.");
      return;
    }
    setTitle("");
    setDueDate("");
    router.refresh();
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  const openTasks = tasks.filter((t) => t.status === "OPEN");
  const doneTasks = tasks.filter((t) => t.status !== "OPEN");

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Việc cần làm</h2>
      <div className="mt-3 space-y-2">
        {openTasks.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-ink-muted48">Hạn: {formatDate(t.dueDate)}</p>
            </div>
            <button onClick={() => setStatus(t.id, "DONE")} className="text-xs text-primary">
              Đánh dấu xong
            </button>
          </div>
        ))}
        {openTasks.length === 0 && <p className="text-sm text-ink-muted48">Không có việc cần làm.</p>}
        {doneTasks.length > 0 && (
          <details className="text-xs text-ink-muted48">
            <summary className="cursor-pointer">{doneTasks.length} việc đã xong</summary>
            <div className="mt-2 space-y-1">
              {doneTasks.map((t) => (
                <p key={t.id} className="line-through">
                  {t.title}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>

      <form onSubmit={addTask} className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
        <input required placeholder="Việc cần làm..." className="input flex-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <button type="submit" disabled={loading} className="btn-ghost">
          {loading ? "..." : "+ Thêm"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
