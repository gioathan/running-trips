import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { clearAdminAuthCookies } from "@/lib/auth-server";
import { ADMIN_REFRESH_TOKEN_COOKIE } from "@/lib/cookies";

export async function POST() {
  const refreshToken = cookies().get(ADMIN_REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    try {
      await backendFetch("/admin/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // best-effort, same as /api/auth/logout
    }
  }
  const res = NextResponse.json({ ok: true });
  clearAdminAuthCookies(res);
  return res;
}
