"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Task = { id: string; title: string; description: string | null; dueDate: string | Date | null; status: string };

function formatDate(d: string | Date | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
}

function toDateInputValue(d: string | Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function TaskRow({ task, onChanged }: { task: Task; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể lưu.");
      return false;
    }
    return true;
  }

  async function saveEdit() {
    if (await patch({ title, dueDate: dueDate || null })) {
      setEditing(false);
      onChanged();
    }
  }

  async function markDone() {
    if (await patch({ status: "DONE" })) onChanged();
  }

  async function remove() {
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể xóa việc cần làm.");
      return;
    }
    onChanged();
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-hairline px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input h-8 flex-1 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="date" className="input h-8 text-xs" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button type="button" onClick={saveEdit} disabled={loading} className="text-xs font-semibold text-primary">
            {loading ? "..." : "Lưu"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-muted48">
            Hủy
          </button>
        </div>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
      <div>
        <p className="font-medium">{task.title}</p>
        <p className="text-xs text-ink-muted48">Hạn: {formatDate(task.dueDate)}</p>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={markDone} disabled={loading} className="text-xs text-primary">
          Đánh dấu xong
        </button>
        <button onClick={() => setEditing(true)} className="text-xs text-ink-muted64">
          Sửa
        </button>
        <ConfirmActionButton
          title="Xác nhận xóa việc cần làm?"
          description={`Xóa việc "${task.title}". Thao tác này không thể hoàn tác.`}
          confirmLabel="Xóa"
          tone="danger"
          className="text-xs text-red-600"
          onConfirm={remove}
        >
          Xóa
        </ConfirmActionButton>
      </div>
    </div>
  );
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

  const openTasks = tasks.filter((t) => t.status === "OPEN");
  const doneTasks = tasks.filter((t) => t.status !== "OPEN");

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Việc cần làm</h2>
      <div className="mt-3 space-y-2">
        {openTasks.map((t) => (
          <TaskRow key={t.id} task={t} onChanged={() => router.refresh()} />
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
