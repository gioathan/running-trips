import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { clearUserAuthCookies } from "@/lib/auth-server";
import { REFRESH_TOKEN_COOKIE } from "@/lib/cookies";

export async function POST() {
  const refreshToken = cookies().get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    try {
      await backendFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Best-effort — clear cookies regardless so the client is signed out
      // even if the backend call fails (e.g. token already expired).
    }
  }
  const res = NextResponse.json({ ok: true });
  clearUserAuthCookies(res);
  return res;
}
