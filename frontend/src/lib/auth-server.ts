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

/** Server Component helper: who's signed in right now, if anyone —
 * refreshes once via the httpOnly refresh cookie if the access token has
 * expired. Returns null rather than throwing when there's no session. */
export async function getCurrentUser(): Promise<UserPublic | null> {
  const cookieStore = cookies();
  let accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken) return null;
    try {
      const tokens = await backendFetch<TokenPair>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      accessToken = tokens.access_token;
      // Note: a Server Component can't set cookies on the response itself —
      // the client-side AuthProvider's session check (GET /api/auth/session)
      // is what actually persists a refreshed token back into the cookie jar.
    } catch {
      return null;
    }
  }

  try {
    return await backendFetch<UserPublic>("/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
}

/** Like `getCurrentUser`, but also returns the (possibly freshly-refreshed)
 * access token so a Server Component can make further authenticated
 * `backendFetch` calls of its own (e.g. `/users/me/bookings`) without
 * re-deriving it. Returns null if there's no valid session. */
export async function requireUser(): Promise<{ user: UserPublic; accessToken: string } | null> {
  const cookieStore = cookies();
  let accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken) return null;
    try {
      const tokens = await backendFetch<TokenPair>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      accessToken = tokens.access_token;
    } catch {
      return null;
    }
  }

  try {
    const user = await backendFetch<UserPublic>("/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
    return { user, accessToken };
  } catch {
    return null;
  }
}

/** Admin equivalent of `getCurrentUser` — used to seed AdminAuthProvider
 * server-side so the admin shell doesn't flash a logged-out state. */
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
