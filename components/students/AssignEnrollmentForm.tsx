"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import { formatVnd as formatVndBase } from "@/lib/export-utils";

type AssignEnrollmentFormProps = {
  student: {
    id: string;
    fullName: string;
    studentCode: string;
    currentClassName?: string | null;
    sessionCreditCount?: number;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerLabel?: string;
};

type ClassHit = {
  id: string;
  classCode: string;
  className: string;
  isRemedial?: boolean;
  totalSessions?: number | null;
  tuitionPerSession?: number | null;
  course?: { name: string } | null;
  _count?: {
    enrollments: number;
    sessions: number;
  };
};

function formatVnd(value: number | null | undefined) {
  return !value ? "Chưa cài đặt" : formatVndBase(value);
}

const GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng",
    items: [
      "Dùng khi cần gán nhanh học viên vào một lớp đang mở.",
      "Phù hợp khi CSO đã chốt lớp với phụ huynh.",
      "Lớp bổ trợ chỉ gán khi học viên còn buổi bổ trợ và có nhu cầu học.",
    ],
    tone: "info" as const,
  },
  {
    title: "Chọn lớp đúng",
    items: [
      "Xem mã lớp, tên lớp, khóa học và số buổi trước khi gán.",
      "Lớp thường kéo theo học phí, lớp bổ trợ không thu riêng như lớp chính.",
      "Nếu học viên đã có lớp, cần biết đang học thêm hay chuyển lớp.",
    ],
    tone: "success" as const,
  },
  {
    title: "Dễ sai",
    items: [
      "Không gán lớp bổ trợ nếu học viên không còn buổi bổ trợ.",
      "Không chỉ nhìn tên lớp, vì nhiều lớp có tên gần giống nhau.",
      "Nếu học viên đang học lớp khác, cần xác định học song song hay chuyển lớp.",
    ],
    tone: "warning" as const,
  },
];

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

      <ResponsiveDrawer 
        open={open}
        onClose={() => setOpen(false)}
        widthClassName="max-w-3xl"
        title="Gán học viên vào lớp"
        description="Chọn đúng lớp đang mở để ghi danh cho học viên."
        guide={<FormGuide title="Hướng dẫn gán lớp" summary="Chọn đúng lớp thường hoặc lớp bổ trợ theo tình trạng hiện tại của học viên." sections={GUIDE_SECTIONS} position="inline" buttonLabel="Guide" />}
      >
        <div className="space-y-5">
          <div className="rounded-[18px] border border-sky-100 bg-sky-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Học viên</p>
            <p className="mt-2 text-lg font-semibold text-ink">{student.fullName}</p>
            <p className="mt-1 text-sm text-ink-muted80">
              {student.studentCode}
              {student.currentClassName ? ` · Đang học: ${student.currentClassName}` : " · Chưa có lớp hiện tại"}
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
            <input className="input flex-1" placeholder="Tìm theo mã lớp, tên lớp, tên khóa học..." value={q} onChange={(event) => setQ(event.target.value)} />
            <button type="submit" className="btn-ghost whitespace-nowrap" disabled={loadingList}>
              {loadingList ? "Đang tìm..." : "Tìm lớp"}
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
                    className={`w-full rounded-3xl border p-4 text-left transition ${isSelected ? "border-primary bg-primary/5 shadow-[0_16px_32px_rgba(17,139,222,0.12)]" : "border-hairline bg-white hover:border-primary/40 hover:bg-canvas"}`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-primary">{item.classCode}</p>
                          {item.isRemedial ? <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">Lớp bổ trợ</span> : null}
                        </div>
                        <p className="text-base font-semibold text-ink">{item.className}</p>
                        <p className="text-sm text-ink-muted80">{item.isRemedial ? "Không thu học phí riêng" : item.course?.name ?? "Không gắn khóa học"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm text-ink-muted80 lg:min-w-[280px]">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted48">{item.isRemedial ? "Điều kiện" : "Học phí / buổi"}</p>
                          <p className="mt-1 font-semibold text-ink">{item.isRemedial ? "Phải có buổi bổ trợ khả dụng" : formatVnd(item.tuitionPerSession)}</p>
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
              {selected.isRemedial ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-emerald-800">Lớp bổ trợ không thu học phí riêng.</p>
                  <p className="text-sm font-semibold text-emerald-900">Còn {student.sessionCreditCount ?? 0} buổi bổ trợ khả dụng.</p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-emerald-800">Học phí {formatVnd(selected.tuitionPerSession)} / buổi · Tổng {selected.totalSessions ?? "chưa đặt"} buổi</p>
              )}
            </div>
          ) : null}

          {error ? <div className="alert-danger">{error}</div> : null}
          {success ? <div className="alert-success">{success}</div> : null}

          <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row">
            <button type="button" onClick={handleAssign} disabled={!selected || submitting || Boolean(selected?.isRemedial && (student.sessionCreditCount ?? 0) <= 0)} className="btn-primary">
              {submitting ? "Đang ghi danh..." : "Xác nhận gán nhập học"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </ResponsiveDrawer>
    </>
  );
}
