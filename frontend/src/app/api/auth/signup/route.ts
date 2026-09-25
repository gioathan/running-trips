import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/api";
import { errorResponse } from "@/lib/api-server";
import { setUserAuthCookies } from "@/lib/auth-server";
import type { AuthResponse } from "@/types/api";

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const data = await backendFetch<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const res = NextResponse.json({ user: data.user });
    setUserAuthCookies(res, data.tokens, false);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
