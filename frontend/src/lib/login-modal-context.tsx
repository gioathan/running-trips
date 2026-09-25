"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface LoginModalContextValue {
  isOpen: boolean;
  initialTab: "login" | "signup";
  /** Called after a successful login/signup while the modal was open for a
   * specific action (e.g. "book this trip", "send this message") — lets the
   * trigger site resume what the user was doing instead of just closing. */
  onSuccess: (() => void) | null;
  open: (options?: { tab?: "login" | "signup"; onSuccess?: () => void }) => void;
  close: () => void;
}

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"login" | "signup">("login");
  const [onSuccess, setOnSuccess] = useState<(() => void) | null>(null);

  const open = useCallback((options?: { tab?: "login" | "signup"; onSuccess?: () => void }) => {
    setInitialTab(options?.tab ?? "login");
    setOnSuccess(() => options?.onSuccess ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, initialTab, onSuccess, open, close }),
    [isOpen, initialTab, onSuccess, open, close]
  );

  return <LoginModalContext.Provider value={value}>{children}</LoginModalContext.Provider>;
}

export function useLoginModal(): LoginModalContextValue {
  const ctx = useContext(LoginModalContext);
  if (!ctx) throw new Error("useLoginModal must be used within LoginModalProvider");
  return ctx;
}
