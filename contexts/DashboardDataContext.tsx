"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DashboardData } from "@/lib/data";

interface DashboardDataState {
  data: Partial<DashboardData> | null;
  loading: boolean;
  error: string | null;
}

const DashboardDataContext = createContext<DashboardDataState>({
  data: null,
  loading: true,
  error: null,
});

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardDataState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, []);

  return (
    <DashboardDataContext.Provider value={state}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  return useContext(DashboardDataContext);
}
