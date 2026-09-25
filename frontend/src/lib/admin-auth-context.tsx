"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";

interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}

interface AdminAuthContextValue {
  admin: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ initialAdmin, children }: { initialAdmin: AdminUser | null; children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(initialAdmin);
  const [isLoading, setIsLoading] = useState(initialAdmin === null);

  useEffect(() => {
    if (initialAdmin !== null) {
      setIsLoading(false);
      return;
    }
    fetch("/api/admin-auth/session", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setAdmin(data.admin ?? null))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/admin-auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data);
    setAdmin(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/admin-auth/logout", { method: "POST", credentials: "include" });
    setAdmin(null);
  }, []);

  const value = useMemo(() => ({ admin, isLoading, login, logout }), [admin, isLoading, login, logout]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
