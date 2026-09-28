"use client";

import { useStudentDrawer } from "@/contexts/StudentDrawerContext";
import { memo, ReactNode, useCallback } from "react";

type StudentLinkProps = {
  studentId: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
};

/**
 * StudentLink - Smart link component that opens student drawer instead of navigating
 * 
 * Usage:
 * <StudentLink studentId="123" className="text-primary">Nguyễn Văn A</StudentLink>
 */
function StudentLink({ studentId, children, className, onClick }: StudentLinkProps) {
  const { openDrawer } = useStudentDrawer();

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onClick) {
      onClick(e);
    }
    
    openDrawer(studentId);
  }, [onClick, openDrawer, studentId]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
    >
      {children}
    </button>
  );
}

export default memo(StudentLink);
