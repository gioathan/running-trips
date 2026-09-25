import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/api";
import { errorResponse } from "@/lib/api-server";
import { setUserAuthCookies } from "@/lib/auth-server";
import type { AuthResponse } from "@/types/api";

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const data = await backendFetch<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const res = NextResponse.json({ user: data.user });
    // Google sign-in is treated as a "remember me" session — matches
    // BACKEND_PLAN.md's own issue_tokens(..., remember_me=True) for Google.
    setUserAuthCookies(res, data.tokens, true);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
