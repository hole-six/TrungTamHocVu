"use client";

import { useState } from "react";
import SessionDetailDrawer from "./SessionDetailDrawer";

interface SessionLinkWithDrawerProps {
  sessionId: string;
  classId: string;
  children: React.ReactNode;
  className?: string;
  returnPath?: string;
}

export default function SessionLinkWithDrawer({
  sessionId,
  classId,
  children,
  className = "",
  returnPath,
}: SessionLinkWithDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={className}
      >
        {children}
      </button>

      <SessionDetailDrawer
        sessionId={sessionId}
        classId={classId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        returnPath={returnPath}
      />
    </>
  );
}
