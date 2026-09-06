"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatVnd, formatDate } from "@/lib/export-utils";
import { Section, Stat } from "@/components/ui/DetailDrawerParts";
import ClassQuickActions from "./ClassQuickActions";
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

// Cùng triết lý với StudentDetailDrawer: 1 màn cuộn dọc, các mục gập lại
// (Section) thay vì tab, không khung lồng khung — mỗi Section tự có 1 khung
// viền duy nhất, nội dung bên trong xếp thành danh sách phẳng (divide-y) hoặc
// lưới Stat 2-3 cột thay vì mỗi dòng/mỗi buổi/mỗi học viên là 1 thẻ riêng.

type Props = {
  open: boolean;
  onClose: () => void;
  classId: string;
};

const CONFIG_SECTION_ID = "class-config-section";

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

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng",
  MAKEUP: "Học bù",
};

// Local, thuần — tránh import lib/server/class-default-assignments.ts (kéo theo
// @/lib/prisma vào bundle client), đúng cách ClassDefaultAssignmentManager.tsx đã làm.
function assignmentRoleType(role: string): "TEACHER" | "ASSISTANT" | null {
  const normalized = role.trim().toUpperCase();
  if (normalized === "TEACHER" || /^TEACHER_\d+$/.test(normalized)) return "TEACHER";
  if (normalized === "ASSISTANT" || normalized === "ASSISTANT2" || /^ASSISTANT_\d+$/.test(normalized)) return "ASSISTANT";
  return null;
}

export default function ClassDetailDrawer({ open, onClose, classId }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/classes/${classId}/summary`);
        if (!response.ok) throw new Error("Không thể tải thông tin lớp học");
        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tải thông tin lớp học");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [classId],
  );

  useEffect(() => {
    if (!open) return;
    void reload(true);
  }, [open, reload]);

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

  if (!open) return null;

  function openConfigSection() {
    const el = document.getElementById(CONFIG_SECTION_ID) as HTMLDetailsElement | null;
    if (el) {
      el.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <>
      {/* z-[60]/[61] — PHẢI thấp hơn các dialog mở TỪ BÊN TRONG drawer này (Sinh buổi
          học/Sửa dùng ResponsiveDrawer z-[80], Kết thúc lớp dùng ConfirmDialog z-[90]).
          Để cao hơn cả 2 thì các dialog đó mở ra bị nằm sau drawer, nhìn như bấm không
          có phản ứng gì. */}
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[61] flex flex-col overflow-hidden bg-white">
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
            <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur transition hover:bg-white/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#e5e7eb] border-t-[#f97316]" />
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
            <div className="mx-auto max-w-4xl space-y-4 p-4 pb-20">
              {/* Hai con số nghiệp vụ thật sự cần: sĩ số/tiến độ và công nợ */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Sĩ số</p>
                  <p className="mt-1 text-3xl font-black text-[#0f1729]">{data.activeEnrollments}</p>
                  <p className="mt-0.5 text-sm text-[#64748b]">
                    Đã học {data.completedSessions}{data.totalSessions ? `/${data.totalSessions}` : ""} buổi
                  </p>
                </div>
                <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Công nợ</p>
                  <p className={`mt-1 text-3xl font-black ${data.totalOutstanding > 0 ? "text-[#dc2626]" : "text-[#0f1729]"}`}>
                    {formatVnd(data.totalOutstanding)}
                  </p>
                  <p className="mt-0.5 text-sm text-[#64748b]">{data.overdueEnrollments} học viên đang nợ</p>
                </div>
              </div>

              {data.attentionItems.length > 0 ? (
                <ul className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  {data.attentionItems.map((item: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          item.severity === "critical" ? "bg-red-600" : item.severity === "warning" ? "bg-amber-600" : "bg-sky-600"
                        }`}
                      />
                      {item.text}
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* Hành động — chỉ những nút thật sự dùng được */}
              <ClassQuickActions
                classId={data.id}
                className={data.className}
                status={data.status}
                latestSessionId={data.latestSession?.id ?? null}
                canManageClass={data.permissions.canManageClass}
                totalSessions={data.totalSessions}
                existingSessionCount={data.projectedSchedule.filter((s: any) => s.session).length}
                activeEnrollmentsCount={data.activeEnrollments}
                nextClassName={data.nextClass?.className ?? null}
                needTransferStudents={data.completionStats.needTransferStudents}
                completedCount={data.completionStats.readyCount}
                nextClassUnitPrice={data.completionStats.nextClassUnitPrice}
                editCls={{
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
                onSuccess={() => void reload()}
                onRequestConfigureNextClass={openConfigSection}
              />

              <Section title="Tổng quan" defaultOpen hint={data.latestSession ? `Buổi gần nhất ${formatDate(data.latestSession.sessionDate)}` : null}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Stat label="Bắt đầu">{formatDate(data.startDate)}</Stat>
                  <Stat label="Dự kiến kết thúc">{formatDate(data.suggestedEnd)}</Stat>
                  <Stat label="Điểm danh gần nhất">
                    {data.latestSession ? `${data.latestAttendanceStats.present} có mặt · ${data.latestAttendanceStats.absent} vắng` : null}
                  </Stat>
                  {data.latestSession ? (
                    <Stat label="Buổi gần nhất">
                      <SessionLinkWithDrawer sessionId={data.latestSession.id} classId={data.id} className="text-[#1d4ed8] hover:underline">
                        {formatDate(data.latestSession.sessionDate)}
                      </SessionLinkWithDrawer>
                      {data.latestSession.journalPublished ? " · đã gửi PH" : data.latestSession.hasJournal ? " · nhật ký nháp" : " · chưa có nhật ký"}
                    </Stat>
                  ) : null}
                  {data.nextSession ? (
                    <Stat label="Buổi tới">
                      {formatDate(data.nextSession.sessionDate)} · {data.nextSession.startTime ?? "—"}-{data.nextSession.endTime ?? "—"}
                    </Stat>
                  ) : null}
                </div>

                <div className="mt-4 border-t border-[#f1f5f9] pt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Việc hôm nay</p>
                  <div className="mt-2 divide-y divide-[#f1f5f9]">
                    {data.dueTodayTasks.map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                        <span className="text-sm font-semibold text-[#0f1729]">{task.title}</span>
                        {task.todayStatus ? <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${badgeClass(task.todayStatus)}`}>{task.todayStatus}</span> : null}
                      </div>
                    ))}
                    {data.dueTodayTasks.length === 0 ? <p className="py-2 text-sm text-[#94a3b8]">Hôm nay chưa có việc tới hạn.</p> : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#f1f5f9] pt-4">
                  {data.latestSession ? (
                    <SessionLinkWithDrawer
                      sessionId={data.latestSession.id}
                      classId={data.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-bold text-[#0f1729] shadow-sm transition hover:border-[#f97316] hover:text-[#f97316]"
                    >
                      Điểm danh buổi gần nhất
                    </SessionLinkWithDrawer>
                  ) : null}
                  <Link
                    href="/tuition"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-bold text-[#0f1729] shadow-sm transition hover:border-[#f97316] hover:text-[#f97316]"
                  >
                    Mở học phí
                  </Link>
                  <Link
                    href="/inventory"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-bold text-[#0f1729] shadow-sm transition hover:border-[#f97316] hover:text-[#f97316]"
                  >
                    Mở giáo trình
                  </Link>
                </div>
              </Section>

              <Section title="Buổi học" hint={`${data.projectedSchedule.length} buổi`}>
                <div className="divide-y divide-[#f1f5f9]">
                  {data.projectedSchedule.map((slot: any) => (
                    <div key={slot.number} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                          <span className="shrink-0 rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-bold text-[#2563eb]">#{slot.number}/{data.projectedSchedule.length}</span>
                          <span className="shrink-0 text-sm font-bold">{formatDate(slot.sessionDate)}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${timingClass(slot.timing)}`}>{timingLabel(slot.timing)}</span>
                          <span className="shrink-0 rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold text-[#4b6480]">{slot.startTime ?? "—"} – {slot.endTime ?? "—"}</span>
                          <span className="truncate text-sm font-bold text-[#0f1729]">{slot.roadmapItem?.title?.trim() || `Buổi ${slot.number}`}</span>
                        </div>

                        {slot.session ? (
                          <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px]">
                            <span className={`rounded px-1.5 py-0.5 font-bold ${badgeClass(slot.session.status)}`}>{slot.session.status}</span>
                            <span className="font-semibold text-[#64748b]">Điểm danh <strong className="text-[#0f1729]">{slot.session.attendances?.length || 0}</strong></span>
                            <span className="font-semibold text-[#64748b]">Nhật ký <strong className="text-[#0f1729]">{slot.session.journal?.publishedAt ? "Gửi" : slot.session.journal ? "Nháp" : "Chưa"}</strong></span>
                            {data.permissions.canManageClass && slot.session.status !== "CANCELLED" && (
                              <RescheduleSessionButton sessionId={slot.session.id} sessionDateLabel={formatDate(slot.session.sessionDate)} onSuccess={() => void reload()} />
                            )}
                            <SessionLinkWithDrawer
                              sessionId={slot.session.id}
                              classId={data.id}
                              className="inline-flex items-center gap-1 rounded-xl bg-[#0ea5e9] px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                            >
                              Mở →
                            </SessionLinkWithDrawer>
                          </div>
                        ) : (
                          <p className="shrink-0 text-xs font-semibold text-[#f59e0b]">Chưa tạo buổi học</p>
                        )}
                      </div>
                      {slot.session?.assignments?.length > 0 && (
                        <p className="mt-1.5 text-xs text-[#64748b]">
                          {slot.session.assignments
                            .filter((a: any) => assignmentRoleType(a.role) === "TEACHER")
                            .map((a: any) => a.employee.fullName)
                            .join(", ") || "Chưa phân công GV"}
                          {" · "}
                          {slot.session.assignments
                            .filter((a: any) => assignmentRoleType(a.role) === "ASSISTANT")
                            .map((a: any) => a.employee.shortName || a.employee.fullName)
                            .join(", ") || "Chưa phân công TG"}
                        </p>
                      )}
                      {slot.roadmapItem?.objective && <p className="mt-1.5 text-xs text-[#64748b] line-clamp-1">{slot.roadmapItem.objective}</p>}
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Học viên" hint={`${data.enrollments.length} học viên`}>
                <div className="space-y-4">
                  {data.isRemedial && data.permissions.canManageClass && data.remedialCandidates?.length > 0 && (
                    <RemedialBulkAssignPanel classId={data.id} candidates={data.remedialCandidates} futureSessions={data.remedialFutureSessions} onSuccess={() => void reload()} bare />
                  )}
                  {data.permissions.canManageClass && (
                    <EnrollStudentForm
                      classId={data.id}
                      courseTotalAmount={(data.tuitionPerSession ?? 0) * (data.totalSessions ?? 0)}
                      defaultMainSessionCount={data.totalSessions ?? 0}
                      defaultUnitPrice={data.tuitionPerSession ?? data.course?.tuitionPerSession ?? 0}
                      onSuccess={() => void reload()}
                    />
                  )}
                  <div className="divide-y divide-[#f1f5f9]">
                    {data.enrollments.map((e: any) => {
                      const s = e.learningSnapshot;
                      return (
                        <div key={e.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Link href={`/students/${e.student.id}`} onClick={onClose} className="text-sm font-bold hover:text-[#2563eb]">{e.student.fullName}</Link>
                                <span className="text-xs font-semibold text-[#f97316]">{e.student.studentCode}</span>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeClass(e.status)}`}>{ENROLLMENT_STATUS_LABEL[e.status] || e.status}</span>
                                <span className="rounded bg-[#eef6ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#2563eb]">{e.billingModel === "COURSE" ? "Khóa" : e.billingModel === "INSTALLMENT" ? "Góp" : "Tháng"}</span>
                                {e.debt > 0 && <span className="rounded bg-[#f59e0b] px-1.5 py-0.5 text-[10px] font-bold text-white">Nợ {formatVnd(e.debt)}</span>}
                                {e.activeScholarship && <span className="rounded bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-bold text-[#047857]">HB {Math.round(e.activeScholarship.percentage * 100)}%</span>}
                              </div>
                              {e.chain ? (
                                <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-[#64748b]">
                                  {e.chain.map((node: any, i: number) => (
                                    <span key={node.id} className="flex items-center gap-1">
                                      {i > 0 ? <span className="text-[#cbd5e1]">→</span> : null}
                                      <span className={node.isCurrent ? "font-bold text-[#2563eb]" : ""}>{node.className}</span>
                                    </span>
                                  ))}
                                </p>
                              ) : null}
                              {s && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  <span className="rounded border border-[#e5eaf7] bg-[#f8faff] px-2 py-0.5 text-[10px] font-semibold">Đã: {s.completedMainSessions}/{s.entitledMainSessions}</span>
                                  <span className="rounded border border-[#e5eaf7] bg-[#f8faff] px-2 py-0.5 text-[10px] font-semibold">Còn: {s.remainingMainSessions}</span>
                                  <span className="rounded border border-[#e5eaf7] bg-[#f8faff] px-2 py-0.5 text-[10px] font-semibold text-[#2563eb]">{formatVnd(s.remainingValue)}</span>
                                  {s.manualExtraSessions > 0 && <span className="rounded bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold text-emerald-700">+{s.manualExtraSessions}</span>}
                                </div>
                              )}
                              <div className="mt-1.5 grid grid-cols-1 gap-1 text-[11px] text-[#64748b] sm:grid-cols-2">
                                <span>
                                  PH: {e.primaryGuardian ? `${e.primaryGuardian.fullName}${e.primaryGuardian.phone ? ` · ${e.primaryGuardian.phone}` : ""}` : "Chưa gắn"}
                                </span>
                                {e.latestCharge && <span>Kỳ {e.latestCharge.periodName}: còn {formatVnd(e.latestCharge.outstanding)}</span>}
                                {e.latestAttendance && (
                                  <span>Điểm danh gần nhất: {ATTENDANCE_STATUS_LABEL[e.latestAttendance.status] ?? e.latestAttendance.status} ({formatDate(e.latestAttendance.sessionDate)})</span>
                                )}
                                {e.latestBookIssue && <span>Sách gần nhất: {e.latestBookIssue.bookName} x{e.latestBookIssue.quantity}</span>}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-start gap-1.5">
                              <Link href={`/students/${e.student.id}`} onClick={onClose} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-center text-xs font-bold text-sky-700">Hồ sơ</Link>
                              {data.permissions.canManageClass && <EnrollmentRowActions enrollmentId={e.id} status={e.status} onSuccess={() => void reload()} />}
                              {data.permissions.canManageClass && e.status === "ACTIVE" && <AddEnrollmentSessionsButton enrollmentId={e.id} studentName={e.student.fullName} onSuccess={() => void reload()} />}
                              {data.permissions.canManageClass && e.status === "ACTIVE" && s?.remainingMainSessions > 0 && (
                                <TransferEnrollmentButton
                                  enrollmentId={e.id}
                                  currentClassName={data.className}
                                  currentCourseId={data.courseId}
                                  remainingSessions={s.remainingMainSessions}
                                  paidRemainingSessions={s.paidRemainingSessions}
                                  manualExtraRemainingSessions={s.manualExtraRemainingSessions}
                                  oldUnitPrice={s.unitPrice}
                                  scholarshipPct={s.scholarshipPct}
                                  defaultTargetClassId={data.nextClassId}
                                  classOptions={data.continuationClassOptions}
                                  onSuccess={() => void reload()}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Section>

              {data.permissions.canManageClass && (
                <Section id={CONFIG_SECTION_ID} title="Cấu hình">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Stat label="Học phí / buổi">{data.tuitionPerSession ? formatVnd(data.tuitionPerSession) : null}</Stat>
                    <Stat label="Tạm tính toàn khóa">{data.estimatedClassTuition ? formatVnd(data.estimatedClassTuition) : null}</Stat>
                    <Stat label="Kết thúc dự kiến">{formatDate(data.suggestedEnd)}</Stat>
                  </div>
                  <div className="mt-4 border-t border-[#f1f5f9] pt-4">
                    <ClassDefaultAssignmentManager classId={data.id} employees={data.employees} assignments={data.defaultAssignments} onSuccess={() => void reload()} bare />
                  </div>
                  <div className="mt-4 border-t border-[#f1f5f9] pt-4">
                    <ScheduleRuleManager classId={data.id} rules={data.scheduleRules} onSuccess={() => void reload()} bare />
                  </div>
                  <div className="mt-4 grid gap-4 border-t border-[#f1f5f9] pt-4 lg:grid-cols-2">
                    <ClassRecurringTaskManager classId={data.id} tasks={data.classTasks} onSuccess={() => void reload()} bare />
                    <ClassTaskManager classId={data.id} tasks={data.tasks} onSuccess={() => void reload()} bare />
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
