"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FormGuide from "@/components/ui/FormGuide";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type RosterRow = {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  studentCode: string;
  status: string;
};

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Có mặt", tone: "bg-emerald-500 text-white border-emerald-500" },
  { value: "ABSENT", label: "Vắng", tone: "bg-rose-500 text-white border-rose-500" },
];

function statusSummary(status: string) {
  switch (status) {
    case "PRESENT":
      return "Có mặt";
    case "ABSENT":
      return "Vắng";
    default:
      return "";
  }
}

const ATTENDANCE_FORM_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu form này",
    items: [
      "Đây là nơi chốt trạng thái có mặt hoặc vắng cho từng học viên trong buổi học hiện tại.",
      "Danh sách có tìm kiếm, lọc và phân trang để giáo viên không bị ngợp khi lớp đông.",
      "Kết quả ở đây ảnh hưởng tới cảnh báo chăm sóc và các luồng bổ trợ phát sinh sau đó.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác nhanh",
    items: [
      "Lọc theo trạng thái hoặc tìm theo tên/mã học viên để chấm nhanh hơn.",
      "Mỗi dòng chỉ cần chọn Có mặt hoặc Vắng rồi bấm lưu điểm danh ở cuối form.",
      "Nếu học viên đã nghỉ hẳn, dùng thao tác rút lớp ngay tại đây để khỏi điểm danh lại ở các buổi sau.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Rút lớp tại màn hình này sẽ cộng các buổi chưa học còn lại thành buổi bổ trợ cho học viên.",
      "Điểm danh chưa lưu chỉ là trạng thái trong form, chưa ghi thật vào hệ thống.",
      "Nếu lớp đông, nên chấm theo từng trang rồi mới lưu để tránh sót học viên.",
    ],
    tone: "warning" as const,
  },
];

export default function AttendanceForm({ sessionId, initialRoster }: { sessionId: string; initialRoster: RosterRow[] }) {
  const router = useRouter();
  const [roster, setRoster] = useState(initialRoster);
  const [loading, setLoading] = useState(false);
  const [withdrawingEnrollmentId, setWithdrawingEnrollmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | string>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const statusStats = useMemo(
    () => ({
      ALL: roster.length,
      PRESENT: roster.filter((row) => row.status === "PRESENT").length,
      ABSENT: roster.filter((row) => row.status === "ABSENT").length,
    }),
    [roster]
  );

  const filteredRoster = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return roster.filter((row) => {
      const matchesStatus = statusFilter === "ALL" ? true : row.status === statusFilter;
      const matchesKeyword = normalizedKeyword
        ? [row.fullName, row.studentCode].some((value) => value.toLowerCase().includes(normalizedKeyword))
        : true;

      return matchesStatus && matchesKeyword;
    });
  }, [keyword, roster, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRoster.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRoster = filteredRoster.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function setStudentStatus(studentId: string, status: string) {
    setRoster((current) => current.map((row) => (row.studentId === studentId ? { ...row, status } : row)));
    setSaved(false);
  }

  async function withdrawStudent(row: RosterRow) {
    setWithdrawingEnrollmentId(row.enrollmentId);
    setError(null);

    try {
      const response = await fetch(`/api/enrollments/${row.enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "WITHDRAWN",
          reason: "Rút lớp trực tiếp từ màn điểm danh",
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Không thể rút lớp học viên này.");
        return;
      }

      setRoster((current) => current.filter((item) => item.enrollmentId !== row.enrollmentId));
      setSaved(false);
      router.refresh();

      const granted = Number(data.sessionCreditsGranted ?? 0);
      window.alert(
        granted > 0 ? `Đã rút lớp ${row.fullName} và cộng ${granted} buổi bổ trợ còn lại.` : `Đã rút lớp ${row.fullName}.`
      );
    } finally {
      setWithdrawingEnrollmentId(null);
    }
  }

  async function save() {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/sessions/${sessionId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records: roster.map((row) => ({ studentId: row.studentId, status: row.status })),
      }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Không thể lưu điểm danh.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  if (roster.length === 0) {
    return <p className="text-sm text-ink-muted48">Lớp chưa có học viên đang học để điểm danh.</p>;
  }

  return (
    <div className="space-y-4">
      <FormGuide
        title="Guide điểm danh"
        summary="Giải thích cách chấm có mặt/vắng, lọc danh sách và rút lớp ngay trong buổi học."
        sections={ATTENDANCE_FORM_GUIDE_SECTIONS}
        position="inline"
        buttonLabel="Guide điểm danh"
      />
      <div className="space-y-4 rounded-[28px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted48"
            >
              <path
                d="M14.166 14.167 17.5 17.5M16.667 9.167a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm học viên hoặc mã học viên..."
              className="h-12 w-full rounded-full border border-[#dbe7ff] bg-white pl-11 pr-4 text-sm font-medium text-ink outline-none transition placeholder:text-ink-muted48 focus:border-primary/50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { value: "ALL", label: "Tất cả", count: statusStats.ALL },
              { value: "PRESENT", label: "Có mặt", count: statusStats.PRESENT },
              { value: "ABSENT", label: "Vắng", count: statusStats.ABSENT },
            ].map((option) => {
              const active = statusFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-primary bg-primary text-white shadow-sm"
                      : "border-[#dbe7ff] bg-white text-ink hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  <span>{option.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20 text-white" : "bg-[#eef6ff] text-primary"}`}>
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted48">Tổng học viên</p>
            <p className="mt-2 text-xl font-semibold text-ink">{statusStats.ALL}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted48">Đang lọc</p>
            <p className="mt-2 text-xl font-semibold text-ink">{filteredRoster.length}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted48">Trang hiện tại</p>
            <p className="mt-2 text-xl font-semibold text-ink">
              {currentPage}/{totalPages}
            </p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted48">Đã chốt trong form</p>
            <p className="mt-2 text-xl font-semibold text-emerald-600">{saved ? "Xong" : "Chưa lưu"}</p>
          </div>
        </div>

        <p className="text-sm text-ink-muted80">
          Đang xem <strong className="text-ink">{filteredRoster.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong>-
          <strong className="text-ink">{Math.min(currentPage * pageSize, filteredRoster.length)}</strong> /{" "}
          <strong className="text-ink">{filteredRoster.length}</strong> học viên theo bộ lọc hiện tại
        </p>
        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trước
            </button>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink">
              Trang {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage === totalPages}
              className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        ) : null}
      </div>

      {filteredRoster.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[#dbe7ff] bg-white px-5 py-10 text-center">
          <p className="text-base font-semibold text-ink">Không có học viên khớp bộ lọc này</p>
          <p className="mt-2 text-sm text-ink-muted48">Đổi trạng thái lọc hoặc xóa từ khóa tìm kiếm để xem lại toàn bộ danh sách.</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {pagedRoster.map((row, index) => (
          <div key={row.studentId} className="rounded-[28px] border border-hairline bg-white/90 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef6ff] text-xs font-bold text-primary">
                    {(currentPage - 1) * pageSize + index + 1}
                  </span>
                  <div>
                    <p className="text-base font-semibold text-ink">{row.fullName}</p>
                    <p className="text-xs text-ink-muted48">{row.studentCode}</p>
                  </div>
                </div>
                {statusSummary(row.status) ? <p className="text-sm text-ink-muted80">{statusSummary(row.status)}</p> : null}
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-[720px] lg:justify-end">
                {STATUS_OPTIONS.map((option) => {
                  const active = row.status === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStudentStatus(row.studentId, option.value)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        active ? option.tone : "border-[#d9e8f8] bg-white text-ink-muted80 hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <ConfirmActionButton
                  title={`Rút ${row.fullName} khỏi lớp?`}
                  description="Hệ thống sẽ dừng điểm danh học viên này trong lớp và cộng toàn bộ buổi chưa học còn lại thành buổi bổ trợ."
                  confirmLabel="Xác nhận rút lớp"
                  cancelLabel="Quay lại"
                  tone="danger"
                  onConfirm={() => withdrawStudent(row)}
                  disabled={withdrawingEnrollmentId === row.enrollmentId}
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {withdrawingEnrollmentId === row.enrollmentId ? "Đang rút lớp..." : "Đã rút lớp"}
                </ConfirmActionButton>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-primary">Đã lưu điểm danh và đánh dấu hoàn thành buổi học.</p> : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
        <button type="button" onClick={save} disabled={loading} className="btn-primary">
          {loading ? "Đang lưu..." : "Lưu điểm danh & đánh dấu hoàn thành"}
        </button>
      </div>
    </div>
  );
}
