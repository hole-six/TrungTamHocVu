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
import SessionLinkWithDrawer from "./SessionLinkWithDrawer";

type Props = {
  open: boolean;
  onClose: () => void;
  classId: string;
};

const timingLabel = (timing: string) => {
  if (timing === "past") return "Đã qua";
  if (timing === "today") return "Hôm nay";
  return "Sắp tới";
};

const timingClass = (timing: string) => {
  if (timing === "past") return "text-[#94a3b8]";
  if (timing === "today") return "text-[#f97316] font-semibold";
  return "text-[#64748b]";
};

const badgeClass = (status: string) => {
  if (status === "ACTIVE" || status === "COMPLETED" || status === "DONE_ON_TIME") return "bg-[#dcfce7] text-[#166534]";
  if (status === "CANCELLED") return "bg-[#fee2e2] text-[#991b1b]";
  if (status === "PENDING" || status === "PLANNED") return "bg-[#fef9c3] text-[#854d0e]";
  return "bg-[#f1f5f9] text-[#475569]";
};

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang học",
  COMPLETED: "Hoàn tất",
  WITHDRAWN: "Đã rút",
  TRANSFERRED: "Đã chuyển",
};

export default function ClassDetailDrawer({ open, onClose, classId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tongquan" | "buoihoc" | "hocvien" | "cauhinh">("tongquan");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/classes/${classId}/summary`)
      .then(res => res.ok ? res.json() : Promise.reject("Failed to fetch"))
      .then(result => { setData(result); setLoading(false); })
      .catch(err => { setError(err); setLoading(false); });
  }, [open, classId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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

  const handleRefresh = () => {
    setLoading(true);
    fetch(`/api/classes/${classId}/summary`)
      .then(res => res.json())
      .then(result => { setData(result); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[101] flex flex-col overflow-hidden bg-white">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[#e5eaf7] bg-gradient-to-r from-[#f97316] to-[#ea580c] px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur transition hover:bg-white/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            {loading || !data ? (
              <h2 className="flex-1 text-center text-lg font-black text-white">Đang tải...</h2>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <h2 className="truncate text-center text-lg font-black text-white">{data.className}</h2>
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
                  <span className="rounded-lg bg-white/20 px-2 py-0.5 font-bold text-white backdrop-blur">{data.classCode}</span>
                  {data.course && <span className="rounded-lg bg-white/20 px-2 py-0.5 font-bold text-white backdrop-blur">{data.course.name}</span>}
                  {data.isRemedial && <span className="rounded-lg bg-amber-500 px-2 py-0.5 font-bold text-white">Bổ trợ</span>}
                  {data.totalOutstanding > 0 && <span className="rounded-lg bg-amber-400 px-2 py-0.5 font-bold text-white">Nợ {formatVnd(data.totalOutstanding)}</span>}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              {!loading && data && (
                <button onClick={handleRefresh} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur transition hover:bg-white/30">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                </button>
              )}
              <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur transition hover:bg-white/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
                <p className="text-sm font-semibold text-red-600">{error || "Không thể tải"}</p>
                <button onClick={onClose} className="mt-4 rounded-xl border-2 border-[#e5eaf7] bg-white px-6 py-3 text-sm font-semibold">Đóng</button>
              </div>
            </div>
          ) : (
            <div className="container mx-auto max-w-[1600px] space-y-4 p-4 pb-20">
              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5eaf7] bg-white p-3 shadow-sm">
                {data.latestSession && (
                  <SessionLinkWithDrawer
                    sessionId={data.latestSession.id}
                    classId={data.id}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f97316] to-[#ea580c] px-3 py-2 text-sm font-bold text-white"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="10 8 16 12 10 16" /></svg>
                    Mở buổi
                  </SessionLinkWithDrawer>
                )}
                {data.permissions.canManageClass && <GenerateSessionsForm classId={data.id} totalSessions={data.totalSessions} existingSessionCount={data.projectedSchedule.filter((s: any) => s.session).length} />}
                {data.permissions.canManageClass && data.status === "ACTIVE" && data.activeEnrollments > 0 && (
                  <CompleteClassButton classId={data.id} className={data.className} nextClassName={data.nextClass?.className ?? null} needTransferCount={data.completionStats.needTransferCount} completedCount={data.completionStats.readyCount} transferValueAmount={data.completionStats.transferValueAmount} freeExtraSessions={data.completionStats.freeExtraSessions} />
                )}
                <ClassEditForm cls={{ id: data.id, classCode: data.classCode, className: data.className, classGroup: data.classGroup, courseId: data.courseId, tuitionPerSession: data.tuitionPerSession, sessionsPerWeek: data.sessionsPerWeek, totalSessions: data.totalSessions, startDate: data.startDate, expectedEndDate: data.expectedEndDate, nextClassId: data.nextClassId, notes: data.notes, roadmapItems: data.roadmapItems }} courses={data.courses} classOptions={data.continuationClassOptions} renderSummary={false} triggerLabel="Sửa" triggerClassName="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#e5eaf7] bg-white px-3 py-2 text-sm font-semibold hover:border-[#f97316]" />
                <button onClick={() => { onClose(); window.location.href = `/classes/${classId}`; }} className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#e5eaf7] bg-white px-3 py-2 text-sm font-semibold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                  Full
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  { icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 0 1 0 0-8 4 0 0 0 0 8", label: "Sĩ số", value: data.activeEnrollments, sub: "học sinh", bg: "#eff6ff", color: "#f97316" },
                  { icon: "M20 6L9 17l-5-5", label: "Đã học", value: `${data.completedSessions}${data.totalSessions ? ` / ${data.totalSessions}` : ""}`, sub: "buổi", bg: "#ecfdf5", color: "#10b981" },
                  { icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", label: "Công nợ", value: formatVnd(data.totalOutstanding), sub: `${data.overdueEnrollments} HV`, bg: "#fef9c3", color: "#f59e0b" },
                  { icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", label: "Điểm danh", value: data.latestAttendanceStats.present, sub: `/ ${data.latestAttendanceStats.absent} vắng`, bg: "#fee2e2", color: "#ef4444" },
                  { icon: "M3 4h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M16 2v4M8 2v4M3 10h18", label: "Thời gian", value: formatDate(data.startDate), sub: `→ ${formatDate(data.suggestedEnd)}`, bg: "#ffedd5", color: "#f97316" },
                ].map((card, i) => (
                  <div key={i} className="rounded-xl border border-[#e5eaf7] bg-white p-3 shadow-sm">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: card.bg }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={card.color} strokeWidth="2"><path d={card.icon} /></svg>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">{card.label}</p>
                    <p className="mt-0.5 text-xl font-black text-[#0f1729]">{card.value}</p>
                    <p className="text-[10px] font-semibold text-[#64748b]">{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[#e5eaf7] bg-white p-1.5">
                {[
                  { key: "tongquan", label: "Tổng quan" },
                  { key: "buoihoc", label: `Buổi (${data.projectedSchedule.length})` },
                  { key: "hocvien", label: `HV (${data.enrollments.length})` },
                  ...(data.permissions.canManageClass ? [{ key: "cauhinh", label: "Cấu hình" }] : []),
                ].map((tab) => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex-1 min-w-[100px] rounded-xl px-3 py-2 text-sm font-bold ${activeTab === tab.key ? "bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white shadow-md" : "text-[#64748b] hover:bg-[#f8faff]"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === "tongquan" && (
                <div className="space-y-4">
                  {data.attentionItems.length > 0 && (
                    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-5 shadow-sm">
                      <h3 className="mb-3 text-base font-black">Cần chú ý</h3>
                      <div className="space-y-2">
                        {data.attentionItems.map((item: any, i: number) => (
                          <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${item.severity === "critical" ? "border border-red-200 bg-red-50" : item.severity === "warning" ? "border border-amber-200 bg-amber-50" : "border border-emerald-200 bg-emerald-50"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${item.severity === "critical" ? "bg-red-500" : item.severity === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} />
                            <span className="font-semibold">{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {data.latestSession && (
                      <div className="rounded-2xl border border-[#e5eaf7] bg-white p-5 shadow-sm">
                        <div className="mb-3 flex justify-between">
                          <h3 className="text-base font-black">Buổi gần nhất</h3>
                          <SessionLinkWithDrawer
                            sessionId={data.latestSession.id}
                            classId={data.id}
                            className="text-sm font-bold text-[#f97316] cursor-pointer"
                          >
                            Mở →
                          </SessionLinkWithDrawer>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {[
                            { label: "Ngày học", value: formatDate(data.latestSession.sessionDate), sub: `${data.latestSession.startTime ?? "—"} - ${data.latestSession.endTime ?? "—"}` },
                            { label: "Điểm danh", value: `${data.latestAttendanceStats.present} có mặt`, sub: `${data.latestAttendanceStats.absent} vắng` },
                            { label: "Nhật ký", value: data.latestSession.journalPublished ? "Đã gửi PH" : data.latestSession.hasJournal ? "Lưu nháp" : "Chưa có" },
                            { label: "Giáo viên", value: data.latestSession.teachers || "Chưa có" },
                          ].map((item, i) => (
                            <div key={i} className="rounded-lg border border-[#e5eaf7] bg-[#f8faff] p-3">
                              <p className="text-[10px] font-bold uppercase text-[#64748b]">{item.label}</p>
                              <p className="mt-1 text-sm font-bold">{item.value}</p>
                              {item.sub && <p className="text-xs text-[#64748b]">{item.sub}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.nextSession && (
                      <div className="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-5 shadow-sm">
                        <h3 className="mb-2 text-base font-black text-[#1e40af]">Buổi tới</h3>
                        <div className="flex flex-wrap gap-2 text-sm">
                          <span className="font-bold text-[#1e40af]">{formatDate(data.nextSession.sessionDate)}</span>
                          <span className="text-[#1e40af]/80">{data.nextSession.startTime ?? "—"} - {data.nextSession.endTime ?? "—"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "buoihoc" && (
                <div className="space-y-3">
                  {data.projectedSchedule.map((slot: any) => (
                    <div key={slot.number} className="rounded-2xl border border-[#e5eaf7] bg-white p-4 shadow-sm">
                      <div className="mb-3 flex justify-between gap-3 border-b border-[#e5eaf7] pb-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-bold text-[#2563eb]">#{slot.number}/{data.projectedSchedule.length}</span>
                            <span className="text-sm font-bold">{formatDate(slot.sessionDate)}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${timingClass(slot.timing)}`}>{timingLabel(slot.timing)}</span>
                            <span className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold text-[#4b6480]">{slot.startTime ?? "—"} – {slot.endTime ?? "—"}</span>
                          </div>
                          <p className="mt-2 text-sm font-bold">{slot.roadmapItem?.title?.trim() || `Buổi ${slot.number}`}</p>
                          {slot.roadmapItem?.objective && <p className="mt-1 text-xs text-[#64748b] line-clamp-2">{slot.roadmapItem.objective}</p>}
                        </div>
                        {slot.session && (
                          <SessionLinkWithDrawer
                            sessionId={slot.session.id}
                            classId={data.id}
                            className="inline-flex h-fit items-center gap-1 rounded-xl bg-[#0ea5e9] px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                          >
                            Mở →
                          </SessionLinkWithDrawer>
                        )}
                      </div>
                      {slot.session ? (
                        <div className="grid gap-2 text-xs sm:grid-cols-4">
                          <div><span className="font-semibold text-[#64748b]">Trạng thái:</span> <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeClass(slot.session.status)}`}>{slot.session.status}</span></div>
                          <div><span className="font-semibold text-[#64748b]">Điểm danh:</span> <span className="ml-1 font-bold">{slot.session.attendances?.length || 0}</span></div>
                          <div><span className="font-semibold text-[#64748b]">Nhật ký:</span> <span className="ml-1 font-bold">{slot.session.journal?.publishedAt ? "Gửi" : slot.session.journal ? "Nháp" : "Chưa"}</span></div>
                          {data.permissions.canManageClass && slot.session.status !== "CANCELLED" && <div><RescheduleSessionButton sessionId={slot.session.id} sessionDateLabel={formatDate(slot.session.sessionDate)} /></div>}
                        </div>
                      ) : (
                        <p className="text-xs font-semibold text-[#f59e0b]">Chưa tạo buổi học</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "hocvien" && (
                <div className="space-y-3">
                  {data.isRemedial && data.permissions.canManageClass && data.remedialCandidates?.length > 0 && (
                    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-4 shadow-sm"><RemedialBulkAssignPanel classId={data.id} candidates={data.remedialCandidates} futureSessions={data.remedialFutureSessions} /></div>
                  )}
                  {data.permissions.canManageClass && (
                    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-4 shadow-sm"><EnrollStudentForm classId={data.id} courseTotalAmount={(data.tuitionPerSession ?? 0) * (data.totalSessions ?? 0)} defaultMainSessionCount={data.totalSessions ?? 0} defaultUnitPrice={data.tuitionPerSession ?? data.course?.tuitionPerSession ?? 0} /></div>
                  )}
                  {data.enrollments.map((e: any) => {
                    const s = e.learningSnapshot;
                    return (
                      <div key={e.id} className="rounded-2xl border border-[#e5eaf7] bg-white p-4 shadow-sm hover:border-[#3b82f6]">
                        <div className="flex justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex gap-2">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-xs font-bold text-white shadow">{e.student.fullName.charAt(0).toUpperCase()}</div>
                              <div className="flex-1">
                                <div className="flex flex-wrap gap-1.5">
                                  <Link href={`/students/${e.student.id}`} onClick={onClose} className="text-sm font-bold hover:text-[#2563eb]">{e.student.fullName}</Link>
                                  <span className="text-xs font-semibold text-[#f97316]">{e.student.studentCode}</span>
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeClass(e.status)}`}>{ENROLLMENT_STATUS_LABEL[e.status] || e.status}</span>
                                  <span className="rounded bg-[#eef6ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#2563eb]">{e.billingModel === "COURSE" ? "Khóa" : e.billingModel === "INSTALLMENT" ? "Góp" : "Tháng"}</span>
                                  {e.debt > 0 && <span className="rounded bg-[#f59e0b] px-1.5 py-0.5 text-[10px] font-bold text-white">Nợ {formatVnd(e.debt)}</span>}
                                  {e.activeScholarship && <span className="rounded bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-bold text-[#047857]">HB {Math.round(e.activeScholarship.percentage * 100)}%</span>}
                                </div>
                                {s && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <span className="rounded border border-[#e5eaf7] bg-[#f8faff] px-2 py-0.5 text-[10px] font-semibold">Đã: {s.completedMainSessions}/{s.entitledMainSessions}</span>
                                    <span className="rounded border border-[#e5eaf7] bg-[#f8faff] px-2 py-0.5 text-[10px] font-semibold">Còn: {s.remainingMainSessions}</span>
                                    <span className="rounded border border-[#e5eaf7] bg-[#f8faff] px-2 py-0.5 text-[10px] font-semibold text-[#2563eb]">{formatVnd(s.remainingValue)}</span>
                                    {s.manualExtraSessions > 0 && <span className="rounded bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold text-emerald-700">+{s.manualExtraSessions}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1.5">
                            <Link href={`/students/${e.student.id}`} onClick={onClose} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-center text-xs font-bold text-sky-700">Hồ sơ</Link>
                            {data.permissions.canManageClass && <EnrollmentRowActions enrollmentId={e.id} status={e.status} />}
                            {data.permissions.canManageClass && e.status === "ACTIVE" && <AddEnrollmentSessionsButton enrollmentId={e.id} studentName={e.student.fullName} />}
                            {data.permissions.canManageClass && e.status === "ACTIVE" && s?.remainingMainSessions > 0 && (
                              <TransferEnrollmentButton enrollmentId={e.id} currentClassName={data.className} currentCourseId={data.courseId} remainingSessions={s.remainingMainSessions} paidRemainingSessions={s.paidRemainingSessions} manualExtraRemainingSessions={s.manualExtraRemainingSessions} oldUnitPrice={s.unitPrice} scholarshipPct={s.scholarshipPct} defaultTargetClassId={data.nextClassId} classOptions={data.continuationClassOptions} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === "cauhinh" && data.permissions.canManageClass && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#e5eaf7] bg-white p-5 shadow-sm">
                    <h3 className="mb-4 text-base font-black">Thiết lập lớp</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { label: "Học phí / buổi", value: data.tuitionPerSession ? formatVnd(data.tuitionPerSession) : "Chưa đặt" },
                        { label: "Tạm tính toàn khóa", value: data.estimatedClassTuition ? formatVnd(data.estimatedClassTuition) : "—" },
                        { label: "Kết thúc dự kiến", value: formatDate(data.suggestedEnd) },
                      ].map((item, i) => (
                        <div key={i} className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-3">
                          <p className="text-[10px] font-bold uppercase text-[#64748b]">{item.label}</p>
                          <p className="mt-1 text-base font-black">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4"><ClassDefaultAssignmentManager classId={data.id} employees={data.employees} assignments={data.defaultAssignments} /></div>
                    <div className="mt-4"><ScheduleRuleManager classId={data.id} rules={data.scheduleRules} /></div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
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
