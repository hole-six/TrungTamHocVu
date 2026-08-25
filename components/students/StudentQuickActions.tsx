"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { formatVnd } from "@/lib/export-utils";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";

type StudentQuickActionsProps = {
  studentId: string;
  studentCode: string;
  outstanding: number;
  canManageFinance: boolean;
  canEditStudent: boolean;
  canManageInventory: boolean;
  currentEnrollment?: {
    classId: string;
    className: string;
  } | null;
  onAssignEnrollment?: () => void;
  onSelectBooks?: () => void;
  transferButton?: ReactNode;
};

export default function StudentQuickActions({
  studentId,
  studentCode,
  outstanding,
  canManageFinance,
  canEditStudent,
  canManageInventory,
  currentEnrollment,
  onAssignEnrollment,
  onSelectBooks,
  transferButton,
}: StudentQuickActionsProps) {
  return (
    <div className="border-b border-[#e5e7eb] bg-white px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        
        {/* Thu tiền - Primary action nếu có nợ */}
        {canManageFinance && outstanding > 0 && (
          <QuickPaymentButton 
            studentId={studentId} 
            suggestedAmount={outstanding}
          />
        )}
        
        {/* Gán lớp */}
        {canEditStudent && onAssignEnrollment && (
          <button
            type="button"
            onClick={onAssignEnrollment}
            className="btn-quickaction btn-quickaction--orange"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {currentEnrollment ? "Gán thêm lớp" : "Gán nhập học"}
          </button>
        )}
        
        {/* Chuyển lớp */}
        {transferButton}

        {/* Mở lớp hiện tại */}
        {currentEnrollment && (
          <Link
            href={`/classes/${currentEnrollment.classId}`}
            className="btn-quickaction btn-quickaction--blue"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span className="hidden sm:inline">Mở lớp {currentEnrollment.className}</span>
            <span className="sm:hidden">Lớp</span>
          </Link>
        )}
        
        {/* Chọn sách */}
        {canManageInventory && onSelectBooks && (
          <button
            type="button"
            onClick={onSelectBooks}
            className="btn-quickaction btn-quickaction--purple"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span className="hidden sm:inline">Chọn sách</span>
            <span className="sm:hidden">Sách</span>
          </button>
        )}
        
        {/* Copy student code */}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(studentCode);
          }}
          className="btn-quickaction btn-quickaction--neutral"
          title={`Copy mã học viên: ${studentCode}`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span className="hidden lg:inline">Copy mã</span>
        </button>
      </div>
    </div>
  );
}
