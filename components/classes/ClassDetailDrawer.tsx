"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatVnd, formatDate } from "@/lib/export-utils";
import GenerateSessionsForm from "./GenerateSessionsForm";
import CompleteClassButton from "./CompleteClassButton";
import ClassEditForm from "./ClassEditForm";
import EnrollStudentForm from "./EnrollStudentForm";
import EnrollmentRowActions from "./EnrollmentRowActions";
import TransferEnrollmentButton from "./TransferEnrollmentButton";
import AddEnrollmentSessionsButton from "./AddEnrollmentSessionsButton";
import RescheduleSessionButton from "./RescheduleSessionButton";
import ScheduleRuleManager from "./ScheduleRuleManager";
import ClassDefaultAssignmentManager from "./ClassDefaultAssignmentManager";
import ClassTaskManager from "./ClassTaskManager";
import ClassRecurringTaskManager from "./ClassRecurringTaskManager";
import RemedialBulkAssignPanel from "./RemedialBulkAssignPanel";

type ClassDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  classId: string;
};

function weekdayLabel(weekday: number) {
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][weekday] ?? String(weekday);
}

function attendanceLabel(status: string) {
  switch (status) {
    case "PRESENT": return "Có mặt";
    case "ABSENT":
    case "MAKEUP": return "Vắng";
    default: return status;
  }
}

function timingLabel(timing: "past" | "today" | "upcoming") {
  if (timing === "past") return "Đã qua";
  if (timing === "today") return "Hôm nay";
  return "Sắp tới";
}

function timingClass(timing: "past" | "today" | "upcoming") {
  if (timing === "past") return "text-[#94a3b8]";
  if (timing === "today") return "text-[#f97316] font-semibold";
  return "text-[#64748b]";
}

function badgeClass(status: string) {
  if (status === "ACTIVE" || status === "COMPLETED" || status === "DONE_ON_TIME") return "bg-[#dcfce7] text-[#166534]";
  if (status === "UNPAID" || status === "OVERDUE" || status === "CANCELLED") return "bg-[#fee2e2] text-[#991b1b]";
  if (status === "PENDING" || status === "PLANNED") return "bg-[#fef9c3] text-[#854d0e]";
  return "bg-[#f1f5f9] text-[#475569]";
}

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang học",
  COMPLETED: "Hoàn tất",
  WITHDRAWN: "Đã rút",
  TRANSFERRED: "Đã chuyển",
};

export default function ClassDetailDrawer({ open, onClose, classId }: ClassDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tongquan" | "buoihoc" | "hocvien" | "cauhinh">("tongquan");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/classes/${classId}/summary`);
        if (!response.ok) throw new Error("Failed to fetch class data");
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [open, classId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const handleViewFullPage = () => {
    onClose();
    window.location.href = `/classes/${classId}`;
  };

  const handleRefresh = () => {
    setLoading(true);
    fetch(`/api/classes/${classId}/summary`)
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Full Screen Drawer */}
      <div className="fixed inset-0 z-[101] flex flex-col overflow-hidden bg-white">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[#e5eaf7] bg-gradient-to-r from-[#f97316] to-[#ea580c] px-4 py-3 shadow-lg sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            {loading || !data ? (
              <div className="flex-1 text-center">
                <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">Đang tải...</h2>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <h2 className="truncate text-center text-lg font-black tracking-tight text-white sm:text-xl">
                  {data.className}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
                  <span className="inline-flex rounded-lg bg-white/20 px-2 py-0.5 font-bold text-white backdrop-blur">
                    {data.classCode}
                  </span>
                  {data.course && (
                    <span className="inline-flex rounded-lg bg-white/20 px-2 py-0.5 font-bold text-white backdrop-blur">
                      {data.course.name}
                    </span>
                  )}
                  {data.isRemedial && (
                    <span className="inline-flex rounded-lg bg-amber-500 px-2 py-0.5 font-bold text-white">
                      Bổ trợ
                    </span>
                  )}
                  {data.totalOutstanding > 0 && (
                    <span className="inline-flex rounded-lg bg-amber-400 px-2 py-0.5 font-bold text-white">
                      Nợ {formatVnd(data.totalOutstanding)}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              {!loading && data && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
                  title="Refresh"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#e5e7eb] border-t-[#f97316]"></div>
                <p className="text-sm text-[#64748b]">Đang tải đầy đủ thông tin lớp học...</p>
              </div>
            </div>
          ) : error || !data ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <p className="text-sm font-semibold text-red-600">{error || "Không thể tải thông tin lớp"}</p>
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="mt-4 rounded-xl border-2 border-[#e5eaf7] bg-white px-6 py-3 text-sm font-semibold text-[#0f1729] shadow-sm hover:border-[#f97316] hover:text-[#f97316]"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <div className="container mx-auto max-w-[1600px] space-y-4 p-4 pb-20 sm:p-5">
              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5eaf7] bg-white p-3 shadow-sm">
                {data.latestSession && (
                  <Link
                    href={`/classes/${data.id}/sessions/${data.latestSession.id}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f97316] to-[#ea580c] px-3 py-2 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="10 8 16 12 10 16" />
                    </svg>
                    <span className="hidden sm:inline">Mở buổi học</span>
                    <span className="sm:hidden">Buổi học</span>
                  </Link>
                )}
                {data.permissions.canManageClass && (
                  <GenerateSessionsForm 
                    classId={data.id} 
                    totalSessions={data.totalSessions} 
                    existingSessionCount={data.projectedSchedule.filter((s: any) => s.session).length}
                  />
                )}
                {data.permissions.canManageClass && data.status === "ACTIVE" && data.activeEnrollments > 0 && (
                  <CompleteClassButton
                    classId={data.id}
                    className={data.className}
                    nextClassName={data.nextClass?.className ?? null}
                    needTransferCount={data.completionStats.needTransferCount}
                    completedCount={data.completionStats.readyCount}
                    transferValueAmount={data.completionStats.transferValueAmount}
                    freeExtraSessions={data.completionStats.freeExtraSessions}
                  />
                )}
                <ClassEditForm
                  cls={{
                    id: data.id,
                    classCode: data.classCode,
                    className: data.className,
                    classGroup: data.classGroup,
                    courseId: data.courseId,
                    tuitionPerSession: data.tuitionPerSession,
                    sessionsPerWeek: data.sessionsPerWeek,
                    totalSessions: data.totalSessions,
                    startDate: data.startDate,
                    expectedEndDate: data.expectedEndDate,
                    nextClassId: data.nextClassId,
                    notes: data.notes,
                    roadmapItems: data.roadmapItems,
                  }}
                  courses={data.courses}
                  classOptions={data.continuationClassOptions}
                  renderSummary={false}
                  triggerLabel="Sửa"
                  triggerClassName="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#e5eaf7] bg-white px-3 py-2 text-sm font-semibold text-[#0f1729] shadow-sm hover:border-[#f97316] hover:text-[#f97316] transition-all"
                />
                <button
                  type="button"
                  onClick={handleViewFullPage}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#e5eaf7] bg-white px-3 py-2 text-sm font-semibold text-[#0f1729] shadow-sm hover:border-[#f97316] hover:text-[#f97316] transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  <span className="hidden sm:inline">Trang đầy đủ</span>
                  <span className="sm:hidden">Full</span>
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3 sm:gap-3 lg:grid-cols-5">
                <div className="rounded-xl border border-[#e5eaf7] bg-white p-3 shadow-sm">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff6ff]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Sĩ số</p>
                  <p className="mt-0.5 text-xl font-black text-[#0f1729]">{data.activeEnrollments}</p>
                  <p className="text-[10px] font-semibold text-[#64748b]">học sinh</p>
                </div>

                <div className="rounded-xl border border-[#e5eaf7] bg-white p-3 shadow-sm">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#ecfdf5]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Đã học</p>
                  <p className="mt-0.5 text-xl font-black text-[#0f1729]">
                    {data.completedSessions}
                    {data.totalSessions ? <span className="text-sm text-[#64748b]"> / {data.totalSessions}</span> : ""}
                  </p>
                  <p className="text-[10px] font-semibold text-[#64748b]">buổi</p>
                </div>

                <div className="rounded-xl border border-[#e5eaf7] bg-white p-3 shadow-sm">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#fef9c3]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Công nợ</p>
                  <p className="mt-0.5 text-xl font-black text-[#0f1729]">{formatVnd(data.totalOutstanding)}</p>
                  <p className="text-[10px] font-semibold text-[#64748b]">{data.overdueEnrollments} HV</p>
                </div>

                <div className="rounded-xl border border-[#e5eaf7] bg-white p-3 shadow-sm">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#fee2e2]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Điểm danh</p>
                  <p className="mt-0.5 text-xl font-black text-[#0f1729]">{data.latestAttendanceStats.present}</p>
                  <p className="text-[10px] font-semibold text-[#64748b]">
                    / {data.latestAttendanceStats.absent} vắng
                  </p>
                </div>

                <div className="rounded-xl border border-[#e5eaf7] bg-white p-3 shadow-sm">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#ffedd5]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Thời gian</p>
                  <p className="mt-0.5 text-sm font-black text-[#0f1729]">{formatDate(data.startDate)}</p>
                  <p className="text-[10px] font-semibold text-[#64748b]">→ {formatDate(data.suggestedEnd)}</p>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#e5eaf7] bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveTab("tongquan")}
                  className={`flex-1 min-w-[100px] rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                    activeTab === "tongquan"
                      ? "bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white shadow-md"
                      : "text-[#64748b] hover:bg-[#f8faff] hover:text-[#f97316]"
                  }`}
                >
                  Tổng quan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("buoihoc")}
                  className={`flex-1 min-w-[100px] rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                    activeTab === "buoihoc"
                      ? "bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white shadow-md"
                      : "text-[#64748b] hover:bg-[#f8faff] hover:text-[#f97316]"
                  }`}
                >
                  Buổi ({data.projectedSchedule.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("hocvien")}
                  className={`flex-1 min-w-[100px] rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                    activeTab === "hocvien"
                      ? "bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white shadow-md"
                      : "text-[#64748b] hover:bg-[#f8faff] hover:text-[#f97316]"
                  }`}
                >
                  HV ({data.enrollments.length})
                </button>
                {data.permissions.canManageClass && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("cauhinh")}
                    className={`flex-1 min-w-[100px] rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                      activeTab === "cauhinh"
                        ? "bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white shadow-md"
                        : "text-[#64748b] hover:bg-[#f8faff] hover:text-[#f97316]"
                    }`}
                  >
                    Cấu hình
                  </button>
                )}
              </div>

              {/* CONTINUE IN PART 2... */}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

              {/* Tab Content: TỔNG QUAN */}
              {activeTab === "tongquan" && (
                <div className="space-y-4">
                  {/* Attention Items */}
                  {data.attentionItems.length > 0 && (
                    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-5 shadow-sm">
                      <h3 className="mb-3 text-base font-black text-[#0f1729]">Cần chú ý</h3>
                      <div className="space-y-2">
                        {data.attentionItems.map((item: any, i: number) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                              item.severity === "critical"
                                ? "border border-red-200 bg-red-50"
                                : item.severity === "warning"
                                  ? "border border-amber-200 bg-amber-50"
                                  : "border border-emerald-200 bg-emerald-50"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                item.severity === "critical"
                                  ? "bg-red-500"
                                  : item.severity === "warning"
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                            />
                            <span className="font-semibold text-[#0f1729]">{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grid 2 columns */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Latest Session */}
                    {data.latestSession && (
                      <div className="rounded-2xl border border-[#e5eaf7] bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <h3 className="text-base font-black text-[#0f1729]">Buổi gần nhất</h3>
                          <Link
                            href={`/classes/${data.id}/sessions/${data.latestSession.id}`}
                            onClick={onClose}
                            className="inline-flex items-center gap-1 text-sm font-bold text-[#f97316] hover:text-[#ea580c]"
                          >
                            Mở
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-[#e5eaf7] bg-[#f8faff] p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Ngày học</p>
                            <p className="mt-1 text-sm font-bold text-[#0f1729]">{formatDate(data.latestSession.sessionDate)}</p>
                            <p className="text-xs text-[#64748b]">
                              {data.latestSession.startTime ?? "—"} - {data.latestSession.endTime ?? "—"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-[#e5eaf7] bg-[#f8faff] p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Điểm danh</p>
                            <p className="mt-1 text-sm font-bold text-[#0f1729]">
                              {data.latestAttendanceStats.present} có mặt
                            </p>
                            <p className="text-xs text-[#64748b]">{data.latestAttendanceStats.absent} vắng</p>
                          </div>
                          <div className="rounded-lg border border-[#e5eaf7] bg-[#f8faff] p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Nhật ký</p>
                            <p className="mt-1 text-sm font-bold text-[#0f1729]">
                              {data.latestSession.journalPublished
                                ? "Đã gửi PH"
                                : data.latestSession.hasJournal
                                  ? "Lưu nháp"
                                  : "Chưa có"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-[#e5eaf7] bg-[#f8faff] p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Giáo viên</p>
                            <p className="mt-1 truncate text-sm font-bold text-[#0f1729]">
                              {data.latestSession.teachers || "Chưa có"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Next Session */}
                    {data.nextSession && (
                      <div className="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-5 shadow-sm">
                        <h3 className="mb-2 text-base font-black text-[#1e40af]">Buổi tới</h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2"
                          >
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <span className="text-sm font-bold text-[#1e40af]">
                            {formatDate(data.nextSession.sessionDate)}
                          </span>
                          <span className="text-sm text-[#1e40af]/80">
                            {data.nextSession.startTime ?? "—"} - {data.nextSession.endTime ?? "—"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Tasks hôm nay */}
                    {data.dueTodayTasks.length > 0 && (
                      <div className="rounded-2xl border border-[#e5eaf7] bg-white p-5 shadow-sm lg:col-span-2">
                        <h3 className="mb-3 text-base font-black text-[#0f1729]">Việc hôm nay</h3>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {data.dueTodayTasks.map((task: any) => (
                            <div key={task.id} className="rounded-lg border border-[#e5eaf7] bg-[#f8faff] px-3 py-2 flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-[#0f1729]">{task.title}</span>
                              {task.todayStatus && (
                                <span className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold ${badgeClass(task.todayStatus)}`}>
                                  {task.todayStatus}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab Content: BUỔI HỌC */}
              {activeTab === "buoihoc" && (
                <div className="space-y-3">
                  {data.projectedSchedule.map((slot: any) => {
                    const session = slot.session;
                    const roadmap = slot.roadmapItem;
                    return (
                      <div key={slot.number} className="rounded-2xl border border-[#e5eaf7] bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#e5eaf7] pb-3">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex rounded-full bg-[#eff6ff] px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563eb]">
                                #{slot.number}/{data.projectedSchedule.length}
                              </span>
                              <span className="text-sm font-bold text-[#0f1729]">
                                {formatDate(slot.sessionDate)}
                              </span>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${timingClass(slot.timing)}`}>
                                {timingLabel(slot.timing)}
                              </span>
                              <span className="inline-flex rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold text-[#4b6480]">
                                {slot.startTime ?? "—"} – {slot.endTime ?? "—"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-bold text-[#0f1729]">
                              {roadmap?.title?.trim() || `Buổi ${slot.number}`}
                            </p>
                            {roadmap?.objective?.trim() && (
                              <p className="mt-1 text-xs text-[#64748b] line-clamp-2">{roadmap.objective}</p>
                            )}
                            {roadmap?.materials?.trim() && (
                              <p className="mt-2 inline-flex rounded-lg border border-[#e8eef8] bg-[#f8fbff] px-2 py-1 text-[10px] font-medium text-[#64748b]">
                                Tài liệu: {roadmap.materials}
                              </p>
                            )}
                          </div>
                          {session && (
                            <Link
                              href={`/classes/${data.id}/sessions/${session.id}`}
                              onClick={onClose}
                              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#0ea5e9] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0284c7]"
                            >
                              Mở
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </Link>
                          )}
                        </div>
                        {session ? (
                          <div className="grid gap-2 text-xs sm:grid-cols-4">
                            <div>
                              <span className="font-semibold text-[#64748b]">Trạng thái:</span>{" "}
                              <span className={`ml-1 inline-flex rounded-lg px-1.5 py-0.5 text-[10px] font-bold ${badgeClass(session.status)}`}>
                                {session.status}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-[#64748b]">Điểm danh:</span>{" "}
                              <span className="ml-1 font-bold text-[#0f1729]">
                                {session.attendances?.length || 0}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-[#64748b]">Nhật ký:</span>{" "}
                              <span className="ml-1 font-bold text-[#0f1729]">
                                {session.journal?.publishedAt ? "Gửi" : session.journal ? "Nháp" : "Chưa"}
                              </span>
                            </div>
                            <div>
                              {data.permissions.canManageClass && session.status !== "CANCELLED" && session.status !== "RESCHEDULED" && !session.replacedBySession && (
                                <RescheduleSessionButton sessionId={session.id} sessionDateLabel={formatDate(session.sessionDate)} />
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs font-semibold text-[#f59e0b]">Chưa tạo buổi học</p>
                        )}
                      </div>
                    );
                  })}
                  {data.projectedSchedule.length === 0 && (
                    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-12 text-center shadow-sm">
                      <p className="text-sm font-bold text-[#64748b]">Chưa có buổi học nào</p>
                      <p className="mt-1 text-xs text-[#94a3b8]">Sinh buổi học để bắt đầu</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: HỌC VIÊN */}
              {activeTab === "hocvien" && (
                <div className="space-y-3">
                  {data.isRemedial && data.permissions.canManageClass && data.remedialCandidates.length > 0 && (
                    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-4 shadow-sm">
                      <RemedialBulkAssignPanel 
                        classId={data.id} 
                        candidates={data.remedialCandidates} 
                        futureSessions={data.remedialFutureSessions} 
                      />
                    </div>
                  )}
                  
                  {data.permissions.canManageClass && (
                    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-4 shadow-sm">
                      <EnrollStudentForm
                        classId={data.id}
                        courseTotalAmount={(data.tuitionPerSession ?? 0) * (data.totalSessions ?? 0)}
                        defaultMainSessionCount={data.totalSessions ?? 0}
                        defaultUnitPrice={data.tuitionPerSession ?? data.course?.tuitionPerSession ?? 0}
                      />
                    </div>
                  )}

                  {data.enrollments.map((enrollment: any) => {
                    const snapshot = enrollment.learningSnapshot;
                    return (
                      <div
                        key={enrollment.id}
                        className="rounded-2xl border border-[#e5eaf7] bg-white p-4 shadow-sm hover:border-[#3b82f6] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-start gap-2">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-xs font-bold text-white shadow-md">
                                {enrollment.student.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Link
                                    href={`/students/${enrollment.student.id}`}
                                    onClick={onClose}
                                    className="text-sm font-bold text-[#0f1729] hover:text-[#2563eb]"
                                  >
                                    {enrollment.student.fullName}
                                  </Link>
                                  <span className="font-mono text-xs font-semibold text-[#f97316]">
                                    {enrollment.student.studentCode}
                                  </span>
                                  <span className={`inline-flex rounded-lg px-1.5 py-0.5 text-[10px] font-bold ${badgeClass(enrollment.status)}`}>
                                    {ENROLLMENT_STATUS_LABEL[enrollment.status] ?? enrollment.status}
                                  </span>
                                  <span className="rounded-lg bg-[#eef6ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#2563eb]">
                                    {enrollment.billingModel === "COURSE" ? "Khóa" : enrollment.billingModel === "INSTALLMENT" ? "Góp" : "Tháng"}
                                  </span>
                                  {enrollment.debt > 0 && (
                                    <span className="inline-flex rounded-lg bg-[#f59e0b] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                      Nợ {formatVnd(enrollment.debt)}
                                    </span>
                                  )}
                                  {enrollment.activeScholarship && (
                                    <span className="inline-flex rounded-lg bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-bold text-[#047857]">
                                      HB {Math.round(enrollment.activeScholarship.percentage * 100)}%
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#64748b]">
                                  <span>SĐT: {enrollment.student.phone || "—"}</span>
                                  {enrollment.primaryGuardian && (
                                    <span>PH: {enrollment.primaryGuardian.fullName}</span>
                                  )}
                                  <span>Vào: {formatDate(enrollment.enrollDate)}</span>
                                </div>
                                {snapshot && (
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <span className="inline-flex rounded-lg border border-[#e5eaf7] bg-[#f8faff] px-2 py-0.5 text-[10px] font-semibold text-[#64748b]">
                                      Đã học: {snapshot.completedMainSessions}/{snapshot.entitledMainSessions}
                                    </span>
                                    <span className="inline-flex rounded-lg border border-[#e5eaf7] bg-[#f8faff] px-2 py-0.5 text-[10px] font-semibold text-[#64748b]">
                                      Còn: {snapshot.remainingMainSessions} buổi
                                    </span>
                                    <span className="inline-flex rounded-lg border border-[#e5eaf7] bg-[#f8faff] px-2 py-0.5 text-[10px] font-semibold text-[#2563eb]">
                                      {formatVnd(snapshot.remainingValue)}
                                    </span>
                                    {snapshot.manualExtraSessions > 0 && (
                                      <span className="inline-flex rounded-lg bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                        +{snapshot.manualExtraSessions} buổi
                                      </span>
                                    )}
                                  </div>
                                )}
                                {enrollment.latestAttendance && (
                                  <p className="mt-1 text-xs text-[#64748b]">
                                    Điểm danh: {attendanceLabel(enrollment.latestAttendance.status)} · {formatDate(enrollment.latestAttendance.sessionDate)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1.5">
                            <Link
                              href={`/students/${enrollment.student.id}`}
                              onClick={onClose}
                              className="inline-flex items-center justify-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100"
                            >
                              Hồ sơ
                            </Link>
                            {data.permissions.canManageClass && <EnrollmentRowActions enrollmentId={enrollment.id} status={enrollment.status} />}
                            {data.permissions.canManageClass && enrollment.status === "ACTIVE" && (
                              <AddEnrollmentSessionsButton enrollmentId={enrollment.id} studentName={enrollment.student.fullName} />
                            )}
                            {data.permissions.canManageClass && enrollment.status === "ACTIVE" && snapshot.remainingMainSessions > 0 && (
                              <TransferEnrollmentButton
                                enrollmentId={enrollment.id}
                                currentClassName={data.className}
                                currentCourseId={data.courseId}
                                remainingSessions={snapshot.remainingMainSessions}
                                paidRemainingSessions={snapshot.paidRemainingSessions}
                                manualExtraRemainingSessions={snapshot.manualExtraRemainingSessions}
                                oldUnitPrice={snapshot.unitPrice}
                                scholarshipPct={snapshot.scholarshipPct}
                                defaultTargetClassId={data.nextClassId}
                                classOptions={data.continuationClassOptions}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {data.enrollments.length === 0 && (
                    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-12 text-center shadow-sm">
                      <p className="text-sm font-bold text-[#64748b]">Chưa có học viên nào</p>
                      <p className="mt-1 text-xs text-[#94a3b8]">Ghi danh học viên để bắt đầu</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: CẤU HÌNH */}
              {activeTab === "cauhinh" && data.permissions.canManageClass && (
                <div className="space-y-4">
                  {/* Thiết lập lớp */}
                  <div className="rounded-2xl border border-[#e5eaf7] bg-white p-5 shadow-sm">
                    <h3 className="mb-4 text-base font-black text-[#0f1729]">Thiết lập lớp</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Học phí / buổi</p>
                        <p className="mt-1 text-base font-black text-[#0f1729]">
                          {data.tuitionPerSession ? formatVnd(data.tuitionPerSession) : "Chưa đặt"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Tạm tính toàn khóa</p>
                        <p className="mt-1 text-base font-black text-[#0f1729]">
                          {data.estimatedClassTuition ? formatVnd(data.estimatedClassTuition) : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Kết thúc dự kiến</p>
                        <p className="mt-1 text-base font-black text-[#0f1729]">{formatDate(data.suggestedEnd)}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <ClassDefaultAssignmentManager 
                        classId={data.id} 
                        employees={data.employees} 
                        assignments={data.defaultAssignments} 
                      />
                    </div>
                    <div className="mt-4">
                      <ScheduleRuleManager classId={data.id} rules={data.scheduleRules} />
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <ClassRecurringTaskManager classId={data.id} tasks={data.classTasks} />
                    <ClassTaskManager classId={data.id} tasks={data.tasks} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
