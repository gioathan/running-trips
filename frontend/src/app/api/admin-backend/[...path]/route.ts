import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  ADMIN_REFRESH_TOKEN_TTL_SECONDS,
  authCookieOptions,
} from "@/lib/cookies";

const BACKEND_URL = process.env.BACKEND_URL;

/** Same pattern as /api/backend/[...path], for the admin dashboard's own
 * client components — attaches the admin access token (never the regular
 * user one) and refreshes via /admin/auth/refresh using the admin refresh
 * cookie. Kept as a fully separate route/cookie pair per BACKEND_PLAN.md
 * §6/§11: an admin session must never be interchangeable with a user one. */
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

  let accessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
  let upstream = await doFetch(accessToken);
  let refreshedCookies: { access: string; refresh: string } | null = null;

  if (upstream.status === 401) {
    const refreshToken = cookieStore.get(ADMIN_REFRESH_TOKEN_COOKIE)?.value;
    if (refreshToken) {
      const refreshRes = await fetch(`${BACKEND_URL}/admin/auth/refresh`, {
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
    res.cookies.set(
      ADMIN_ACCESS_TOKEN_COOKIE,
      refreshedCookies.access,
      authCookieOptions(ADMIN_ACCESS_TOKEN_TTL_SECONDS)
    );
    res.cookies.set(
      ADMIN_REFRESH_TOKEN_COOKIE,
      refreshedCookies.refresh,
      authCookieOptions(ADMIN_REFRESH_TOKEN_TTL_SECONDS)
    );
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
