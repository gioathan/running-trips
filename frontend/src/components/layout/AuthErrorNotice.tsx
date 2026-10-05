"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/lib/toast-context";
import { errorMessageKey } from "@/lib/error-messages";

// Reasons worth telling the customer specifically; anything else is shown
// as a general "Google sign-in failed".
const SPECIFIC = new Set(["USE_PASSWORD_SIGN_IN", "GOOGLE_ACCOUNT_NOT_REGISTERED", "ADMIN_ACCOUNT", "RATE_LIMITED"]);

/** A Google sign-in that fails ends with a redirect back to the site
 * carrying `?auth_error=CODE` (the customer was away on Google's page, so
 * there is no open form to show the error in). This turns that into a
 * message and tidies the address bar. */
export function AuthErrorNotice() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const tErr = useTranslations("errors");
  const code = params.get("auth_error");

  // React's dev mode runs effects twice on mount — show each code once.
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!code || shown.current === code) return;
    shown.current = code;
    showToast(tErr(SPECIFIC.has(code) ? errorMessageKey(code) : "googleSignInFailed"), "error");
    const rest = new URLSearchParams(params.toString());
    rest.delete("auth_error");
    router.replace(pathname + (rest.size ? `?${rest}` : ""), { scroll: false });
    // Only when a code appears — not on every params identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return null;
}
