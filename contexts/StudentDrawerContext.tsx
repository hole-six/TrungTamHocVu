"use client";

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

type StudentDrawerStateContextType = {
  drawerStudentId: string | null;
};

type StudentDrawerActionsContextType = {
  openDrawer: (studentId: string) => void;
  closeDrawer: () => void;
};

const StudentDrawerStateContext = createContext<StudentDrawerStateContextType | undefined>(undefined);
const StudentDrawerActionsContext = createContext<StudentDrawerActionsContextType | undefined>(undefined);

export function StudentDrawerProvider({ children }: { children: ReactNode }) {
  const [drawerStudentId, setDrawerStudentId] = useState<string | null>(null);

  const openDrawer = useCallback((studentId: string) => {
    setDrawerStudentId(studentId);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerStudentId(null);
  }, []);

  const stateValue = useMemo(() => ({ drawerStudentId }), [drawerStudentId]);
  const actionsValue = useMemo(() => ({ openDrawer, closeDrawer }), [openDrawer, closeDrawer]);

  return (
    <StudentDrawerActionsContext.Provider value={actionsValue}>
      <StudentDrawerStateContext.Provider value={stateValue}>{children}</StudentDrawerStateContext.Provider>
    </StudentDrawerActionsContext.Provider>
  );
}

export function useStudentDrawer() {
  const context = useContext(StudentDrawerActionsContext);
  if (context === undefined) {
    throw new Error("useStudentDrawer must be used within a StudentDrawerProvider");
  }
  return context;
}

export function useStudentDrawerState() {
  const context = useContext(StudentDrawerStateContext);
  if (context === undefined) {
    throw new Error("useStudentDrawerState must be used within a StudentDrawerProvider");
  }
  return context;
}
