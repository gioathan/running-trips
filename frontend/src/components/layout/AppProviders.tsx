"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast-context";
import { LoginModalProvider } from "@/lib/login-modal-context";
import { LoginModal } from "./LoginModal";
import { ToastViewport } from "./ToastViewport";
import type { UserPublic } from "@/types/api";

export function AppProviders({ initialUser, children }: { initialUser: UserPublic | null; children: ReactNode }) {
  return (
    <AuthProvider initialUser={initialUser}>
      <ToastProvider>
        <LoginModalProvider>
          {children}
          <LoginModal />
          <ToastViewport />
        </LoginModalProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
