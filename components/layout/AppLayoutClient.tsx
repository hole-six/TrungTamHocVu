"use client";

import { ReactNode } from "react";
import { StudentDrawerProvider, useStudentDrawer, useStudentDrawerState } from "@/contexts/StudentDrawerContext";
import { ClassDrawerProvider, useClassDrawer, useClassDrawerState } from "@/contexts/ClassDrawerContext";
import StudentDetailDrawer from "@/components/students/StudentDetailDrawer";
import ClassDetailDrawer from "@/components/classes/ClassDetailDrawer";
import { ToastProvider } from "@/components/ui/Toast";

function GlobalStudentDrawer() {
  const { drawerStudentId } = useStudentDrawerState();
  const { closeDrawer } = useStudentDrawer();

  if (!drawerStudentId) return null;

  return (
    <StudentDetailDrawer
      open={!!drawerStudentId}
      onClose={closeDrawer}
      studentId={drawerStudentId}
    />
  );
}

function GlobalClassDrawer() {
  const { drawerClassId } = useClassDrawerState();
  const { closeDrawer } = useClassDrawer();

  if (!drawerClassId) return null;

  return (
    <ClassDetailDrawer
      open={!!drawerClassId}
      onClose={closeDrawer}
      classId={drawerClassId}
    />
  );
}

export function AppLayoutClient({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <StudentDrawerProvider>
        <ClassDrawerProvider>
          {children}
          <GlobalStudentDrawer />
          <GlobalClassDrawer />
        </ClassDrawerProvider>
      </StudentDrawerProvider>
    </ToastProvider>
  );
}
