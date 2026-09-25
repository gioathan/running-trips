import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendFetch, ApiError } from "@/lib/api";
import { setUserAuthCookies, clearUserAuthCookies } from "@/lib/auth-server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/cookies";
import type { TokenPair, UserPublic } from "@/types/api";

/** Called once by the client AuthProvider on mount to answer "who's signed
 * in, if anyone" — transparently refreshes and re-persists cookies if the
 * access token has expired, so a page reload doesn't silently sign someone
 * out just because 15 minutes passed. */
export async function GET() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ user: null });
  }

  const tryMe = (token: string) => backendFetch<UserPublic>("/users/me", { headers: { Authorization: `Bearer ${token}` } });

  if (accessToken) {
    try {
      const user = await tryMe(accessToken);
      return NextResponse.json({ user });
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) {
        return NextResponse.json({ user: null });
      }
      // fall through to refresh
    }
  }

  if (!refreshToken) {
    const res = NextResponse.json({ user: null });
    clearUserAuthCookies(res);
    return res;
  }

  try {
    const tokens = await backendFetch<TokenPair>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const user = await tryMe(tokens.access_token);
    const res = NextResponse.json({ user });
    // The refresh response doesn't echo back the original remember_me flag,
    // so default the *cookie's* maxAge conservatively short here — the
    // underlying refresh token's real TTL (governed server-side by what was
    // chosen at login) is unaffected; this only means a "remembered" session
    // re-persists its cookie on every active visit rather than getting one
    // long-lived cookie up front, which is a fine tradeoff over guessing true.
    setUserAuthCookies(res, tokens, false);
    return res;
  } catch {
    const res = NextResponse.json({ user: null });
    clearUserAuthCookies(res);
    return res;
  }
}
