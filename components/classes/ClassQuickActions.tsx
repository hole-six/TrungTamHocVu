"use client";

import type { ComponentProps, ReactNode } from "react";
import SessionLinkWithDrawer from "./SessionLinkWithDrawer";
import GenerateSessionsForm from "./GenerateSessionsForm";
import CompleteClassButton, { type CompleteClassTransferStudent } from "./CompleteClassButton";
import ClassEditForm from "./ClassEditForm";

type ClassEditFormProps = ComponentProps<typeof ClassEditForm>;

type ClassQuickActionsProps = {
  classId: string;
  className: string;
  status: string;
  /** Buổi gần nhất của lớp — ẩn nút "Mở buổi mới nhất" nếu lớp chưa có buổi nào. */
  latestSessionId?: string | null;
  /** Đường quay lại khi đóng SessionDetailDrawer — trang đầy đủ truyền, quick-view drawer thường không cần. */
  returnPath?: string;
  canManageClass: boolean;
  totalSessions?: number | null;
  existingSessionCount: number;
  activeEnrollmentsCount: number;
  // Props cho CompleteClassButton — chỉ hiện khi canManageClass && status === "ACTIVE" && activeEnrollmentsCount > 0.
  nextClassName?: string | null;
  needTransferStudents: CompleteClassTransferStudent[];
  completedCount: number;
  nextClassUnitPrice: number;
  // Props cho ClassEditForm — tái dùng nguyên type của chính component đó để không lệch hình dạng.
  editCls: ClassEditFormProps["cls"];
  courses: ClassEditFormProps["courses"];
  classOptions?: ClassEditFormProps["classOptions"];
  /** Nút/khối riêng của từng nơi gọi, không thuộc bộ hành động dùng chung — vd. SpotlightTour ở trang đầy đủ, nút "Full" ở drawer. */
  extraSlot?: ReactNode;
  /** Gọi thêm sau khi bất kỳ hành động nào ở đây thành công — dùng cho nơi giữ state
   *  riêng (vd ClassDetailDrawer tự fetch dữ liệu, router.refresh() không đụng tới được). */
  onSuccess?: () => void;
  /** Khi "Kết thúc lớp" phát hiện chưa cấu hình lớp tiếp theo — xem CompleteClassButton. */
  onRequestConfigureNextClass?: () => void;
};

export default function ClassQuickActions({
  classId,
  className,
  status,
  latestSessionId,
  returnPath,
  canManageClass,
  totalSessions,
  existingSessionCount,
  activeEnrollmentsCount,
  nextClassName,
  needTransferStudents,
  completedCount,
  nextClassUnitPrice,
  editCls,
  courses,
  classOptions,
  extraSlot,
  onSuccess,
  onRequestConfigureNextClass,
}: ClassQuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3" data-tour="class-actions">
      {latestSessionId && (
        <SessionLinkWithDrawer sessionId={latestSessionId} classId={classId} returnPath={returnPath} className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:w-[18px] sm:h-[18px]">
            <circle cx="12" cy="12" r="10" />
            <polyline points="10 8 16 12 10 16" />
          </svg>
          <span className="hidden sm:inline">Mở buổi mới nhất</span>
          <span className="sm:hidden">Buổi học</span>
        </SessionLinkWithDrawer>
      )}
      {canManageClass && (
        <GenerateSessionsForm classId={classId} totalSessions={totalSessions} existingSessionCount={existingSessionCount} onSuccess={onSuccess} />
      )}
      {canManageClass && status === "ACTIVE" && activeEnrollmentsCount > 0 ? (
        <CompleteClassButton
          classId={classId}
          className={className}
          nextClassName={nextClassName ?? null}
          needTransferStudents={needTransferStudents}
          completedCount={completedCount}
          newUnitPrice={nextClassUnitPrice}
          onSuccess={onSuccess}
          onRequestConfigureNextClass={onRequestConfigureNextClass}
        />
      ) : null}
      <ClassEditForm
        cls={editCls}
        courses={courses}
        classOptions={classOptions ?? []}
        renderSummary={false}
        triggerLabel="Sửa"
        triggerClassName="btn-quickaction btn-quickaction--neutral"
        onSuccess={onSuccess}
      />
      {extraSlot}
    </div>
  );
}
