import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS_REMEMBER_ME,
  ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  ADMIN_REFRESH_TOKEN_TTL_SECONDS,
  authCookieOptions,
} from "@/lib/cookies";
import { backendFetch } from "@/lib/api";
import type { TokenPair, UserPublic } from "@/types/api";

interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}

export function setUserAuthCookies(res: NextResponse, tokens: TokenPair, rememberMe: boolean) {
  res.cookies.set(ACCESS_TOKEN_COOKIE, tokens.access_token, authCookieOptions(ACCESS_TOKEN_TTL_SECONDS));
  res.cookies.set(
    REFRESH_TOKEN_COOKIE,
    tokens.refresh_token,
    authCookieOptions(rememberMe ? REFRESH_TOKEN_TTL_SECONDS_REMEMBER_ME : REFRESH_TOKEN_TTL_SECONDS)
  );
}

export function clearUserAuthCookies(res: NextResponse) {
  res.cookies.delete(ACCESS_TOKEN_COOKIE);
  res.cookies.delete(REFRESH_TOKEN_COOKIE);
}

export function setAdminAuthCookies(res: NextResponse, tokens: TokenPair) {
  res.cookies.set(ADMIN_ACCESS_TOKEN_COOKIE, tokens.access_token, authCookieOptions(ADMIN_ACCESS_TOKEN_TTL_SECONDS));
  res.cookies.set(
    ADMIN_REFRESH_TOKEN_COOKIE,
    tokens.refresh_token,
    authCookieOptions(ADMIN_REFRESH_TOKEN_TTL_SECONDS)
  );
}

export function clearAdminAuthCookies(res: NextResponse) {
  res.cookies.delete(ADMIN_ACCESS_TOKEN_COOKIE);
  res.cookies.delete(ADMIN_REFRESH_TOKEN_COOKIE);
}

/** Server Component helper: who's signed in right now, if anyone. Returns
 * null rather than throwing when there's no session.
 *
 * Deliberately never refreshes: a Server Component can't set cookies, so
 * rotating the refresh token here would revoke the one in the browser and
 * discard its replacement. Refreshing happens in `middleware.ts` before the
 * render, so the access-token cookie seen here is already fresh. */
export async function getCurrentUser(): Promise<UserPublic | null> {
  return (await requireUser())?.user ?? null;
}

/** Like `getCurrentUser`, but also returns the access token so a Server
 * Component can make further authenticated `backendFetch` calls of its own
 * (e.g. `/users/me/bookings`). Returns null if there's no valid session. */
export async function requireUser(): Promise<{ user: UserPublic; accessToken: string } | null> {
  const accessToken = cookies().get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;

  try {
    const user = await backendFetch<UserPublic>("/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
    return { user, accessToken };
  } catch {
    return null;
  }
}

/** Admin equivalent of `getCurrentUser` — used to seed AdminAuthProvider
 * server-side so the admin shell doesn't flash a logged-out state. Same
 * no-refresh rule: `middleware.ts` refreshes admin sessions on /admin/*. */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;

  try {
    return await backendFetch<AdminUser>("/admin/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
}
