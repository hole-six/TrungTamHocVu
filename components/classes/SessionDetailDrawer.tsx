"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import AttendanceForm from "@/components/classes/AttendanceForm";
import ClassJournalForm from "@/components/classes/ClassJournalForm";
import SessionAssignmentForm from "@/components/classes/SessionAssignmentForm";
import RemedialSessionRoster from "@/components/classes/RemedialSessionRoster";

interface SessionDetailDrawerProps {
  sessionId: string;
  classId: string;
  isOpen: boolean;
  onClose: () => void;
  returnPath?: string;
}

interface SessionData {
  session: {
    id: string;
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    room: string | null;
    status: string;
    notes: string | null;
    weekdayLabel: string;
    timing: "past" | "today" | "upcoming";
  };
  class: {
    id: string;
    className: string;
    classCode: string;
    courseName: string | null;
    isRemedial: boolean;
    branchName: string;
  };
  sessionNumber: number | null;
  totalSessions: number;
  roadmapItem: {
    title: string | null;
    objective: string | null;
    materials: string | null;
    teacherGuide: string | null;
    homeworkGuide: string | null;
    teacherRequirement: string | null;
  } | null;
  roster: Array<{
    enrollmentId: string;
    studentId: string;
    fullName: string;
    studentCode: string;
    status: string;
    availableCredits: number | null;
    locked: boolean;
    lockedNote: string | null;
  }>;
  presentCount: number;
  absentCount: number;
  enrollmentCount: number;
  assignments: Array<any>;
  journal: {
    id: string;
    unitLesson: string | null;
    teacherNote?: string | null;
    homeworkNote: string | null;
    publishedAt: string | Date | null;
    entries: any[];
  } | null;
  requirementCheck: {
    status: string;
    initialStatus: string;
    reason: string | null;
    scoreDecision: string;
    employee: { fullName: string };
    checkedAt: string;
  } | null;
  employees: Array<{ id: string; fullName: string; shortName: string | null }>;
  careAlertStudentIds: string[];
  permissions: {
    canManageClass: boolean;
    canTeachSession: boolean;
  };
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-[#fef9c3] text-[#854d0e]",
  COMPLETED: "bg-[#dcfce7] text-[#166534]",
  CANCELLED: "bg-[#fee2e2] text-[#991b1b]",
  RESCHEDULED: "bg-[#fef9c3] text-[#854d0e]",
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Đã lên lịch",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  RESCHEDULED: "Đã đổi lịch",
};

export default function SessionDetailDrawer({
  sessionId,
  classId,
  isOpen,
  onClose,
  returnPath,
}: SessionDetailDrawerProps) {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "journal" | "assignment">("overview");

  const fetchSessionData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/detail`);
      if (res.ok) {
        const data = await res.json();
        setSessionData(data);
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchSessionData();
    }
  }, [fetchSessionData, isOpen, sessionId]);

  const handleClose = () => {
    setSessionData(null);
    setActiveTab("overview");
    onClose();
    if (returnPath) {
      router.push(returnPath);
    }
  };

  if (!isOpen) return null;

  return (
    <ResponsiveDrawer
      open={isOpen}
      onClose={handleClose}
      title={sessionData ? `${sessionData.class.className}` : "Chi tiết buổi học"}
      widthClassName="max-w-5xl"
    >
      {loading && (
        <div className="slideover-form-card flex min-h-[220px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      )}

      {!loading && sessionData && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f97316] px-2 py-0.5 text-xs font-bold text-white">
                  #{sessionData.sessionNumber}/{sessionData.totalSessions}
                </span>
                <span className="text-sm font-bold text-[#9a3412] truncate">
                  {formatDate(sessionData.session.sessionDate)} · {sessionData.session.weekdayLabel}
                </span>
              </div>
              <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLORS[sessionData.session.status] || "bg-gray-100"}`}>
                {STATUS_LABELS[sessionData.session.status] || sessionData.session.status}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-xl bg-white/70 px-3 py-2">
                <div className="text-[#9a3412] opacity-70">Sĩ số</div>
                <div className="font-bold text-[#7c2d12]">{sessionData.enrollmentCount}</div>
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2">
                <div className="text-[#9a3412] opacity-70">Có mặt</div>
                <div className="font-bold text-emerald-700">{sessionData.presentCount}</div>
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2">
                <div className="text-[#9a3412] opacity-70">Vắng</div>
                <div className="font-bold text-red-700">{sessionData.absentCount}</div>
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2">
                <div className="text-[#9a3412] opacity-70">Giờ học</div>
                <div className="text-[11px] font-bold text-[#7c2d12]">
                  {sessionData.session.startTime?.slice(0, 5) || "—"} - {sessionData.session.endTime?.slice(0, 5) || "—"}
                </div>
              </div>
            </div>

            {sessionData.session.room && (
              <div className="mt-2 pt-2 border-t border-[#fed7aa] text-xs text-center">
                <span className="text-[#9a3412] opacity-70">Phòng: </span>
                <span className="font-semibold text-[#7c2d12]">{sessionData.session.room}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-[#e5eaf7] bg-white p-1 shadow-sm">
            <button
              onClick={() => setActiveTab("overview")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === "overview"
                  ? "bg-[#fff7ed] text-[#f97316]"
                  : "text-[#64748b] hover:text-[#0f1729]"
              }`}
            >
              Tổng quan
            </button>
            <button
              onClick={() => setActiveTab("attendance")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === "attendance"
                  ? "bg-[#fff7ed] text-[#f97316]"
                  : "text-[#64748b] hover:text-[#0f1729]"
              }`}
            >
              Điểm danh ({sessionData.roster.length})
            </button>
            <button
              onClick={() => setActiveTab("journal")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === "journal"
                  ? "bg-[#fff7ed] text-[#f97316]"
                  : "text-[#64748b] hover:text-[#0f1729]"
              }`}
            >
              Nhật ký
            </button>
            <button
              onClick={() => setActiveTab("assignment")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === "assignment"
                  ? "bg-[#fff7ed] text-[#f97316]"
                  : "text-[#64748b] hover:text-[#0f1729]"
              }`}
            >
              Phân công ({sessionData.assignments.length})
            </button>
          </div>

          <div className="pb-4">
            {activeTab === "overview" && (
              <div className="space-y-3">
                {/* Roadmap */}
                {sessionData.roadmapItem && (
                  <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" className="shrink-0 mt-0.5">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-[#0f1729]">
                          {sessionData.roadmapItem.title || `Buổi ${sessionData.sessionNumber}`}
                        </h3>
                        {sessionData.roadmapItem.objective && (
                          <p className="mt-1 text-xs text-[#64748b] leading-relaxed">
                            {sessionData.roadmapItem.objective}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {sessionData.roadmapItem.materials && (
                      <div className="mt-2 pt-2 border-t border-[#f1f5f9]">
                        <p className="text-xs">
                          <span className="text-[#64748b]">Tài liệu: </span>
                          <span className="font-medium text-[#0f1729]">{sessionData.roadmapItem.materials}</span>
                        </p>
                      </div>
                    )}

                    {sessionData.roadmapItem.teacherGuide && (
                      <div className="mt-2 pt-2 border-t border-[#f1f5f9]">
                        <p className="text-xs text-[#64748b] mb-1">Gợi ý cho giáo viên:</p>
                        <p className="text-xs text-[#0f1729] leading-relaxed">{sessionData.roadmapItem.teacherGuide}</p>
                      </div>
                    )}

                    {sessionData.roadmapItem.homeworkGuide && (
                      <div className="mt-2 pt-2 border-t border-[#f1f5f9]">
                        <p className="text-xs text-[#64748b] mb-1">Bài tập về nhà:</p>
                        <p className="text-xs text-[#0f1729] leading-relaxed">{sessionData.roadmapItem.homeworkGuide}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Việc giáo viên cần làm — chỉ hiển thị đọc, thao tác thật ở trang buổi học đầy đủ */}
                {sessionData.roadmapItem?.teacherRequirement?.trim() ? (
                  <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Việc giáo viên cần làm</h3>
                    <p className="text-sm text-[#0f1729] leading-relaxed">{sessionData.roadmapItem.teacherRequirement}</p>
                    {sessionData.requirementCheck ? (
                      <div className="mt-2 pt-2 border-t border-[#f1f5f9] space-y-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                            sessionData.requirementCheck.status === "SUBMITTED" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {sessionData.requirementCheck.status === "SUBMITTED" ? "Đã nộp" : "Chưa nộp"}
                        </span>
                        {sessionData.requirementCheck.initialStatus === "NOT_SUBMITTED" && sessionData.requirementCheck.status === "SUBMITTED" ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Nộp muộn</span>
                        ) : null}
                        <p className="text-xs text-[#64748b]">
                          Xác nhận bởi {sessionData.requirementCheck.employee.fullName} lúc {new Date(sessionData.requirementCheck.checkedAt).toLocaleString("vi-VN")}
                        </p>
                        {sessionData.requirementCheck.reason ? (
                          <p className="text-xs text-[#64748b]"><span className="font-semibold text-[#0f1729]">Lý do:</span> {sessionData.requirementCheck.reason}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 pt-2 border-t border-[#f1f5f9] text-xs font-semibold text-amber-700">Chưa xác nhận đã nộp/chưa nộp.</p>
                    )}
                    <a
                      href={`/classes/${sessionData.class.id}/sessions/${sessionData.session.id}`}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      Mở buổi đầy đủ để xác nhận →
                    </a>
                  </div>
                ) : null}

                {/* Teachers & Assistants */}
                {sessionData.assignments.length > 0 && (
                  <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Giáo viên & Trợ giảng</h3>
                    <div className="space-y-2">
                      {sessionData.assignments.map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-semibold text-[#0f1729]">{assignment.employeeName}</span>
                            <span className="ml-2 text-xs text-[#64748b]">({assignment.role})</span>
                          </div>
                          <span className="text-xs text-[#64748b]">
                            {assignment.payMode === "HOURLY" ? "Theo giờ" : "Theo ca"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {sessionData.session.notes && (
                  <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Ghi chú</h3>
                    <p className="text-sm text-[#0f1729] leading-relaxed">{sessionData.session.notes}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "attendance" && (
              <div className="space-y-3">
                {sessionData.class.isRemedial && sessionData.permissions.canManageClass ? (
                  <div className="flex justify-end">
                    <RemedialSessionRoster sessionId={sessionData.session.id} onSuccess={fetchSessionData} />
                  </div>
                ) : null}
                <AttendanceForm
                  sessionId={sessionData.session.id}
                  initialRoster={sessionData.roster}
                  isRemedial={sessionData.class.isRemedial}
                />
              </div>
            )}

            {activeTab === "journal" && (
              <ClassJournalForm
                sessionId={sessionData.session.id}
                roster={sessionData.roster.map(r => ({ 
                  id: r.studentId, 
                  fullName: r.fullName, 
                  studentCode: r.studentCode 
                }))}
                careAlertStudentIds={sessionData.careAlertStudentIds || []}
                journal={sessionData.journal}
                publishedUrl={`/classes/${sessionData.class.id}/sessions/${sessionData.session.id}`}
                plannedRoadmap={sessionData.roadmapItem ? {
                  sessionNumber: sessionData.sessionNumber ?? 1,
                  title: sessionData.roadmapItem.title,
                  objective: sessionData.roadmapItem.objective,
                  materials: sessionData.roadmapItem.materials,
                  teacherGuide: sessionData.roadmapItem.teacherGuide,
                  homeworkGuide: sessionData.roadmapItem.homeworkGuide,
                } : null}
                printMeta={{
                  branchName: sessionData.class.branchName,
                  className: sessionData.class.className,
                  sessionDateLabel: formatDate(sessionData.session.sessionDate),
                  weekdayLabel: sessionData.session.weekdayLabel,
                  scheduleLabel: `${sessionData.session.startTime?.slice(0, 5) || "—"} - ${sessionData.session.endTime?.slice(0, 5) || "—"}`,
                  totalStudents: sessionData.enrollmentCount,
                }}
              />
            )}

            {activeTab === "assignment" && (
              <SessionAssignmentForm
                sessionId={sessionData.session.id}
                employees={sessionData.employees.map(e => ({
                  id: e.id,
                  fullName: e.fullName,
                  shortName: e.shortName ?? e.fullName.split(' ').slice(-1)[0]
                }))}
                assignments={sessionData.assignments}
                currentEmployeeId={null}
              />
            )}
          </div>
        </div>
      )}
    </ResponsiveDrawer>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

