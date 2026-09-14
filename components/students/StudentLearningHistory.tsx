"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// LỊCH SỬ HỌC TẬP — thay cho khối "Buổi học gần đây" (chỉ 8 buổi, không có điểm).
// Mục tiêu: nhìn vào là thấy con tiến bộ tới đâu — điểm từng buổi nối tiếp nhau, điểm
// trung bình, và điểm đó CỘNG TỪ những cột nào. Cách tính: lib/server/learning-history.ts.
// Dùng chung cho trang hồ sơ học viên và drawer học viên.

type Score = { label: string; score: number; maxScore: number; outOfTen: number; invalid: boolean };
type Item = {
  sessionId: string;
  classId: string;
  className: string;
  sessionDate: string;
  sessionNumber: number | null;
  attendanceStatus: string | null;
  lessonTitle: string | null;
  journalStatus: "PUBLISHED" | "DRAFT" | "NONE";
  comment: string | null;
  homeworkStatus: string | null;
  scores: Score[];
  sessionScore: number | null;
  deltaFromPrevious: number | null;
};
type History = {
  summary: {
    totalSessions: number;
    scoredSessions: number;
    averageScore: number | null;
    byLabel: { label: string; average: number; count: number }[];
    firstScore: number | null;
    latestScore: number | null;
  };
  progression: { sessionDate: string; className: string; score: number }[];
  items: Item[];
  page: number;
  pageSize: number;
  totalPages: number;
};

const ATTENDANCE: Record<string, { label: string; className: string }> = {
  PRESENT: { label: "Có mặt", className: "bg-[#dcfce7] text-[#166534]" },
  ABSENT: { label: "Vắng", className: "bg-[#fee2e2] text-[#991b1b]" },
  MAKEUP: { label: "Học bù", className: "bg-[#e0f2fe] text-[#075985]" },
  LATE: { label: "Đi muộn", className: "bg-[#fef3c7] text-[#92400e]" },
};

const fmt = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function scoreTone(score: number) {
  if (score >= 8) return "text-[#166534]";
  if (score >= 6.5) return "text-[#0f1729]";
  if (score >= 5) return "text-[#b45309]";
  return "text-[#b91c1c]";
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[#cbd5e1]">—</span>;
  if (value === 0) return <span className="text-xs font-semibold text-[#64748b]">= 0</span>;
  const up = value > 0;
  return (
    <span className={`text-xs font-bold ${up ? "text-[#166534]" : "text-[#b91c1c]"}`}>
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {fmt(value)}
    </span>
  );
}

export default function StudentLearningHistory({ studentId, compact = false }: { studentId: string; compact?: boolean }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormula, setShowFormula] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/students/${studentId}/learning-history?page=${page}`)
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? "Không tải được lịch sử học tập.");
        return json as History;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, page]);

  if (error) return <div className="alert-danger">{error}</div>;
  if (!data) return <p className="text-sm text-[#94a3b8]">Đang tải lịch sử học tập...</p>;

  const { summary } = data;
  if (summary.totalSessions === 0) {
    return <p className="text-sm text-[#94a3b8]">Chưa có buổi học nào được điểm danh hoặc ghi nhật ký.</p>;
  }

  const trend =
    summary.firstScore !== null && summary.latestScore !== null && summary.scoredSessions >= 2
      ? Math.round((summary.latestScore - summary.firstScore) * 10) / 10
      : null;
  // Dãy điểm liên tục — tối đa 12 buổi có điểm gần nhất, đọc từ trái sang phải theo thời gian.
  const recentProgression = data.progression.slice(-12);

  return (
    <div className="space-y-4">
      {/* Tổng quan điểm */}
      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
        <div className="rounded-xl border border-[#e5eaf7] bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Điểm trung bình</p>
          <p className={`mt-1 text-2xl font-black ${summary.averageScore !== null ? scoreTone(summary.averageScore) : "text-[#94a3b8]"}`}>
            {summary.averageScore !== null ? `${fmt(summary.averageScore)}/10` : "—"}
          </p>
          <p className="text-xs text-[#64748b]">từ {summary.scoredSessions} buổi có điểm</p>
        </div>
        <div className="rounded-xl border border-[#e5eaf7] bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Tiến bộ</p>
          <p className="mt-1 text-2xl font-black text-[#0f1729]">{trend !== null ? <Delta value={trend} /> : "—"}</p>
          <p className="text-xs text-[#64748b]">
            {trend !== null ? `buổi đầu ${fmt(summary.firstScore as number)} → gần nhất ${fmt(summary.latestScore as number)}` : "cần ít nhất 2 buổi có điểm"}
          </p>
        </div>
        <div className="rounded-xl border border-[#e5eaf7] bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Đã học</p>
          <p className="mt-1 text-2xl font-black text-[#0f1729]">{summary.totalSessions}</p>
          <p className="text-xs text-[#64748b]">buổi có điểm danh / nhật ký</p>
        </div>
        <div className="rounded-xl border border-[#e5eaf7] bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Theo từng cột điểm</p>
          <div className="mt-1 space-y-0.5">
            {summary.byLabel.length === 0 ? <p className="text-sm text-[#94a3b8]">Chưa có</p> : null}
            {summary.byLabel.slice(0, 4).map((item) => (
              <p key={item.label} className="flex justify-between gap-2 text-xs">
                <span className="truncate text-[#64748b]">{item.label}</span>
                <span className={`font-bold ${scoreTone(item.average)}`}>
                  {fmt(item.average)} <span className="font-normal text-[#94a3b8]">({item.count})</span>
                </span>
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Dãy điểm liên tục qua các buổi */}
      {recentProgression.length > 0 ? (
        <div className="rounded-xl border border-[#e5eaf7] bg-[#fbfdff] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">
            Điểm qua {recentProgression.length} buổi có điểm gần nhất (cũ → mới)
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2">
            {recentProgression.map((item, index) => {
              const previous = recentProgression[index - 1];
              const delta = previous ? Math.round((item.score - previous.score) * 10) / 10 : null;
              return (
                <span key={`${item.sessionDate}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? (
                    <span className={`text-xs ${delta !== null && delta > 0 ? "text-[#16a34a]" : delta !== null && delta < 0 ? "text-[#dc2626]" : "text-[#94a3b8]"}`}>→</span>
                  ) : null}
                  <span className="rounded-lg border border-[#e5eaf7] bg-white px-2 py-1 text-center" title={`${fmtDate(item.sessionDate)} · ${item.className}`}>
                    <span className={`block text-sm font-black ${scoreTone(item.score)}`}>{fmt(item.score)}</span>
                    <span className="block text-[10px] text-[#94a3b8]">{fmtDate(item.sessionDate).slice(0, 5)}</span>
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <button type="button" onClick={() => setShowFormula((current) => !current)} className="text-xs font-semibold text-[#2563eb] hover:underline">
          {showFormula ? "Ẩn cách tính điểm" : "Điểm được tính từ đâu?"}
        </button>
        {showFormula ? (
          <div className="mt-2 space-y-1 rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-xs leading-5 text-[#334155]">
            <p>
              <strong>Điểm mỗi buổi</strong> = trung bình các cột điểm giáo viên nhập trong <strong>nhật ký lớp</strong> của buổi đó
              (Vấn đáp, Minitest từ, Nghe...). Mỗi cột quy về thang 10 trước khi cộng — ví dụ 7/8 tính là 8,75.
            </p>
            <p>
              <strong>Điểm trung bình</strong> = trung bình điểm các buổi có điểm. Mỗi buổi nặng như nhau.
            </p>
            <p>Buổi vắng hoặc buổi chưa nhập điểm <strong>không tính là 0</strong> — chỉ bỏ qua, không kéo điểm trung bình xuống.</p>
            <p>Điểm nhập sai (vượt thang điểm, ví dụ 123/10) hiện <span className="text-[#991b1b] line-through">gạch ngang</span> và không được tính.</p>
          </div>
        ) : null}
      </div>

      {/* Bảng lịch sử — 10 buổi mỗi trang, mới nhất trước */}
      <div className="overflow-x-auto rounded-xl border border-[#e5eaf7] bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[#e5eaf7] bg-[#f8faff] text-left text-xs font-bold uppercase tracking-wide text-[#64748b]">
              <th className="px-3 py-2">Buổi</th>
              <th className="px-3 py-2">Điểm danh</th>
              <th className="px-3 py-2">Các cột điểm</th>
              <th className="px-3 py-2 text-center">Điểm buổi</th>
              <th className="px-3 py-2 text-center">So với buổi trước</th>
            </tr>
          </thead>
          <tbody className={loading ? "opacity-50" : ""}>
            {data.items.map((item) => {
              const attendance = item.attendanceStatus ? ATTENDANCE[item.attendanceStatus] : null;
              return (
                <tr key={item.sessionId} className="border-b border-[#f1f5f9] align-top last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/classes/${item.classId}/sessions/${item.sessionId}`} className="font-bold text-[#0f1729] hover:text-[#2563eb]">
                      {fmtDate(item.sessionDate)}
                      {item.sessionNumber ? ` · Buổi ${item.sessionNumber}` : ""}
                    </Link>
                    <p className="text-xs text-[#64748b]">
                      {item.className}
                      {item.lessonTitle && item.lessonTitle !== `Buổi ${item.sessionNumber}` ? ` · ${item.lessonTitle}` : ""}
                    </p>
                    {item.comment && !compact ? <p className="mt-1 text-xs italic text-[#475569]">“{item.comment}”</p> : null}
                  </td>
                  <td className="px-3 py-2.5">
                    {attendance ? (
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${attendance.className}`}>{attendance.label}</span>
                    ) : (
                      <span className="text-xs text-[#94a3b8]">Chưa điểm danh</span>
                    )}
                    {item.journalStatus === "DRAFT" && item.scores.length > 0 ? (
                      <p className="mt-1 text-[10px] font-semibold text-[#b45309]">Nhật ký nháp</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    {item.scores.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.scores.map((score, index) => (
                          <span
                            key={`${score.label}-${index}`}
                            className={`rounded-md px-2 py-0.5 text-xs ${score.invalid ? "bg-[#fee2e2] text-[#991b1b] line-through" : "bg-[#f1f5f9] text-[#334155]"}`}
                            title={score.invalid ? `Điểm nhập sai (vượt thang ${score.maxScore}) — không tính vào điểm buổi và điểm trung bình. Sửa lại trong nhật ký buổi học.` : undefined}
                          >
                            {score.label}: <strong>{fmt(score.score)}</strong>
                            {score.maxScore !== 10 || score.invalid ? `/${fmt(score.maxScore)}` : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[#94a3b8]">Chưa có điểm</span>
                    )}
                    {item.scores.some((score) => score.invalid) ? (
                      <p className="mt-1 text-[10px] font-semibold text-[#b91c1c]">
                        Có điểm nhập sai (gạch ngang) — không tính. Mở buổi học để sửa.
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {item.sessionScore !== null ? (
                      <span className={`text-base font-black ${scoreTone(item.sessionScore)}`}>{fmt(item.sessionScore)}</span>
                    ) : (
                      <span className="text-[#cbd5e1]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Delta value={item.deltaFromPrevious} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {summary.averageScore !== null ? (
            <tfoot>
              <tr className="border-t-2 border-[#e5eaf7] bg-[#f8faff]">
                <td className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#64748b]" colSpan={3}>
                  Trung bình toàn bộ {summary.scoredSessions} buổi có điểm
                </td>
                <td className={`px-3 py-2 text-center text-base font-black ${scoreTone(summary.averageScore)}`}>{fmt(summary.averageScore)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="btn-ghost-sm" disabled={data.page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            ← Mới hơn
          </button>
          <span className="text-xs text-[#64748b]">
            Trang {data.page}/{data.totalPages} · {summary.totalSessions} buổi
          </span>
          <button type="button" className="btn-ghost-sm" disabled={data.page >= data.totalPages || loading} onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))}>
            Cũ hơn →
          </button>
        </div>
      ) : null}
    </div>
  );
}
