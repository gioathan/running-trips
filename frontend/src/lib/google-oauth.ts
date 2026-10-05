import "server-only";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

/**
 * Google sign-in by full-page redirect (OpenID Connect implicit flow, ID
 * token only). The customer leaves for accounts.google.com and comes back to
 * /api/auth/google/callback — no popup and none of Google's scripts on our
 * pages, so it behaves the same in every browser, including in-app browsers
 * and ones that block third-party sign-in widgets.
 *
 * Start (/api/auth/google/start) stores a one-time `state` and `nonce` in an
 * httpOnly cookie; completion (POST /api/auth/google) only accepts an ID
 * token that comes back with that state and carries that nonce, so a token
 * from someone else's sign-in can't be replayed into this browser.
 */
export const GOOGLE_OAUTH_COOKIE = "google_oauth";
export const GOOGLE_OAUTH_COOKIE_PATH = "/api/auth/google";
export const GOOGLE_OAUTH_TTL_SECONDS = 10 * 60;

export interface GoogleOauthPending {
  state: string;
  nonce: string;
  locale: string;
  returnTo: string;
  /** Which form the button was on: only "signup" may create an account. */
  intent: GoogleIntent;
}

export type GoogleIntent = "login" | "signup";

export function safeIntent(value: string | null | undefined): GoogleIntent {
  return value === "signup" ? "signup" : "login";
}

/** Where Google sends the customer back to. Must be listed, exactly, under
 * "Authorised redirect URIs" on the OAuth client in Google Cloud Console. */
export function googleRedirectUri(req: NextRequest): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
  return `${origin}/api/auth/google/callback`;
}

export function safeLocale(value: string | null | undefined): string {
  return routing.locales.includes(value as (typeof routing.locales)[number]) ? (value as string) : routing.defaultLocale;
}

/** Only ever send people back to a page on this site. */
export function safeReturnTo(value: string | null | undefined, locale: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return `/${locale}`;
  return value;
}

/** The `nonce` claim of an ID token. Not a signature check — the backend
 * verifies the token with Google's keys; this only reads what to compare. */
export function nonceOf(idToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.nonce === "string" ? payload.nonce : null;
  } catch {
    return null;
  }
}
