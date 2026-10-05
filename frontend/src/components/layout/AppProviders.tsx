"use client";

import { Suspense, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast-context";
import { LoginModalProvider } from "@/lib/login-modal-context";
import { AuthErrorNotice } from "./AuthErrorNotice";
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
          {/* useSearchParams needs a Suspense boundary */}
          <Suspense fallback={null}>
            <AuthErrorNotice />
          </Suspense>
        </LoginModalProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
