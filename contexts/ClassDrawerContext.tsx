"use client";

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

type ClassDrawerStateContextType = {
  drawerClassId: string | null;
};

type ClassDrawerActionsContextType = {
  openDrawer: (classId: string) => void;
  closeDrawer: () => void;
};

const ClassDrawerStateContext = createContext<ClassDrawerStateContextType | undefined>(undefined);
const ClassDrawerActionsContext = createContext<ClassDrawerActionsContextType | undefined>(undefined);

export function ClassDrawerProvider({ children }: { children: ReactNode }) {
  const [drawerClassId, setDrawerClassId] = useState<string | null>(null);

  const openDrawer = useCallback((classId: string) => {
    setDrawerClassId(classId);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerClassId(null);
  }, []);

  const stateValue = useMemo(() => ({ drawerClassId }), [drawerClassId]);
  const actionsValue = useMemo(() => ({ openDrawer, closeDrawer }), [openDrawer, closeDrawer]);

  return (
    <ClassDrawerActionsContext.Provider value={actionsValue}>
      <ClassDrawerStateContext.Provider value={stateValue}>{children}</ClassDrawerStateContext.Provider>
    </ClassDrawerActionsContext.Provider>
  );
}

export function useClassDrawer() {
  const context = useContext(ClassDrawerActionsContext);
  if (context === undefined) {
    throw new Error("useClassDrawer must be used within a ClassDrawerProvider");
  }
  return context;
}

export function useClassDrawerState() {
  const context = useContext(ClassDrawerStateContext);
  if (context === undefined) {
    throw new Error("useClassDrawerState must be used within a ClassDrawerProvider");
  }
  return context;
}
