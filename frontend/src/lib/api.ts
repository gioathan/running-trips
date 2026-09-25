import type { ApiErrorBody } from "@/types/api";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || body.code);
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

async function parseErrorBody(res: Response): Promise<ApiErrorBody> {
  try {
    return await res.json();
  } catch {
    return { code: "UNKNOWN_ERROR", message: res.statusText };
  }
}

/**
 * Direct server-to-server call to the FastAPI backend. Use from Server
 * Components / route handlers only — never bundled into client JS, so it's
 * safe to hit BACKEND_URL directly (no CORS concern) and to pass Next's
 * `next: { revalidate }` for ISR (BACKEND_PLAN.md's Next.js caching split:
 * public content pages cached, identity/money routes never).
 */
export async function backendFetch<T>(
  path: string,
  init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } }
): Promise<T> {
  const res = await fetch(`${process.env.BACKEND_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new ApiError(res.status, await parseErrorBody(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Client-side call, routed through /api/backend/* (same-origin proxy) so
 * the httpOnly access-token cookie is attached server-side — the browser
 * never sees the token (FRONTEND_PLAN.md §2/§9).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/backend${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
  });
  if (!res.ok) throw new ApiError(res.status, await parseErrorBody(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Same as `apiFetch`, routed through /api/admin-backend/* instead — the
 * admin dashboard's client components use this exclusively, never `apiFetch`. */
export async function adminApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin-backend${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
  });
  if (!res.ok) throw new ApiError(res.status, await parseErrorBody(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
