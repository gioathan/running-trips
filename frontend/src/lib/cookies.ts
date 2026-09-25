// Cookie names/TTLs mirror backend/app/core/config.py defaults
// (BACKEND_PLAN.md §6/§11) — keep in sync if those change.

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const ADMIN_ACCESS_TOKEN_COOKIE = "admin_access_token";
export const ADMIN_REFRESH_TOKEN_COOKIE = "admin_refresh_token";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS_REMEMBER_ME = 90 * 24 * 60 * 60;
export const ADMIN_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const ADMIN_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const authCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});
