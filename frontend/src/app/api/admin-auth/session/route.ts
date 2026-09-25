import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendFetch, ApiError } from "@/lib/api";
import { setAdminAuthCookies, clearAdminAuthCookies } from "@/lib/auth-server";
import { ADMIN_ACCESS_TOKEN_COOKIE, ADMIN_REFRESH_TOKEN_COOKIE } from "@/lib/cookies";

interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}
interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export async function GET() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(ADMIN_REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) return NextResponse.json({ admin: null });

  const tryMe = (token: string) =>
    backendFetch<AdminUser>("/admin/auth/me", { headers: { Authorization: `Bearer ${token}` } });

  if (accessToken) {
    try {
      const admin = await tryMe(accessToken);
      return NextResponse.json({ admin });
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) return NextResponse.json({ admin: null });
    }
  }

  if (!refreshToken) {
    const res = NextResponse.json({ admin: null });
    clearAdminAuthCookies(res);
    return res;
  }

  try {
    const tokens = await backendFetch<TokenPair>("/admin/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const admin = await tryMe(tokens.access_token);
    const res = NextResponse.json({ admin });
    setAdminAuthCookies(res, tokens);
    return res;
  } catch {
    const res = NextResponse.json({ admin: null });
    clearAdminAuthCookies(res);
    return res;
  }
}
