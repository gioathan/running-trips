import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  authCookieOptions,
} from "@/lib/cookies";

const BACKEND_URL = process.env.BACKEND_URL;

/**
 * Same-origin proxy for every client-originated backend call
 * (FRONTEND_PLAN.md §2/§9, BACKEND_PLAN.md §6): reads the httpOnly
 * access-token cookie server-side, attaches it as `Authorization: Bearer`,
 * forwards the request, and — on a 401 — transparently refreshes once using
 * the httpOnly refresh-token cookie before retrying. The browser never
 * handles either token directly.
 *
 * Public/anonymous reads that benefit from ISR (trip listings, content
 * pages) should NOT go through this route — call `backendFetch` directly
 * from a Server Component instead, so Next's fetch cache/`revalidate`
 * actually applies.
 */
async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  if (!BACKEND_URL) {
    return NextResponse.json({ code: "SERVER_MISCONFIGURED", message: "BACKEND_URL not set" }, { status: 500 });
  }

  const cookieStore = cookies();
  const targetPath = `/${path.join("/")}${req.nextUrl.search}`;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  const doFetch = (accessToken: string | undefined) =>
    fetch(`${BACKEND_URL}${targetPath}`, {
      method: req.method,
      headers: {
        "Content-Type": req.headers.get("content-type") ?? "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body,
    });

  let accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  let upstream = await doFetch(accessToken);
  let refreshedCookies: { access: string; refresh: string } | null = null;

  if (upstream.status === 401) {
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
    if (refreshToken) {
      const refreshRes = await fetch(`${BACKEND_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (refreshRes.ok) {
        const tokens = (await refreshRes.json()) as { access_token: string; refresh_token: string };
        refreshedCookies = { access: tokens.access_token, refresh: tokens.refresh_token };
        accessToken = tokens.access_token;
        upstream = await doFetch(accessToken);
      }
    }
  }

  const responseBody = await upstream.text();
  const res = new NextResponse(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });

  if (refreshedCookies) {
    res.cookies.set(ACCESS_TOKEN_COOKIE, refreshedCookies.access, authCookieOptions(ACCESS_TOKEN_TTL_SECONDS));
    res.cookies.set(REFRESH_TOKEN_COOKIE, refreshedCookies.refresh, authCookieOptions(REFRESH_TOKEN_TTL_SECONDS));
  }

  return res;
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
