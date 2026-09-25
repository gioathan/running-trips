"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserPublic } from "@/types/api";
import { ApiError } from "@/lib/api";

interface AuthContextValue {
  user: UserPublic | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  signup: (email: string, password: string, fullName: string, locale: string) => Promise<void>;
  loginWithGoogle: (idToken: string, locale: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export function AuthProvider({ initialUser, children }: { initialUser: UserPublic | null; children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(initialUser);
  const [isLoading, setIsLoading] = useState(initialUser === null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      const data = await res.json();
      setUser(data.user ?? null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUser === null) {
      refresh();
    } else {
      setIsLoading(false);
    }
    // Only ever run this on mount — `initialUser` is the server-rendered
    // seed value and shouldn't re-trigger the effect if it changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    const data = await postJson<{ user: UserPublic }>("/api/auth/login", { email, password, remember_me: rememberMe });
    setUser(data.user);
  }, []);

  const signup = useCallback(async (email: string, password: string, fullName: string, locale: string) => {
    const data = await postJson<{ user: UserPublic }>("/api/auth/signup", {
      email,
      password,
      full_name: fullName,
      locale,
    });
    setUser(data.user);
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string, locale: string) => {
    const data = await postJson<{ user: UserPublic }>("/api/auth/google", { id_token: idToken, locale });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, signup, loginWithGoogle, logout, refresh }),
    [user, isLoading, login, signup, loginWithGoogle, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
