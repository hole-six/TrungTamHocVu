"use client";

import { ReactNode } from "react";
import { StudentDrawerProvider, useStudentDrawer } from "@/contexts/StudentDrawerContext";
import { ClassDrawerProvider, useClassDrawer } from "@/contexts/ClassDrawerContext";
import StudentDetailDrawer from "@/components/students/StudentDetailDrawer";
import ClassDetailDrawer from "@/components/classes/ClassDetailDrawer";

function GlobalStudentDrawer() {
  const { drawerStudentId, closeDrawer } = useStudentDrawer();

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
  const { drawerClassId, closeDrawer } = useClassDrawer();

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
    <StudentDrawerProvider>
      <ClassDrawerProvider>
        {children}
        <GlobalStudentDrawer />
        <GlobalClassDrawer />
      </ClassDrawerProvider>
    </StudentDrawerProvider>
  );
}
