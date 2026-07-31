"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

type AssignEnrollmentFormProps = {
  student: {
    id: string;
    fullName: string;
    studentCode: string;
    studentDisplayId?: string | null;
    currentClassName?: string | null;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerLabel?: string;
};

type ClassHit = {
  id: string;
  classCode: string;
  className: string;
  totalSessions?: number | null;
  tuitionPerSession?: number | null;
  course?: {
    name: string;
  } | null;
  _count?: {
    enrollments: number;
    sessions: number;
  };
};

function formatVnd(value: number | null | undefined) {
  if (!value) return "Chưa cài đặt";
  return `${value.toLocaleString("vi-VN")}đ`;
}

export default function AssignEnrollmentForm({
  student,
  open: controlledOpen,
  onOpenChange,
  triggerLabel = "Gán nhập học",
}: AssignEnrollmentFormProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClassHit[]>([]);
  const [selected, setSelected] = useState<ClassHit | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const open = controlledOpen ?? internalOpen;

  function setOpen(next: boolean) {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  }

  async function loadClasses(keyword = "") {
    setLoadingList(true);
    setError(null);

    const search = new URLSearchParams({ status: "ACTIVE" });
    if (keyword.trim()) search.set("q", keyword.trim());

    const response = await fetch(`/api/classes?${search.toString()}`);
    const result = await response.json().catch(() => ({}));
    setLoadingList(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể tải danh sách lớp.");
      return;
    }

    setResults(Array.isArray(result.items) ? result.items : []);
  }

  useEffect(() => {
    if (!open) return;

    setSelected(null);
    setSuccess(null);
    void loadClasses(q);
  }, [open]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    await loadClasses(q);
  }

  async function handleAssign() {
    if (!selected) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/classes/${selected.id}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: student.id }),
    });
    const result = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      setError(result.error ?? "Không thể gán nhập học vào lớp đã chọn.");
      return;
    }

    setSuccess(`Đã ghi danh ${student.fullName} vào lớp ${selected.className}.`);
    router.refresh();
  }

  return (
    <>
      {!onOpenChange ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary">
          {triggerLabel}
        </button>
      ) : null}

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        widthClassName="max-w-3xl"
        title="Gán nhập học cho học viên"
        description="Chọn lớp đang mở để ghi danh nhanh cho học viên. Nếu sau này cần đổi lịch học, học bù, chuyển buổi thì xử lý trong chi tiết lớp."
      >
        <div className="space-y-5">
          <div className="rounded-3xl border border-sky-100 bg-sky-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Học viên đang xử lý</p>
            <p className="mt-2 text-lg font-semibold text-ink">{student.fullName}</p>
            <p className="mt-1 text-sm text-ink-muted80">
              {student.studentDisplayId ?? student.studentCode}
              {student.currentClassName ? ` · Đang học: ${student.currentClassName}` : " · Chưa có lớp hiện tại"}
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
            <input
              className="input flex-1"
              placeholder="Tìm theo mã lớp, tên lớp, tên khóa học..."
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
            <button type="submit" className="btn-ghost whitespace-nowrap" disabled={loadingList}>
              {loadingList ? "Đang tìm..." : "Lọc lớp"}
            </button>
          </form>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Danh sách lớp đang mở</p>
              <p className="text-xs text-ink-muted48">{results.length} lớp phù hợp</p>
            </div>

            <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
              {results.map((item) => {
                const isSelected = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(isSelected ? null : item)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-[0_16px_32px_rgba(17,139,222,0.12)]"
                        : "border-hairline bg-white hover:border-primary/40 hover:bg-canvas"
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-primary">{item.classCode}</p>
                        <p className="text-base font-semibold text-ink">{item.className}</p>
                        <p className="text-sm text-ink-muted80">{item.course?.name ?? "Không gắn khóa học"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm text-ink-muted80 lg:min-w-[280px]">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted48">Học phí / buổi</p>
                          <p className="mt-1 font-semibold text-ink">{formatVnd(item.tuitionPerSession)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted48">Tổng số buổi</p>
                          <p className="mt-1 font-semibold text-ink">{item.totalSessions ?? "Chưa đặt"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted48">Học viên đang học</p>
                          <p className="mt-1 font-semibold text-ink">{item._count?.enrollments ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted48">Buổi đã tạo</p>
                          <p className="mt-1 font-semibold text-ink">{item._count?.sessions ?? 0}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!loadingList && results.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-hairline bg-canvas-parchment/30 p-6 text-center">
                  <p className="text-sm font-semibold text-ink">Không có lớp phù hợp</p>
                  <p className="mt-2 text-sm text-ink-muted48">Thử đổi từ khóa tìm kiếm ngắn hơn hoặc bỏ trống để xem toàn bộ lớp đang mở.</p>
                </div>
              ) : null}
            </div>
          </div>

          {selected ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Sẽ ghi danh vào</p>
              <p className="mt-2 text-base font-semibold text-emerald-950">
                [{selected.classCode}] {selected.className}
              </p>
              <p className="mt-1 text-sm text-emerald-800">
                Học phí {formatVnd(selected.tuitionPerSession)} / buổi · Tổng {selected.totalSessions ?? "chưa đặt"} buổi
              </p>
            </div>
          ) : null}

          {error ? <div className="alert-danger">{error}</div> : null}
          {success ? <div className="alert-success">{success}</div> : null}

          <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row">
            <button type="button" onClick={handleAssign} disabled={!selected || submitting} className="btn-primary">
              {submitting ? "Đang ghi danh..." : "Xác nhận gán nhập học"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </SlideOver>
    </>
  );
}
