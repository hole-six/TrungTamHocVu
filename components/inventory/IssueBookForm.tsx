"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";
import FormGuide from "@/components/ui/FormGuide";

type StudentHit = { id: string; fullName: string; studentCode: string };

const ISSUE_BOOK_GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng form xuất sách?",
    items: [
      "Dùng khi trung tâm thực sự giao sách/giáo trình cho một học viên.",
      "Đây là thao tác xuất kho nên sau khi lưu, tồn kho sẽ giảm ngay.",
      "Chỉ nên bấm khi đã xác nhận đúng học viên và đúng số lượng giao thực tế.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác đúng",
    items: [
      "Tìm đúng học viên theo tên hoặc mã học viên.",
      "Chọn đúng số lượng giao, nhất là khi giao nhiều cuốn trong một lần.",
      "Sau khi lưu, hệ thống sẽ dùng dữ liệu này để đối chiếu tồn kho và khoản sách liên quan của học viên.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ gặp",
    items: [
      "Xuất nhầm cho học viên trùng tên mà không nhìn mã học viên.",
      "Xuất sai số lượng làm lệch tồn kho.",
      "Bấm xuất trước khi giao sách thật sẽ làm kho và thực tế bị lệch nhau.",
    ],
    tone: "warning" as const,
  },
];

export default function IssueBookForm({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    const data = await res.json().catch(() => ({}));
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
    const data = await res.json().catch(() => ({}));
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
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        Xuất cho học viên
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Xuất giáo trình"
        description="Tìm đúng học viên, chọn số lượng rồi ghi nhận xuất kho."
        guide={<FormGuide title="Hướng dẫn xuất giáo trình" summary="Đây là bước xuất kho cho học viên. Người vận hành chỉ cần nhớ: đúng học viên, đúng số lượng, đúng thời điểm đã giao thực tế." sections={ISSUE_BOOK_GUIDE_SECTIONS} position="inline" />}
      >
        <div className="space-y-4">
          <form onSubmit={search} className="flex gap-2">
            <input className="input" placeholder="Tìm học viên..." value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" className="btn-ghost whitespace-nowrap" disabled={searching}>
              {searching ? "Đang tìm..." : "Tìm"}
            </button>
          </form>

          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${selected?.id === s.id ? "border-primary bg-primary/5" : "border-hairline hover:bg-canvas-parchment"}`}
                >
                  {s.fullName} <span className="text-ink-muted48">({s.studentCode})</span>
                </button>
              ))}
            </div>
          ) : null}

          {selected ? (
            <div className="flex items-center gap-2">
              <input type="number" min="1" className="input w-24" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <button type="button" onClick={issue} disabled={loading} className="btn-primary flex-1">
                {loading ? "Đang xuất..." : `Xuất cho ${selected.fullName}`}
              </button>
            </div>
          ) : null}

          {warning ? <p className="text-sm text-amber-600">{warning}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </SlideOver>
    </>
  );
}
