"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";

type StudentHit = { id: string; fullName: string; studentCode: string };
type EnrollmentOption = { id: string; className: string };

// Dùng theo 2 cách: (1) nút tự thân mở drawer rồi tự tìm học viên (trang Bổ trợ), hoặc
// (2) điều khiển từ ngoài — truyền sẵn `initialStudent` + `onClose` để mở thẳng vào
// đúng học viên đó, bỏ qua bước tìm kiếm (dùng ở nút "Thêm bổ trợ" trên trang Học viên).
export default function AddPaidCatchupForm({
  initialStudent,
  onClose: externalOnClose,
}: {
  initialStudent?: StudentHit | null;
  onClose?: () => void;
} = {}) {
  const router = useRouter();
  const controlled = Boolean(initialStudent);
  const [open, setOpen] = useState(controlled);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [enrollmentId, setEnrollmentId] = useState("");
  const [count, setCount] = useState("1");
  const [isFree, setIsFree] = useState(false);
  const [unitPrice, setUnitPrice] = useState(0);
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

  // Luôn hiện sẵn 1 danh sách học viên duyệt được (không bắt buộc gõ tìm trước mới
  // thấy ai) — gõ vào ô tìm sẽ lọc lại danh sách này theo tên/mã, debounce 300ms.
  useEffect(() => {
    if (!open || selected) return;
    let cancelled = false;
    setLoadingResults(true);
    const timer = setTimeout(async () => {
      const trimmed = q.trim();
      const response = await fetch(`/api/students?q=${encodeURIComponent(trimmed)}&status=ACTIVE&pageSize=30`);
      const result = await response.json().catch(() => ({}));
      if (!cancelled) {
        const items: StudentHit[] = result.items ?? [];
        // Không gõ gì (duyệt cả danh sách) thì xếp theo tên cho dễ tìm bằng mắt — API
        // trả về theo createdAt desc, không hợp để DUYỆT (mới tạo lên đầu).
        setResults(trimmed ? items : [...items].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi")));
        setLoadingResults(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, q, selected]);

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

  useEffect(() => {
    if (initialStudent) void pickStudent(initialStudent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStudent?.id]);

  function closeDrawer() {
    if (controlled) {
      externalOnClose?.();
    } else {
      setOpen(false);
    }
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
    const chargeNote = !isFree
      ? data.chargeUpdated
        ? " Đã cộng vào công nợ học phí hiện tại."
        : data.warning
          ? ` ${data.warning}`
          : ""
      : "";
    setSuccess(`Đã thêm ${count} buổi bổ trợ đầu khóa cho ${selected.fullName}.${chargeNote}`);
    router.refresh();
  }

  return (
    <>
      {!controlled ? (
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
      ) : null}

      <ResponsiveDrawer
        open={open}
        onClose={closeDrawer}
        title="Thêm bổ trợ đầu khóa"
        description="Dùng khi học viên đã ghi danh sẵn đến đăng ký thêm buổi bổ trợ đầu khóa — có thể miễn phí hoặc tính phí."
      >
        <div className="space-y-5">
          {!selected ? (
            <>
              <input
                className="input"
                placeholder="Tìm theo tên hoặc mã học viên... (để trống để xem cả danh sách)"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                autoFocus
              />
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {loadingResults ? (
                  <p className="text-sm text-[#64748b]">Đang tải...</p>
                ) : results.length === 0 ? (
                  <p className="text-sm text-[#64748b]">Không tìm thấy học viên phù hợp.</p>
                ) : (
                  results.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => pickStudent(student)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#e5eaf7] bg-white px-4 py-3 text-left hover:border-[#3b82f6]"
                    >
                      <span className="font-bold text-[#0f1729]">{student.fullName}</span>
                      <span className="text-xs text-[#64748b]">{student.studentCode}</span>
                    </button>
                  ))
                )}
              </div>
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
                <button type="button" onClick={closeDrawer} className="btn-ghost">
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
