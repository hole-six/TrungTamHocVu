"use client";

import { useClassDrawer } from "@/contexts/ClassDrawerContext";
import { memo, ReactNode, useCallback } from "react";

type ClassLinkProps = {
  classId: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
};

/**
 * ClassLink - Smart link component that opens class drawer instead of navigating
 * 
 * Usage:
 * <ClassLink classId="123" className="text-primary">Tên lớp A1</ClassLink>
 */
function ClassLink({ classId, children, className, onClick }: ClassLinkProps) {
  const { openDrawer } = useClassDrawer();

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onClick) {
      onClick(e);
    }
    
    openDrawer(classId);
  }, [classId, onClick, openDrawer]);

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

export default memo(ClassLink);
