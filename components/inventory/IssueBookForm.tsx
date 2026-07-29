"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StudentHit = { id: string; fullName: string; studentCode: string };

export default function IssueBookForm({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    const res = await fetch(`/api/students?q=${encodeURIComponent(q)}&status=ACTIVE&pageSize=10`);
    const data = await res.json();
    setSearching(false);
    setResults(data.items ?? []);
  }

  async function issue() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    const res = await fetch(`/api/books/${bookId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selected.id, quantity: Number(quantity) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể xuất sách.");
      return;
    }
    const notices = [data.warning, data.classWarning].filter(Boolean);
    if (notices.length > 0) setWarning(notices.join(" "));
    setSelected(null);
    setResults([]);
    setQ("");
    setQuantity("1");
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold tracking-tight">Xuất cho học viên</h2>
      <form onSubmit={search} className="mt-3 flex gap-2">
        <input className="input" placeholder="Tìm học viên..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn-ghost whitespace-nowrap" disabled={searching}>
          {searching ? "..." : "Tìm"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="mt-3 space-y-1">
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                selected?.id === s.id ? "border-primary bg-primary/5" : "border-hairline hover:bg-canvas-parchment"
              }`}
            >
              {s.fullName} <span className="text-ink-muted48">({s.studentCode})</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-3 flex items-center gap-2">
          <input type="number" min="1" className="input w-20" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <button onClick={issue} disabled={loading} className="btn-primary flex-1">
            {loading ? "Đang xuất..." : `Xuất cho ${selected.fullName}`}
          </button>
        </div>
      )}
      {warning && <p className="mt-2 text-sm text-amber-600">{warning}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
