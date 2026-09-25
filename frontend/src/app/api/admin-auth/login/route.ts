import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/api";
import { errorResponse } from "@/lib/api-server";
import { setAdminAuthCookies } from "@/lib/auth-server";

interface AdminAuthResponse {
  user: { id: number; email: string; full_name: string | null; role: string };
  tokens: { access_token: string; refresh_token: string; token_type: string };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const data = await backendFetch<AdminAuthResponse>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const res = NextResponse.json({ user: data.user });
    setAdminAuthCookies(res, data.tokens);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
