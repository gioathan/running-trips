import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
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
} from "./lib/cookies";
import { proxyHeaders } from "./lib/proxy-headers";
import type { TokenPair } from "./types/api";

const intlMiddleware = createIntlMiddleware(routing);

// Refresh slightly before the JWT actually expires, so a token that's still
// valid here doesn't expire mid-render a moment later.
const EXPIRY_LEEWAY_SECONDS = 30;

interface SessionCookies {
  access: string;
  refresh: string;
  refreshPath: string;
  accessTtl: number;
  refreshTtl: (tokens: TokenPair) => number;
}

const USER_SESSION: SessionCookies = {
  access: ACCESS_TOKEN_COOKIE,
  refresh: REFRESH_TOKEN_COOKIE,
  refreshPath: "/auth/refresh",
  accessTtl: ACCESS_TOKEN_TTL_SECONDS,
  refreshTtl: (tokens) => (tokens.remember_me ? REFRESH_TOKEN_TTL_SECONDS_REMEMBER_ME : REFRESH_TOKEN_TTL_SECONDS),
};

const ADMIN_SESSION: SessionCookies = {
  access: ADMIN_ACCESS_TOKEN_COOKIE,
  refresh: ADMIN_REFRESH_TOKEN_COOKIE,
  refreshPath: "/admin/auth/refresh",
  accessTtl: ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  refreshTtl: () => ADMIN_REFRESH_TOKEN_TTL_SECONDS,
};

function isExpiring(accessToken: string | undefined): boolean {
  if (!accessToken) return true;
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp !== "number" || payload.exp - EXPIRY_LEEWAY_SECONDS <= Date.now() / 1000;
  } catch {
    return true;
  }
}

type RefreshOutcome = { kind: "none" } | { kind: "refreshed"; tokens: TokenPair } | { kind: "invalid" };

/**
 * Refreshes the session *before* rendering. Server Components can read
 * cookies but can't set them, so a refresh done during render (the old
 * approach) rotated the refresh token server-side and then threw the new
 * one away — leaving the browser holding a revoked token and signing the
 * user out ~15 minutes after login. Middleware can both set the response
 * cookies and rewrite the request's cookies, so the render that follows
 * sees the fresh access token.
 */
async function refreshSession(req: NextRequest, session: SessionCookies): Promise<RefreshOutcome> {
  const refreshToken = req.cookies.get(session.refresh)?.value;
  if (!refreshToken || !isExpiring(req.cookies.get(session.access)?.value)) return { kind: "none" };

  try {
    const res = await fetch(`${process.env.BACKEND_URL}${session.refreshPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...proxyHeaders(req.headers) },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (res.status === 401) return { kind: "invalid" };
    if (!res.ok) return { kind: "none" }; // backend hiccup — leave cookies alone, try again next request
    return { kind: "refreshed", tokens: (await res.json()) as TokenPair };
  } catch {
    return { kind: "none" };
  }
}

/** Updates the incoming request's cookies (what this render sees) — must run
 * before the response is created, since the response forwards these headers. */
function applyToRequest(req: NextRequest, session: SessionCookies, outcome: RefreshOutcome) {
  if (outcome.kind === "refreshed") {
    req.cookies.set(session.access, outcome.tokens.access_token);
    req.cookies.set(session.refresh, outcome.tokens.refresh_token);
  } else if (outcome.kind === "invalid") {
    req.cookies.delete(session.access);
    req.cookies.delete(session.refresh);
  }
}

/** Persists the outcome into the browser's cookie jar. */
function applyToResponse(res: NextResponse, session: SessionCookies, outcome: RefreshOutcome) {
  if (outcome.kind === "refreshed") {
    res.cookies.set(session.access, outcome.tokens.access_token, authCookieOptions(session.accessTtl));
    res.cookies.set(session.refresh, outcome.tokens.refresh_token, authCookieOptions(session.refreshTtl(outcome.tokens)));
  } else if (outcome.kind === "invalid") {
    res.cookies.delete(session.access);
    res.cookies.delete(session.refresh);
  }
}

/**
 * Cross-site request check for the /api route handlers, which act on the
 * session cookies. SameSite=Lax cookies already keep other sites' POSTs
 * from carrying a session; this is the second lock: a state-changing
 * request that a browser says came from another origin is refused outright.
 * Server-to-server callers (the backend hitting /api/revalidate) send no
 * Origin header and are unaffected.
 */
function isCrossSiteWrite(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  if (req.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true; // malformed Origin (e.g. "null" from a sandboxed frame)
  }
}

export default async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (isCrossSiteWrite(req)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Cross-site request refused" }, { status: 403 });
    }
    // Session refresh for API calls happens in the route handlers (on a 401).
    return NextResponse.next();
  }

  const isAdmin = req.nextUrl.pathname === "/admin" || req.nextUrl.pathname.startsWith("/admin/");
  const session = isAdmin ? ADMIN_SESSION : USER_SESSION;

  const outcome = await refreshSession(req, session);
  applyToRequest(req, session, outcome);

  // Admin has no locale prefix (internal tool, per BACKEND_PLAN.md's separate
  // admin auth path) — skip next-intl there. next-intl's own rewrite forwards
  // `req.headers`, so the cookie changes above reach the render either way.
  const res = isAdmin ? NextResponse.next({ request: { headers: req.headers } }) : intlMiddleware(req);
  applyToResponse(res, session, outcome);
  return res;
}

export const config = {
  // Everything except Next's own assets and files with an extension.
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
