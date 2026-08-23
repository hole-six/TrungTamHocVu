"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type ClassDrawerContextType = {
  drawerClassId: string | null;
  openDrawer: (classId: string) => void;
  closeDrawer: () => void;
};

const ClassDrawerContext = createContext<ClassDrawerContextType | undefined>(undefined);

export function ClassDrawerProvider({ children }: { children: ReactNode }) {
  const [drawerClassId, setDrawerClassId] = useState<string | null>(null);

  const openDrawer = (classId: string) => {
    setDrawerClassId(classId);
  };

  const closeDrawer = () => {
    setDrawerClassId(null);
  };

  return (
    <ClassDrawerContext.Provider value={{ drawerClassId, openDrawer, closeDrawer }}>
      {children}
    </ClassDrawerContext.Provider>
  );
}

export function useClassDrawer() {
  const context = useContext(ClassDrawerContext);
  if (context === undefined) {
    throw new Error("useClassDrawer must be used within a ClassDrawerProvider");
  }
  return context;
}
