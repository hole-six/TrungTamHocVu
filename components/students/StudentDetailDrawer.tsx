"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import StudentKPICards from "./StudentKPICards";
import StudentQuickActions from "./StudentQuickActions";
import DetailTabs from "@/components/ui/DetailTabs";
import StudentFinanceDesk from "./StudentFinanceDesk";
import StudentEditForm from "./StudentEditForm";
import StudentSessionCredits from "./StudentSessionCredits";
import GuardianAccountPanel from "@/components/guardians/GuardianAccountPanel";
import AssignEnrollmentForm from "./AssignEnrollmentForm";
import TransferEnrollmentButton from "@/components/classes/TransferEnrollmentButton";
import ScholarshipAdjustmentForm from "./ScholarshipAdjustmentForm";
import Link from "next/link";
import { formatVnd, formatDate } from "@/lib/export-utils";

type StudentDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  studentId: string;
};

type StudentData = {
  id: string;
  studentCode: string;
  fullName: string;
  status: string;
  phone?: string | null;
  dob?: Date | null;
  address?: string | null;
  gender?: string | null;
  referredBy?: string | null;
  enrollDate?: Date | null;
  notes?: string | null;
  evaluation?: string | null;
  leaveReason?: string | null;
  lead?: {
    id: string;
    leadCode: string;
  } | null;
  kpis: {
    dueNowAmount: number;
    nextDueChargePeriod?: string | null;
    totalPaid: number;
    tuitionPaid: number;
    outstanding: number;
    totalCharged: number;
    chargesCount: number;
    unpaidBookAmount: number;
    attendanceStats: {
      present: number;
      absent: number;
      makeup: number;
    };
  };
  learningSnapshot?: {
    completedMainSessions: number;
    entitledMainSessions: number;
    remainingMainSessions: number;
    paidRemainingSessions: number;
    manualExtraRemainingSessions: number;
    continuationStatus: string;
    expectedStudentEndDate: Date | null;
    remainingValue: number;
    unitPrice: number;
    scholarshipPct: number;
    shortageAfterCurrentClass?: number;
  } | null;
  currentEnrollment?: {
    id: string;
    classId: string;
    className: string;
    courseId?: string | null;
    courseName?: string | null;
    enrollDate: Date;
    learningStartDate?: Date | null;
    billingModel: string;
    paidCatchupSessionCount: number;
    paidCatchupAmount: number;
    nextClassName?: string | null;
    nextClassId?: string | null;
    scheduleRules: Array<{
      weekday: string;
      startTime: string | null;
    }>;
  } | null;
  continuationClassOptions: Array<{
    id: string;
    classCode: string;
    className: string;
    courseId: string | null;
    tuitionPerSession: number | null;
    course?: { name: string; tuitionPerSession: number } | null;
  }>;
  activeEnrollments: Array<{
    enrollmentId: string;
    classId: string;
    className: string;
    billingModel: string;
  }>;
  primaryGuardian?: {
    id: string;
    fullName: string;
    phone?: string | null;
    user?: {
      email: string;
      isActive: boolean;
    } | null;
  } | null;
  allGuardians: Array<{
    id: string;
    relation?: string | null;
    isPrimary: boolean;
    guardian: {
      id: string;
      fullName: string;
      phone?: string | null;
      user?: {
        email: string;
        isActive: boolean;
      } | null;
    };
  }>;
  charges: Array<any>;
  nextDueCharge?: any | null;
  bookIssues: Array<any>;
  bookRequirements: Array<{
    id: string;
    className: string;
    bookName: string;
    quantity: number;
    totalAmount: number;
    status: string;
  }>;
  scholarships: Array<{
    id: string;
    percentage: number;
    reason: string | null;
    effectiveFrom: string | Date;
    effectiveTo: string | Date | null;
    enrollment: { id: string; class: { className: string } } | null;
  }>;
  adjustments: Array<{
    id: string;
    percentage: number;
    reason: string | null;
    effectiveFrom: string | Date;
    effectiveTo: string | Date | null;
    enrollment: { id: string; class: { className: string } } | null;
  }>;
  enrollments: Array<{ id: string; className: string; status: string }>;
  recentSessions: Array<any>;
  sessionCredits: Array<any>;
  makeupSessionOptions: Array<any>;
  operationalWarnings: Array<{
    text: string;
    severity: "critical" | "warning" | "info";
  }>;
  statusHistory: Array<{
    id: string;
    fromStatus?: string | null;
    toStatus: string;
    reason?: string | null;
    changedAt: Date;
  }>;
  transferHistory: Array<any>;
  enrollmentFinance: {
    mainTuition: number;
    paidCatchup: number;
    materials: number;
    transferCredit: number;
    total: number;
    paid: number;
    outstanding: number;
  };
  permissions: {
    canEditStudent: boolean;
    canManageFinance: boolean;
    canSeeFinance: boolean;
    canManageInventory: boolean;
    canManageSchedule: boolean;
    canManageGuardianAccount: boolean;
  };
};

function attendanceLabel(status: string) {
  switch (status) {
    case "PRESENT":
      return "Có mặt";
    case "ABSENT":
      return "Vắng";
    case "MAKEUP":
      return "Học bù";
    default:
      return status;
  }
}

export default function StudentDetailDrawer({
  open,
  onClose,
  studentId,
}: StudentDetailDrawerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignEnrollmentOpen, setAssignEnrollmentOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/students/${studentId}/drawer-data`);
        if (!response.ok) {
          throw new Error("Failed to fetch student data");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [open, studentId]);

  if (!open) return null;

  if (loading) {
    return (
      <ResponsiveDrawer
        open={open}
        onClose={onClose}
        widthClassName="max-w-7xl"
        title="Đang tải..."
      >
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#e5e7eb] border-t-[#f97316]"></div>
            <p className="text-sm text-[#6b7280]">Đang tải thông tin học viên...</p>
          </div>
        </div>
      </ResponsiveDrawer>
    );
  }

  if (error || !data) {
    return (
      <ResponsiveDrawer
        open={open}
        onClose={onClose}
        widthClassName="max-w-7xl"
        title="Lỗi"
      >
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-sm font-semibold text-red-600">
              {error || "Không thể tải thông tin học viên"}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 btn-ghost"
            >
              Đóng
            </button>
          </div>
        </div>
      </ResponsiveDrawer>
    );
  }

  const primaryTone: "critical" | "warning" | "success" = data.operationalWarnings.some(
    (w) => w.severity === "critical"
  )
    ? "critical"
    : data.operationalWarnings.some((w) => w.severity === "warning")
      ? "warning"
      : "success";

  const primaryLabel =
    primaryTone === "critical"
      ? "Cần xử lý gấp"
      : primaryTone === "warning"
        ? "Cần chú ý"
        : data.learningSnapshot?.continuationStatus === "COMPLETED"
          ? "Đã học đủ khóa chính"
          : "Đang ổn";

  const operationToneClass =
    primaryTone === "critical"
      ? "border-red-200 bg-red-50 text-red-800"
      : primaryTone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <>
      <ResponsiveDrawer
        open={open}
        onClose={onClose}
        widthClassName="max-w-7xl"
        title={data.fullName}
      >
        {/* Custom Header */}
        <div className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Identity */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-[#e5e7eb] text-[#6b7280] transition hover:border-[#f97316] hover:text-[#f97316]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>

              {/* Avatar gradient */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-lg font-bold text-white shadow-md">
                {data.fullName.charAt(0).toUpperCase()}
              </div>

              {/* Name + Code */}
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-[#111827]">{data.fullName}</h1>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-primary">{data.studentCode}</span>
                  {data.currentEnrollment && (
                    <span className="rounded-md bg-[#fb923c] px-2 py-0.5 font-bold text-white">
                      {data.currentEnrollment.className}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Status badges + Close */}
            <div className="flex shrink-0 items-center gap-2">
              {/* Status badge */}
              <span
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  data.status === "ACTIVE"
                    ? "bg-[#10b981] text-white"
                    : "bg-[#64748b] text-white"
                }`}
              >
                {data.status === "ACTIVE" ? "ĐANG HỌC" : "ĐÃ NGHỈ"}
              </span>

              {/* Debt badge if exists */}
              {data.kpis.outstanding > 0 && (
                <span className="hidden sm:inline-flex rounded-lg bg-[#f59e0b] px-3 py-1.5 text-xs font-bold text-white">
                  Nợ {formatVnd(data.kpis.outstanding)}
                </span>
              )}

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-[#e5e7eb] text-[#6b7280] transition hover:border-red-500 hover:text-red-500"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <StudentKPICards
          dueNowAmount={data.kpis.dueNowAmount}
          nextDueChargePeriod={data.kpis.nextDueChargePeriod}
          totalPaid={data.kpis.totalPaid}
          tuitionPaid={data.kpis.tuitionPaid}
          outstanding={data.kpis.outstanding}
          totalCharged={data.kpis.totalCharged}
          chargesCount={data.kpis.chargesCount}
          learningSnapshot={data.learningSnapshot}
          attendanceStats={data.kpis.attendanceStats}
          portalEmail={data.primaryGuardian?.user?.email}
          primaryGuardianName={data.primaryGuardian?.fullName}
          canViewFinance={data.permissions.canSeeFinance}
        />

        {/* Quick Actions */}
        <StudentQuickActions
          studentId={data.id}
          studentCode={data.studentCode}
          outstanding={data.kpis.outstanding}
          canManageFinance={data.permissions.canManageFinance}
          canEditStudent={data.permissions.canEditStudent}
          canManageInventory={data.permissions.canManageInventory}
          currentEnrollment={
            data.currentEnrollment
              ? {
                  classId: data.currentEnrollment.classId,
                  className: data.currentEnrollment.className,
                }
              : null
          }
          onAssignEnrollment={() => setAssignEnrollmentOpen(true)}
          onSelectBooks={() => {
            // TODO: Implement book selection
            alert("Chức năng chọn sách đang được phát triển");
          }}
          transferButton={
            data.permissions.canManageSchedule &&
            data.currentEnrollment &&
            data.learningSnapshot &&
            data.learningSnapshot.remainingMainSessions > 0 ? (
              <TransferEnrollmentButton
                enrollmentId={data.currentEnrollment.id}
                currentClassName={data.currentEnrollment.className}
                currentCourseId={data.currentEnrollment.courseId}
                remainingSessions={data.learningSnapshot.remainingMainSessions}
                paidRemainingSessions={data.learningSnapshot.paidRemainingSessions}
                manualExtraRemainingSessions={data.learningSnapshot.manualExtraRemainingSessions}
                oldUnitPrice={data.learningSnapshot.unitPrice}
                scholarshipPct={data.learningSnapshot.scholarshipPct}
                defaultTargetClassId={data.currentEnrollment.nextClassId}
                classOptions={data.continuationClassOptions}
                variant="quickaction"
              />
            ) : null
          }
        />

        {/* Operational Warnings */}
        {data.operationalWarnings.length > 0 && (
          <div className={`mx-4 my-4 rounded-xl border p-5 shadow-sm sm:mx-6 ${operationToneClass}`}>
            <p className="text-sm font-black uppercase tracking-[0.16em] opacity-80">
              {primaryLabel}
            </p>
            <ul className="mt-3 space-y-2">
              {data.operationalWarnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2 text-base font-semibold">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      warning.severity === "critical"
                        ? "bg-red-600"
                        : warning.severity === "warning"
                          ? "bg-amber-600"
                          : "bg-sky-600"
                    }`}
                  />
                  {warning.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tabs Content */}
        <div className="px-4 pb-6 sm:px-6">
          <DetailTabs
            defaultTabKey="tongquan"
            tabs={[
              {
                key: "tongquan",
                label: "Tổng quan & Học tập",
                content: (
                  <div className="space-y-5">
                    {/* Learning journey */}
                    {data.currentEnrollment && data.learningSnapshot && (
                      <div className="rounded-xl border border-[#dbe7ff] bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm font-bold uppercase tracking-wide text-[#2563eb]">
                              Hành trình học riêng của học viên
                            </p>
                            <h2 className="mt-1 text-xl font-black text-[#0f1729]">
                              {data.currentEnrollment.className}
                            </h2>
                            <p className="mt-1 text-base text-[#64748b]">
                              Bắt đầu{" "}
                              {formatDate(
                                data.currentEnrollment.learningStartDate ??
                                  data.currentEnrollment.enrollDate
                              )}{" "}
                              · dự kiến kết thúc{" "}
                              {formatDate(data.learningSnapshot.expectedStudentEndDate)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex w-fit rounded-lg px-3 py-1 text-xs font-bold ${
                              data.learningSnapshot.continuationStatus === "NEED_TRANSFER"
                                ? "bg-amber-100 text-amber-800"
                                : data.learningSnapshot.continuationStatus === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            {data.learningSnapshot.continuationStatus === "NEED_TRANSFER"
                              ? "Cần chuyển lớp"
                              : data.learningSnapshot.continuationStatus === "COMPLETED"
                                ? "Đã học đủ"
                                : "Đang theo lớp"}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
                            <p className="text-sm font-bold text-[#64748b]">Tiến độ khóa chính</p>
                            <p className="mt-1 text-2xl font-black text-[#0f1729]">
                              {data.learningSnapshot.completedMainSessions}/
                              {data.learningSnapshot.entitledMainSessions}
                            </p>
                            <p className="text-sm text-[#64748b]">
                              Còn {data.learningSnapshot.remainingMainSessions} buổi
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
                            <p className="text-sm font-bold text-[#64748b]">Tiền còn lại</p>
                            <p className="mt-1 text-2xl font-black text-[#0f1729]">
                              {formatVnd(data.learningSnapshot.remainingValue)}
                            </p>
                            <p className="text-sm text-[#64748b]">
                              {formatVnd(data.learningSnapshot.unitPrice)} / buổi
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
                            <p className="text-sm font-bold text-[#64748b]">Bổ trợ đầu khóa</p>
                            <p className="mt-1 text-2xl font-black text-[#0f1729]">
                              {data.currentEnrollment.paidCatchupSessionCount} buổi
                            </p>
                            <p className="text-sm text-[#64748b]">
                              {formatVnd(data.currentEnrollment.paidCatchupAmount)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
                            <p className="text-sm font-bold text-[#64748b]">Chuyển tiếp</p>
                            <p className="mt-1 text-base font-bold text-[#0f1729]">
                              {data.currentEnrollment.nextClassName ?? "Chưa cấu hình"}
                            </p>
                            {data.learningSnapshot.continuationStatus === "NEED_TRANSFER" ? (
                              <p className="text-sm text-amber-700">
                                Thiếu sau lớp hiện tại:{" "}
                                {data.learningSnapshot.shortageAfterCurrentClass} buổi
                              </p>
                            ) : (
                              <p className="text-sm text-[#64748b]">
                                Lớp hiện tại đủ đáp ứng số buổi còn lại
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#e5eaf7] pt-3 text-sm text-[#64748b]">
                          <span>
                            Điểm danh:{" "}
                            <strong className="text-base text-[#0f1729]">
                              {data.kpis.attendanceStats.present} có mặt
                            </strong>
                          </span>
                          <span>Vắng {data.kpis.attendanceStats.absent}</span>
                          <span>Bù {data.kpis.attendanceStats.makeup}</span>
                        </div>
                      </div>
                    )}

                    {/* Student session credits */}
                    {data.sessionCredits.length > 0 && (
                      <StudentSessionCredits
                        credits={data.sessionCredits}
                        sessionOptions={data.makeupSessionOptions}
                        canManage={data.permissions.canManageSchedule}
                      />
                    )}

                    {/* Recent sessions + Profile info - 2 cột ngang */}
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                        <div className="mb-5">
                          <h2 className="text-xl font-black tracking-tight text-[#0f1729]">
                            Buổi học gần đây
                          </h2>
                          <p className="mt-1 text-base text-[#64748b]">
                            Xem nhanh tình trạng học ở các buổi gần nhất.
                          </p>
                        </div>
                        <div className="space-y-3">
                          {data.recentSessions.slice(0, 5).map((session: any) => (
                            <div
                              key={session.attendance.id}
                              className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4 transition-colors hover:border-[#3b82f6]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <Link
                                      href={`/classes/${session.attendance.session.classId}/sessions/${session.attendance.session.id}`}
                                      className="text-base font-bold text-[#0f1729] hover:text-[#2563eb]"
                                    >
                                      {formatDate(session.attendance.session.sessionDate)}
                                      {session.sessionNumber ? ` · Buổi ${session.sessionNumber}` : ""}
                                    </Link>
                                    <span className="text-sm font-semibold text-[#94a3b8]">trong</span>
                                    <Link
                                      href={`/classes/${session.attendance.session.classId}`}
                                      className="text-base font-bold text-[#f97316] hover:text-[#ea580c]"
                                    >
                                      {session.attendance.session.class.className}
                                    </Link>
                                  </div>
                                  <p className="mt-1 text-sm text-[#64748b]">
                                    GV: {session.teachers || "Chưa phân công"}
                                  </p>
                                </div>
                                <span
                                  className={`inline-flex shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold whitespace-nowrap ${
                                    session.attendance.status === "ABSENT"
                                      ? "bg-[#fee2e2] text-[#991b1b]"
                                      : session.attendance.status === "MAKEUP"
                                        ? "bg-[#e0f2fe] text-[#075985]"
                                        : "bg-[#dcfce7] text-[#166534]"
                                  }`}
                                >
                                  {attendanceLabel(session.attendance.status)}
                                </span>
                              </div>
                            </div>
                          ))}
                          {data.recentSessions.length === 0 && (
                            <p className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4 text-base text-[#64748b]">
                              Chưa có buổi học nào để đối chiếu.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Profile info */}
                      <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-xl font-black tracking-tight text-[#0f1729]">
                              Hồ sơ học viên
                            </h2>
                            <p className="mt-1 text-base text-[#64748b]">
                              Thông tin cơ bản và mốc nhập học.
                            </p>
                          </div>
                          {data.lead && (
                            <Link
                              href={`/leads/${data.lead.id}`}
                              className="inline-flex items-center gap-1 text-base font-bold text-[#f97316] hover:text-[#ea580c]"
                            >
                              Lead{" "}
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </Link>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-5 py-4">
                            <span className="text-base font-semibold text-[#64748b]">
                              Ngày nhập học
                            </span>
                            <span className="text-base font-bold text-[#0f1729]">
                              {formatDate(data.enrollDate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-5 py-4">
                            <span className="text-base font-semibold text-[#64748b]">Ngày sinh</span>
                            <span className="text-base font-bold text-[#0f1729]">
                              {formatDate(data.dob)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-5 py-4">
                            <span className="text-base font-semibold text-[#64748b]">Giới tính</span>
                            <span className="text-base font-bold text-[#0f1729]">
                              {data.gender ?? "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-5 py-4">
                            <span className="text-base font-semibold text-[#64748b]">
                              Người giới thiệu
                            </span>
                            <span className="text-base font-bold text-[#0f1729]">
                              {data.referredBy ?? "—"}
                            </span>
                          </div>
                          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-5 py-4">
                            <span className="text-base font-semibold text-[#64748b]">
                              SĐT / Địa chỉ
                            </span>
                            <p className="mt-2 text-base font-bold text-[#0f1729]">
                              {data.phone ?? "—"} · {data.address ?? "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
              ...(data.permissions.canSeeFinance
                ? [
                    {
                      key: "hocphi",
                      label: "Học phí & Tài chính",
                      content: (
                        <div className="space-y-5">
                          <StudentFinanceDesk
                            studentId={data.id}
                            studentName={data.fullName}
                            studentCode={data.studentCode}
                            outstanding={data.kpis.outstanding}
                            dueNowAmount={data.kpis.dueNowAmount}
                            currentClassName={data.currentEnrollment?.className ?? null}
                            canIssueBooks={data.activeEnrollments.length > 0}
                            activeEnrollmentOptions={data.activeEnrollments}
                            nextDueCharge={data.nextDueCharge}
                            charges={data.charges}
                            bookIssues={data.bookIssues}
                            bookRequirements={data.bookRequirements}
                            canManageFinance={data.permissions.canManageFinance}
                            canManageInventory={data.permissions.canManageInventory}
                          />
                          {data.permissions.canEditStudent ? (
                            <ScholarshipAdjustmentForm
                              studentId={data.id}
                              scholarships={data.scholarships}
                              adjustments={data.adjustments}
                              enrollments={data.enrollments}
                            />
                          ) : null}
                        </div>
                      ),
                    },
                  ]
                : []),
              {
                key: "phuhuynh",
                label: "Phụ huynh & Portal",
                content: (
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-black tracking-tight text-[#0f1729]">
                            Phụ huynh liên kết
                          </h2>
                          <p className="mt-1 text-sm text-[#64748b]">
                            Xem liên hệ chính, portal và vai trò của từng người.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {data.allGuardians.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4 transition-colors hover:border-[#3b82f6]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-[#0f1729]">
                                  {item.guardian.fullName}
                                  {item.isPrimary && (
                                    <span className="ml-2 inline-flex items-center rounded-lg bg-[#3b82f6] px-2 py-0.5 text-[10px] font-bold text-white">
                                      CHÍNH
                                    </span>
                                  )}
                                </p>
                                <p className="mt-1 text-xs text-[#64748b]">
                                  {item.relation ?? "Người liên hệ"} ·{" "}
                                  {item.guardian.phone ?? "Chưa có SĐT"}
                                </p>
                              </div>
                              <Link
                                href={`/guardians/${item.guardian.id}`}
                                className="text-sm font-bold text-[#3b82f6] hover:text-[#0ea5e9]"
                              >
                                Mở →
                              </Link>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="inline-flex items-center rounded-lg border border-[#e5eaf7] bg-white px-2.5 py-1 text-xs font-semibold text-[#64748b]">
                                {item.guardian.user?.email ?? "Chưa cấp portal"}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${
                                  item.guardian.user?.isActive
                                    ? "bg-[#dcfce7] text-[#166534]"
                                    : "bg-[#fef9c3] text-[#854d0e]"
                                }`}
                              >
                                {item.guardian.user
                                  ? item.guardian.user.isActive
                                    ? "Portal hoạt động"
                                    : "Portal chưa kích hoạt"
                                  : "Chưa có portal"}
                              </span>
                            </div>
                          </div>
                        ))}
                        {data.allGuardians.length === 0 && (
                          <p className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4 text-sm text-[#64748b]">
                            Chưa liên kết phụ huynh nào.
                          </p>
                        )}
                      </div>
                    </div>

                    {data.permissions.canManageGuardianAccount && data.primaryGuardian && (
                      <GuardianAccountPanel
                        guardianId={data.primaryGuardian.id}
                        account={
                          data.primaryGuardian.user
                            ? {
                                email: data.primaryGuardian.user.email,
                                isActive: data.primaryGuardian.user.isActive,
                              }
                            : null
                        }
                        defaultEmail=""
                      />
                    )}
                  </div>
                ),
              },
              {
                key: "hoso",
                label: "Hồ sơ & Lịch sử",
                content: data.permissions.canEditStudent ? (
                  <div className="space-y-5">
                    <StudentEditForm
                      studentId={data.id}
                      initial={{
                        status: data.status,
                        gender: data.gender ?? "",
                        dob: data.dob ? new Date(data.dob).toISOString().slice(0, 10) : "",
                        phone: data.phone ?? "",
                        address: data.address ?? "",
                        leaveReason: data.leaveReason ?? "",
                        evaluation: data.evaluation ?? "",
                        referredBy: data.referredBy ?? "",
                        notes: data.notes ?? "",
                      }}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
                    <h2 className="mb-5 text-lg font-black tracking-tight text-[#0f1729]">
                      Hồ sơ học viên
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-4 py-3">
                        <span className="text-sm font-semibold text-[#64748b]">Giới tính</span>
                        <p className="mt-1 text-sm font-bold text-[#0f1729]">
                          {data.gender ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-4 py-3">
                        <span className="text-sm font-semibold text-[#64748b]">Ngày sinh</span>
                        <p className="mt-1 text-sm font-bold text-[#0f1729]">
                          {formatDate(data.dob)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-4 py-3">
                        <span className="text-sm font-semibold text-[#64748b]">Địa chỉ</span>
                        <p className="mt-1 text-sm font-bold text-[#0f1729]">
                          {data.address ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-4 py-3">
                        <span className="text-sm font-semibold text-[#64748b]">
                          Người giới thiệu
                        </span>
                        <p className="mt-1 text-sm font-bold text-[#0f1729]">
                          {data.referredBy ?? "—"}
                        </p>
                      </div>
                      {data.notes && (
                        <div className="col-span-2 rounded-xl border border-[#e5eaf7] bg-[#f8faff] px-4 py-3">
                          <span className="text-sm font-semibold text-[#64748b]">
                            Ghi chú nội bộ
                          </span>
                          <p className="mt-1 text-sm font-bold text-[#0f1729]">{data.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </ResponsiveDrawer>

      {/* Assign Enrollment Form */}
      {assignEnrollmentOpen && (
        <AssignEnrollmentForm
          student={{
            id: data.id,
            fullName: data.fullName,
            studentCode: data.studentCode,
            currentClassName: data.currentEnrollment?.className,
            sessionCreditCount: data.sessionCredits.filter((c: any) => c.status === "AVAILABLE")
              .length,
          }}
          open={assignEnrollmentOpen}
          onOpenChange={setAssignEnrollmentOpen}
        />
      )}
    </>
  );
}
