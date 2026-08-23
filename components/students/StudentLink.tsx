"use client";

import { useStudentDrawer } from "@/contexts/StudentDrawerContext";
import { ReactNode } from "react";

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
export default function StudentLink({ studentId, children, className, onClick }: StudentLinkProps) {
  const { openDrawer } = useStudentDrawer();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onClick) {
      onClick(e);
    }
    
    openDrawer(studentId);
  };

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
