"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import StudentFinanceDesk from "./StudentFinanceDesk";
import StudentEditForm from "./StudentEditForm";
import StudentSessionCredits from "./StudentSessionCredits";
import ScholarshipAdjustmentForm from "./ScholarshipAdjustmentForm";
import AssignEnrollmentForm from "./AssignEnrollmentForm";
import AddGuardianForm from "./AddGuardianForm";
import TransferEnrollmentButton from "@/components/classes/TransferEnrollmentButton";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import { Section, Row, Stat, ACTION_CLASS } from "@/components/ui/DetailDrawerParts";
import { formatVnd, formatDate } from "@/lib/export-utils";

// Hồ sơ học viên — CỐ TÌNH giữ đúng 1 màn, không tab, không thẻ KPI, không đoạn giải
// thích dài. Hai con số duy nhất đặt trên đầu là hai thứ nghiệp vụ thật sự cần biết:
// đã học bao nhiêu buổi trên tổng số buổi đã mua, và còn nợ bao nhiêu tiền. Mọi thứ
// khác nằm trong các mục gập lại, mỗi mục hiện sẵn số liệu tóm tắt ngay trên dòng tiêu
// đề để không cần mở ra mới biết bên trong có gì.

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
  // Ví buổi học — chỉ có giá trị khi currentEnrollment.billingModel === "PERIOD".
  // Số buổi còn được quyền học vì đã đóng tiền, tách biệt hoàn toàn khỏi tiến độ
  // điểm danh (kpis.attendanceStats) — xem lib/server/enrollment-wallet.ts.
  walletBalance?: number | null;
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

const GENDER_LABEL: Record<string, string> = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác" };

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng",
  MAKEUP: "Học bù",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang học",
  LEFT: "Đã nghỉ",
  PENDING: "Chờ xếp lớp",
  PAUSED: "Tạm nghỉ",
  COMPLETED: "Hoàn thành",
  WITHDRAWN: "Rút lớp",
  TRANSFERRED: "Đã chuyển",
};

export default function StudentDetailDrawer({ open, onClose, studentId }: StudentDetailDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignEnrollmentOpen, setAssignEnrollmentOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  // Dữ liệu drawer nằm trong state của chính nó, KHÔNG phải server component — nên
  // router.refresh() ở các form con không làm nó mới lại được. Mọi thao tác bên trong
  // (đổi kiểu thu, thu tiền, xuất sách, chiết khấu, sửa hồ sơ...) đều gọi reload() để
  // số liệu cập nhật ngay tại chỗ, không phải đóng/mở lại drawer.
  const reload = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/students/${studentId}/drawer-data`);
        if (!response.ok) throw new Error("Không thể tải thông tin học viên");
        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tải thông tin học viên");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [studentId],
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setEditingProfile(false);
    void reload(true);
  }, [open, reload]);

  if (!open) return null;

  if (loading || error || !data) {
    return (
      <ResponsiveDrawer open={open} onClose={onClose} widthClassName="max-w-5xl" title={loading ? "Đang tải..." : "Lỗi"}>
        <div className="flex items-center justify-center py-20">
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#e5e7eb] border-t-[#f97316]" />
          ) : (
            <p className="text-sm font-semibold text-red-600">{error ?? "Không thể tải thông tin học viên"}</p>
          )}
        </div>
      </ResponsiveDrawer>
    );
  }

  const snapshot = data.learningSnapshot;
  const enrollment = data.currentEnrollment;
  const isCourseEnrollment = enrollment?.billingModel !== "PERIOD";
  const attendance = data.kpis.attendanceStats;
  const canSeeFinance = data.permissions.canSeeFinance;
  const availableCredits = data.sessionCredits.filter((credit: any) => credit.status === "AVAILABLE").length;
  const primaryGuardian = data.allGuardians.find((item) => item.isPrimary)?.guardian ?? null;
  const schedule = enrollment?.scheduleRules
    .map((rule) => `${rule.weekday}${rule.startTime ? ` ${rule.startTime}` : ""}`)
    .join(" · ");

  return (
    <>
      <ResponsiveDrawer open={open} onClose={onClose} widthClassName="max-w-5xl" title={data.fullName}>
        <div className="space-y-4">
          {/* Danh tính: mã HV, lớp, trạng thái — 1 dòng, không lặp lại tên (tiêu đề drawer đã có) */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(data.studentCode)}
              title="Bấm để copy mã học viên"
              className="rounded-md border border-[#e2e8f0] bg-[#f8faff] px-2 py-1 font-mono font-bold text-[#475569] hover:border-[#f97316] hover:text-[#f97316]"
            >
              {data.studentCode}
            </button>
            {enrollment ? (
              <Link
                href={`/classes/${enrollment.classId}`}
                className="rounded-md bg-[#fb923c] px-2 py-1 font-bold text-white hover:bg-[#ea580c]"
              >
                {enrollment.className}
              </Link>
            ) : null}
            <span
              className={`rounded-md px-2 py-1 font-bold text-white ${
                data.status === "ACTIVE" ? "bg-[#10b981]" : "bg-[#64748b]"
              }`}
            >
              {STATUS_LABEL[data.status] ?? data.status}
            </span>
            {data.lead ? (
              <Link href={`/leads/${data.lead.id}`} className="font-bold text-[#f97316] hover:underline">
                Lead {data.lead.leadCode}
              </Link>
            ) : null}
          </div>

          {/* Hai con số nghiệp vụ thật sự cần. PERIOD (95% học sinh): Ví buổi học — số
              buổi còn được quyền học vì đã đóng tiền, KHÔNG có "/tổng" vì không có
              tổng cố định (chốt nghiệp vụ). COURSE: giữ nguyên "N/M buổi". */}
          <div className={`grid gap-3 ${canSeeFinance ? "sm:grid-cols-2" : ""}`}>
            <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
              {enrollment?.billingModel === "PERIOD" ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Ví buổi học</p>
                  <p className={`mt-1 text-3xl font-black ${(data.walletBalance ?? 0) < 0 ? "text-[#dc2626]" : "text-[#0f1729]"}`}>
                    {data.walletBalance == null
                      ? "—"
                      : data.walletBalance < 0
                        ? `Âm ${Math.abs(data.walletBalance)} buổi`
                        : `Còn ${data.walletBalance} buổi`}
                  </p>
                  <p className="mt-0.5 text-sm text-[#64748b]">
                    {attendance.present} buổi đã học
                    {attendance.absent > 0 ? ` · vắng ${attendance.absent}` : ""}
                    {attendance.makeup > 0 ? ` · bù ${attendance.makeup}` : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Buổi đã học</p>
                  <p className="mt-1 text-3xl font-black text-[#0f1729]">
                    {snapshot ? `${snapshot.completedMainSessions}/${snapshot.entitledMainSessions}` : "—"}
                  </p>
                  <p className="mt-0.5 text-sm text-[#64748b]">
                    {snapshot ? `Còn ${snapshot.remainingMainSessions} buổi` : "Chưa ghi danh lớp nào"}
                    {attendance.absent > 0 ? ` · vắng ${attendance.absent}` : ""}
                    {attendance.makeup > 0 ? ` · bù ${attendance.makeup}` : ""}
                  </p>
                </>
              )}
            </div>
            {canSeeFinance ? (
              <div className="rounded-xl border border-[#e5eaf7] bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Còn nợ</p>
                <p
                  className={`mt-1 text-3xl font-black ${
                    data.kpis.outstanding > 0 ? "text-[#dc2626]" : "text-[#0f1729]"
                  }`}
                >
                  {formatVnd(data.kpis.outstanding)}
                </p>
                <p className="mt-0.5 text-sm text-[#64748b]">
                  {data.kpis.dueNowAmount > 0
                    ? `Cần thu ngay ${formatVnd(data.kpis.dueNowAmount)}`
                    : "Không có khoản đến hạn"}
                  {` · đã thu ${formatVnd(data.kpis.totalPaid)}`}
                </p>
              </div>
            ) : null}
          </div>

          {data.operationalWarnings.length > 0 ? (
            <ul className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              {data.operationalWarnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      warning.severity === "critical" ? "bg-red-600" : "bg-amber-600"
                    }`}
                  />
                  {warning.text}
                </li>
              ))}
            </ul>
          ) : null}

          {/* Hành động — chỉ những nút thật sự dùng được, xếp theo thứ tự hay dùng */}
          <div className="flex flex-wrap items-center gap-2">
            {data.permissions.canManageFinance && data.kpis.outstanding > 0 ? (
              <QuickPaymentButton studentId={data.id} suggestedAmount={data.kpis.outstanding} onChanged={() => void reload()} />
            ) : null}
            {data.permissions.canEditStudent ? (
              <button type="button" onClick={() => setAssignEnrollmentOpen(true)} className={ACTION_CLASS}>
                {enrollment ? "Gán thêm lớp" : "Gán nhập học"}
              </button>
            ) : null}
            {/* PERIOD chuyển lớp tự do, không cần "còn buổi" (khái niệm đó không tồn
                tại — quyền học nằm trong Ví). COURSE giữ nguyên điều kiện cũ. */}
            {data.permissions.canManageSchedule && enrollment && snapshot && (!isCourseEnrollment || snapshot.remainingMainSessions > 0) ? (
              <TransferEnrollmentButton
                enrollmentId={enrollment.id}
                currentClassName={enrollment.className}
                currentCourseId={enrollment.courseId}
                billingModel={enrollment.billingModel}
                walletBalance={data.walletBalance}
                remainingSessions={snapshot.remainingMainSessions}
                paidRemainingSessions={snapshot.paidRemainingSessions}
                manualExtraRemainingSessions={snapshot.manualExtraRemainingSessions}
                oldUnitPrice={snapshot.unitPrice}
                scholarshipPct={snapshot.scholarshipPct}
                defaultTargetClassId={enrollment.nextClassId}
                classOptions={data.continuationClassOptions}
                variant="compact"
                onSuccess={() => void reload()}
              />
            ) : null}
            {data.permissions.canEditStudent ? (
              <button
                type="button"
                onClick={() => setEditingProfile((current) => !current)}
                className={ACTION_CLASS}
              >
                {editingProfile ? "Đóng sửa hồ sơ" : "Sửa hồ sơ"}
              </button>
            ) : null}
          </div>

          {editingProfile && data.permissions.canEditStudent ? (
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
              onChanged={() => void reload()}
            />
          ) : null}

          <Section
            title="Lớp & tiến độ"
            defaultOpen
            hint={enrollment ? enrollment.className : "Chưa ghi danh"}
          >
            {enrollment && snapshot ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Stat label="Lớp đang học">
                  <Link href={`/classes/${enrollment.classId}`} className="text-[#1d4ed8] hover:underline">
                    {enrollment.className}
                  </Link>
                  {enrollment.courseName ? ` · ${enrollment.courseName}` : ""}
                </Stat>
                <Stat label="Lịch học">{schedule || null}</Stat>
                <Stat label="Bắt đầu">{formatDate(enrollment.learningStartDate ?? enrollment.enrollDate)}</Stat>
                {/* "Dự kiến hết buổi" suy từ remainingMainSessions — chỉ có nghĩa với
                    COURSE (tổng buổi cố định). PERIOD không có mốc kết thúc kiểu này. */}
                {isCourseEnrollment ? (
                  <Stat label="Dự kiến hết buổi">{formatDate(snapshot.expectedStudentEndDate)}</Stat>
                ) : null}
                <Stat label="Cách thu">{enrollment.billingModel === "PERIOD" ? "Theo tháng" : "Trọn khóa"}</Stat>
                {canSeeFinance && isCourseEnrollment ? (
                  <Stat label="Tiền còn lại">
                    {formatVnd(snapshot.remainingValue)} · {formatVnd(snapshot.unitPrice)}/buổi
                  </Stat>
                ) : null}
                {canSeeFinance && !isCourseEnrollment && data.walletBalance != null ? (
                  <Stat label="Giá trị Ví">
                    {formatVnd(data.walletBalance * snapshot.unitPrice)} · {formatVnd(snapshot.unitPrice)}/buổi
                  </Stat>
                ) : null}
                {enrollment.paidCatchupSessionCount > 0 ? (
                  <Stat label="Bổ trợ đầu khóa">
                    {enrollment.paidCatchupSessionCount} buổi
                    {canSeeFinance ? ` · ${formatVnd(enrollment.paidCatchupAmount)}` : ""}
                  </Stat>
                ) : null}
                {enrollment.nextClassName ? <Stat label="Lớp tiếp theo">{enrollment.nextClassName}</Stat> : null}
                {data.enrollments.length > 1 ? (
                  <Stat label="Các lớp khác" wide>
                    {data.enrollments
                      .filter((item) => item.className !== enrollment.className)
                      .map((item) => `${item.className} (${STATUS_LABEL[item.status] ?? item.status})`)
                      .join(", ")}
                  </Stat>
                ) : null}
                {isCourseEnrollment && snapshot.continuationStatus === "NEED_TRANSFER" ? (
                  <Stat label="Cần xử lý" wide>
                    <span className="text-amber-700">
                      Lớp hiện tại thiếu {snapshot.shortageAfterCurrentClass} buổi so với số buổi đã mua — cần chuyển
                      lớp tiếp.
                    </span>
                  </Stat>
                ) : null}
                {isCourseEnrollment && snapshot.continuationStatus === "COMPLETED" ? (
                  <Stat label="Cần xử lý" wide>
                    <span className="text-emerald-700">
                      Đã học đủ số buổi đã mua. Ghi danh gói mới nếu học tiếp, hoặc để nguyên đến khi lớp kết thúc.
                    </span>
                  </Stat>
                ) : null}
                {!isCourseEnrollment && data.walletBalance != null && data.walletBalance <= 0 ? (
                  <Stat label="Cần xử lý" wide>
                    <span className="text-amber-700">
                      {data.walletBalance < 0
                        ? `Ví âm ${Math.abs(data.walletBalance)} buổi — đã học vượt quá tiền đã đóng, cần thu gấp.`
                        : "Ví đã hết buổi — cần thu học phí tháng mới trước khi học tiếp."}
                    </span>
                  </Stat>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8]">Học viên chưa được gán vào lớp nào.</p>
            )}
          </Section>

          {data.sessionCredits.length > 0 ? (
            <Section title="Bổ trợ & học bù" hint={`${availableCredits} buổi còn phải xếp`}>
              <StudentSessionCredits
                credits={data.sessionCredits}
                sessionOptions={data.makeupSessionOptions}
                canManage={data.permissions.canManageSchedule}
                onChanged={() => void reload()}
                bare
              />
            </Section>
          ) : null}

          {canSeeFinance ? (
            <Section
              title="Học phí & thanh toán"
              hint={data.kpis.outstanding > 0 ? `Còn nợ ${formatVnd(data.kpis.outstanding)}` : "Không nợ"}
            >
              <div className="space-y-4">
                <StudentFinanceDesk
                  studentId={data.id}
                  studentName={data.fullName}
                  studentCode={data.studentCode}
                  outstanding={data.kpis.outstanding}
                  dueNowAmount={data.kpis.dueNowAmount}
                  currentClassName={enrollment?.className ?? null}
                  canIssueBooks={data.activeEnrollments.length > 0}
                  activeEnrollmentOptions={data.activeEnrollments}
                  nextDueCharge={data.nextDueCharge}
                  charges={data.charges}
                  bookIssues={data.bookIssues}
                  bookRequirements={data.bookRequirements}
                  canManageFinance={data.permissions.canManageFinance}
                  canManageInventory={data.permissions.canManageInventory}
                  onChanged={() => void reload()}
                  bare
                />
                {data.permissions.canEditStudent ? (
                  <ScholarshipAdjustmentForm
                    studentId={data.id}
                    scholarships={data.scholarships}
                    adjustments={data.adjustments}
                    enrollments={data.enrollments}
                    onChanged={() => void reload()}
                    bare
                  />
                ) : null}
              </div>
            </Section>
          ) : null}

          <Section
            title="Buổi học gần đây"
            hint={data.recentSessions.length > 0 ? `${data.recentSessions.length} buổi` : "Chưa có buổi nào"}
          >
            {data.recentSessions.length > 0 ? (
              <div className="space-y-2">
                {data.recentSessions.slice(0, 8).map((session: any) => (
                  <div key={session.attendance.id} className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <Link
                        href={`/classes/${session.attendance.session.classId}/sessions/${session.attendance.session.id}`}
                        className="text-sm font-bold text-[#0f1729] hover:text-[#1d4ed8]"
                      >
                        {formatDate(session.attendance.session.sessionDate)}
                        {session.sessionNumber ? ` · Buổi ${session.sessionNumber}` : ""}
                      </Link>
                      <p className="truncate text-xs text-[#64748b]">
                        {session.attendance.session.class.className}
                        {session.teachers ? ` · ${session.teachers}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
                        session.attendance.status === "ABSENT"
                          ? "bg-[#fee2e2] text-[#991b1b]"
                          : session.attendance.status === "MAKEUP"
                            ? "bg-[#e0f2fe] text-[#075985]"
                            : "bg-[#dcfce7] text-[#166534]"
                      }`}
                    >
                      {ATTENDANCE_LABEL[session.attendance.status] ?? session.attendance.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8]">Chưa có buổi học nào được điểm danh.</p>
            )}
          </Section>

          <Section
            title="Phụ huynh"
            hint={primaryGuardian ? primaryGuardian.fullName : "Chưa gắn phụ huynh"}
          >
            <div className="space-y-4">
              {data.allGuardians.length > 0 ? (
                <div>
                  {data.allGuardians.map((item) => (
                    <Row key={item.id} label={item.isPrimary ? "PH chính" : item.relation ?? "Liên hệ"}>
                      <Link href={`/guardians/${item.guardian.id}`} className="text-[#1d4ed8] hover:underline">
                        {item.guardian.fullName}
                      </Link>
                      {item.guardian.phone ? ` · ${item.guardian.phone}` : ""}
                    </Row>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#94a3b8]">Chưa liên kết phụ huynh nào.</p>
              )}
              {data.permissions.canEditStudent ? <AddGuardianForm studentId={data.id} onChanged={() => void reload()} /> : null}
            </div>
          </Section>

          <Section
            title="Hồ sơ học viên"
            hint={[formatDate(data.dob), data.gender ? GENDER_LABEL[data.gender] ?? data.gender : null]
              .filter(Boolean)
              .join(" · ")}
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Stat label="Ngày sinh">{formatDate(data.dob)}</Stat>
              <Stat label="Giới tính">{data.gender ? GENDER_LABEL[data.gender] ?? data.gender : null}</Stat>
              <Stat label="Số điện thoại">{data.phone}</Stat>
              <Stat label="Ngày nhập học">{formatDate(data.enrollDate)}</Stat>
              <Stat label="Người giới thiệu">{data.referredBy}</Stat>
              {data.status !== "ACTIVE" ? <Stat label="Lý do nghỉ">{data.leaveReason}</Stat> : null}
              <Stat label="Địa chỉ" wide>{data.address}</Stat>
              <Stat label="Đánh giá" wide>{data.evaluation}</Stat>
              <Stat label="Ghi chú" wide>{data.notes}</Stat>
            </div>
          </Section>

          {data.statusHistory.length > 0 ? (
            <Section title="Lịch sử trạng thái" hint={`${data.statusHistory.length} lần đổi`}>
              <div>
                {data.statusHistory.map((item) => (
                  <Row key={item.id} label={formatDate(item.changedAt)}>
                    {item.fromStatus ? `${STATUS_LABEL[item.fromStatus] ?? item.fromStatus} → ` : ""}
                    {STATUS_LABEL[item.toStatus] ?? item.toStatus}
                    {item.reason ? ` · ${item.reason}` : ""}
                  </Row>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      </ResponsiveDrawer>

      {assignEnrollmentOpen ? (
        <AssignEnrollmentForm
          student={{
            id: data.id,
            fullName: data.fullName,
            studentCode: data.studentCode,
            currentClassName: enrollment?.className,
            sessionCreditCount: availableCredits,
          }}
          open={assignEnrollmentOpen}
          onOpenChange={setAssignEnrollmentOpen}
          onChanged={() => void reload()}
        />
      ) : null}
    </>
  );
}
