"use client";

import Script from "next/script";
import { useRef } from "react";
import { useLocale } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

/** Renders Google's own Sign-In button once its script loads. No-ops
 * (renders nothing) if NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID isn't set, e.g.
 * in local dev before it's configured. */
export function GoogleSignInButton({ onSuccess }: { onSuccess: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const { loginWithGoogle } = useAuth();
  const { showToast } = useToast();

  if (!CLIENT_ID) return null;

  const handleLoaded = () => {
    if (!window.google || !containerRef.current) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (response) => {
        try {
          await loginWithGoogle(response.credential, locale);
          onSuccess();
        } catch {
          showToast("Google sign-in failed. Please try again.", "error");
        }
      },
    });
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      width: 400,
      shape: "pill",
    });
  };

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={handleLoaded} />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}
