"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type StudentDrawerContextType = {
  drawerStudentId: string | null;
  openDrawer: (studentId: string) => void;
  closeDrawer: () => void;
};

const StudentDrawerContext = createContext<StudentDrawerContextType | undefined>(undefined);

export function StudentDrawerProvider({ children }: { children: ReactNode }) {
  const [drawerStudentId, setDrawerStudentId] = useState<string | null>(null);

  const openDrawer = (studentId: string) => {
    setDrawerStudentId(studentId);
  };

  const closeDrawer = () => {
    setDrawerStudentId(null);
  };

  return (
    <StudentDrawerContext.Provider value={{ drawerStudentId, openDrawer, closeDrawer }}>
      {children}
    </StudentDrawerContext.Provider>
  );
}

export function useStudentDrawer() {
  const context = useContext(StudentDrawerContext);
  if (context === undefined) {
    throw new Error("useStudentDrawer must be used within a StudentDrawerProvider");
  }
  return context;
}
