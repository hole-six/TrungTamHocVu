"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";

type StudentHit = { id: string; fullName: string; studentCode: string };
type EnrollmentOption = { id: string; className: string };

export default function AddPaidCatchupForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [enrollmentId, setEnrollmentId] = useState("");
  const [count, setCount] = useState("1");
  const [isFree, setIsFree] = useState(false);
  const [unitPrice, setUnitPrice] = useState(0);
  const [searching, setSearching] = useState(false);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setQ("");
    setResults([]);
    setSelected(null);
    setEnrollments([]);
    setEnrollmentId("");
    setCount("1");
    setIsFree(false);
    setUnitPrice(0);
    setError(null);
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    setSelected(null);
    const response = await fetch(`/api/students?q=${encodeURIComponent(q)}&status=ACTIVE&pageSize=10`);
    const result = await response.json().catch(() => ({}));
    setSearching(false);
    setResults(result.items ?? []);
  }

  async function pickStudent(student: StudentHit) {
    setSelected(student);
    setResults([]);
    setEnrollmentId("");
    setLoadingEnrollments(true);
    const response = await fetch(`/api/students/${student.id}`);
    const data = await response.json().catch(() => ({}));
    setLoadingEnrollments(false);
    const active: EnrollmentOption[] = (data.enrollments ?? [])
      .filter((item: { status: string }) => item.status === "ACTIVE")
      .map((item: { id: string; class: { className: string } }) => ({ id: item.id, className: item.class.className }));
    setEnrollments(active);
    if (active.length === 1) setEnrollmentId(active[0].id);
  }

  async function submit() {
    if (!selected) return;
    if (!enrollmentId) {
      setError("Cần chọn lớp để gắn bổ trợ.");
      return;
    }
    if (!isFree && unitPrice <= 0) {
      setError("Cần nhập giá cụ thể, hoặc tick Miễn phí.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/students/${selected.id}/session-credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId, count: Number(count), isFree, unitPrice }),
    });
    const data = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok) {
      setError(data.error ?? "Không thể thêm bổ trợ đầu khóa.");
      return;
    }
    setSuccess(`Đã thêm ${count} buổi bổ trợ đầu khóa cho ${selected.fullName}.`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="rounded-xl border border-[#dbe3ef] bg-white px-4 py-2 text-sm font-bold text-[#0f1729] hover:border-[#3b82f6]"
      >
        Thêm bổ trợ đầu khóa
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm bổ trợ đầu khóa"
        description="Dùng khi học viên đã ghi danh sẵn đến đăng ký thêm buổi bổ trợ đầu khóa — có thể miễn phí hoặc tính phí."
      >
        <div className="space-y-5">
          {!selected ? (
            <>
              <form onSubmit={search} className="flex gap-2">
                <input
                  className="input"
                  placeholder="Tìm theo tên hoặc mã học viên..."
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
                <button type="submit" disabled={searching} className="btn-primary shrink-0">
                  {searching ? "Đang tìm..." : "Tìm"}
                </button>
              </form>
              {results.length > 0 ? (
                <div className="space-y-2">
                  {results.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => pickStudent(student)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#e5eaf7] bg-white px-4 py-3 text-left hover:border-[#3b82f6]"
                    >
                      <span className="font-bold text-[#0f1729]">{student.fullName}</span>
                      <span className="text-xs text-[#64748b]">{student.studentCode}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3">
                <div>
                  <p className="font-bold text-[#0f1729]">{selected.fullName}</p>
                  <p className="text-xs text-[#64748b]">{selected.studentCode}</p>
                </div>
                <button type="button" onClick={reset} className="text-xs font-bold text-[#1d4ed8] hover:underline">
                  Đổi học viên
                </button>
              </div>

              <label className="space-y-2 block">
                <span className="label-sm">Lớp gắn bổ trợ</span>
                {loadingEnrollments ? (
                  <p className="text-sm text-[#64748b]">Đang tải danh sách lớp...</p>
                ) : enrollments.length === 0 ? (
                  <p className="text-sm text-red-600">Học viên chưa có ghi danh đang hoạt động.</p>
                ) : (
                  <select className="input" value={enrollmentId} onChange={(event) => setEnrollmentId(event.target.value)}>
                    {enrollments.length > 1 ? <option value="">Chọn lớp</option> : null}
                    {enrollments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.className}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="label-sm">Số buổi bổ trợ</span>
                  <input type="number" min="1" className="input" value={count} onChange={(event) => setCount(event.target.value)} />
                </label>

                <label className="flex items-end gap-2 pb-3.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#c8d5ec] text-primary"
                    checked={isFree}
                    onChange={(event) => setIsFree(event.target.checked)}
                  />
                  <span className="text-sm font-semibold text-ink">Miễn phí</span>
                </label>
              </div>

              {!isFree ? (
                <label className="space-y-2 block">
                  <span className="label-sm">Giá mỗi buổi</span>
                  <CurrencyInput value={unitPrice} onChange={setUnitPrice} />
                  {unitPrice > 0 ? <p className="text-xs text-ink-muted48">Tổng: {formatVnd(unitPrice * (Number(count) || 0))}</p> : null}
                </label>
              ) : null}

              {error ? <div className="alert-danger">{error}</div> : null}
              {success ? <div className="alert-success">{success}</div> : null}

              <div className="flex gap-3 border-t border-hairline pt-4">
                <button type="button" onClick={submit} disabled={submitting} className="btn-primary">
                  {submitting ? "Đang lưu..." : "Thêm bổ trợ đầu khóa"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                  Đóng
                </button>
              </div>
            </>
          )}
        </div>
      </ResponsiveDrawer>
    </>
  );
}
