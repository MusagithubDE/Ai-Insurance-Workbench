"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/types";

const STORAGE_KEY = "claims-workbench:user-role";

interface RoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("assessor");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
    if (stored === "assessor" || stored === "team_lead") setRole(stored);
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setRole: (next: UserRole) => {
        setRole(next);
        window.localStorage.setItem(STORAGE_KEY, next);
      },
    }),
    [role]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
