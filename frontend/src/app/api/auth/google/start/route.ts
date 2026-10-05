import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_COOKIE_PATH,
  GOOGLE_OAUTH_TTL_SECONDS,
  googleRedirectUri,
  safeIntent,
  safeLocale,
  safeReturnTo,
  type GoogleOauthPending,
} from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

/** Step 1: remember what we're about to ask Google for, then send the
 * customer to Google's sign-in page. */
export async function GET(req: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  const locale = safeLocale(req.nextUrl.searchParams.get("locale"));
  const returnTo = safeReturnTo(req.nextUrl.searchParams.get("returnTo"), locale);
  if (!clientId) return NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));

  const pending: GoogleOauthPending = {
    state: randomBytes(24).toString("base64url"),
    nonce: randomBytes(24).toString("base64url"),
    locale,
    returnTo,
    intent: safeIntent(req.nextUrl.searchParams.get("intent")),
  };

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(req),
    response_type: "id_token",
    scope: "openid email profile",
    state: pending.state,
    nonce: pending.nonce,
    prompt: "select_account",
    hl: locale,
  }).toString();

  const res = NextResponse.redirect(google);
  res.cookies.set(GOOGLE_OAUTH_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // sent on the top-level navigation back from Google
    path: GOOGLE_OAUTH_COOKIE_PATH,
    maxAge: GOOGLE_OAUTH_TTL_SECONDS,
  });
  return res;
}
