import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ApiError, backendFetch } from "@/lib/api";
import { proxyHeaders } from "@/lib/proxy-headers";
import { setUserAuthCookies } from "@/lib/auth-server";
import {
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_COOKIE_PATH,
  nonceOf,
  safeIntent,
  safeLocale,
  safeReturnTo,
  type GoogleOauthPending,
} from "@/lib/google-oauth";
import type { AuthResponse } from "@/types/api";

function readPending(): GoogleOauthPending | null {
  try {
    const raw = cookies().get(GOOGLE_OAUTH_COOKIE)?.value;
    const pending = raw ? (JSON.parse(raw) as GoogleOauthPending) : null;
    return pending?.state && pending?.nonce ? pending : null;
  } catch {
    return null;
  }
}

/** Step 3: finish a sign-in started at /api/auth/google/start. Always answers
 * `{ redirect }` — the page to go to next; on failure that page carries an
 * `auth_error` code the site turns into a message (AuthErrorNotice). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { id_token?: string; state?: string; error?: string };
  const pending = readPending();
  const locale = safeLocale(pending?.locale);
  const returnTo = safeReturnTo(pending?.returnTo, locale);

  const finish = (redirect: string) => {
    const res = NextResponse.json({ redirect });
    res.cookies.set(GOOGLE_OAUTH_COOKIE, "", { path: GOOGLE_OAUTH_COOKIE_PATH, maxAge: 0 }); // one use only
    return res;
  };
  const fail = (code: string) => {
    const url = new URL(returnTo, "http://placeholder");
    url.searchParams.set("auth_error", code);
    return finish(url.pathname + url.search);
  };

  // The customer backed out on Google's page — not an error worth a message.
  if (body.error === "access_denied") return finish(returnTo);
  // Must be the answer to the sign-in *this browser* started: same state, and
  // a token minted for our nonce. Otherwise it's stale, forged or replayed.
  if (!pending || !body.id_token || body.state !== pending.state || nonceOf(body.id_token) !== pending.nonce) {
    return fail("GOOGLE_SIGN_IN_FAILED");
  }

  try {
    const data = await backendFetch<AuthResponse>("/auth/google", {
      method: "POST",
      headers: proxyHeaders(req.headers),
      body: JSON.stringify({ id_token: body.id_token, locale, intent: safeIntent(pending.intent) }),
    });
    const res = finish(returnTo);
    // Google sign-in is treated as a "remember me" session — matches
    // BACKEND_PLAN.md's own issue_tokens(..., remember_me=True) for Google.
    setUserAuthCookies(res, data.tokens, true);
    return res;
  } catch (err) {
    return fail(err instanceof ApiError ? err.code : "GOOGLE_SIGN_IN_FAILED");
  }
}
