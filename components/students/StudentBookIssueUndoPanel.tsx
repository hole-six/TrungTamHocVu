"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UndoableBookIssue = {
  id: string;
  bookName: string;
  amount: number;
  quantity: number;
  issueDate: string;
  className?: string | null;
};

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function StudentBookIssueUndoPanel({
  issues,
  canManageInventory,
}: {
  issues: UndoableBookIssue[];
  canManageInventory: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManageInventory || issues.length === 0) return null;

  async function removeIssue(issueId: string) {
    if (!confirm("Xóa dòng sách này? Hệ thống sẽ hoàn tác công nợ và trả lại tồn kho nếu dòng này vẫn chưa thu.")) return;

    setDeletingId(issueId);
    setError(null);

    const response = await fetch(`/api/book-issues/${issueId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setDeletingId(null);

    if (!response.ok) {
      setError(data.error ?? "Không thể hoàn tác dòng sách này.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Hoàn tác sách chưa thu</h2>
          <p className="mt-1 text-sm text-ink-muted48">Chỉ cho xóa những dòng phát sinh còn ở trạng thái chưa thu để tránh lệch công nợ và thu tiền.</p>
        </div>
        <span className="badge bg-slate-100 text-slate-700">{issues.length} dòng</span>
      </div>

      <div className="mt-4 space-y-3">
        {issues.map((issue) => (
          <div key={issue.id} className="rounded-2xl border border-hairline bg-canvas-parchment/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{issue.bookName}</p>
                <p className="mt-1 text-xs text-ink-muted48">
                  {issue.className ?? "Chưa gắn lớp"} · SL {issue.quantity} · {formatDate(issue.issueDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink">{formatVnd(issue.amount)}</p>
                <p className="mt-1 text-xs text-rose-600">Chưa thu</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => removeIssue(issue.id)}
                disabled={deletingId === issue.id}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {deletingId === issue.id ? "Đang xóa..." : "Xóa dòng này"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {error ? <div className="alert-danger mt-4">{error}</div> : null}
    </div>
  );
}
