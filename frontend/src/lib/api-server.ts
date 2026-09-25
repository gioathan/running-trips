import "server-only";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api";

/** Turns a caught error from `backendFetch` into the same
 * `{code, message, details}` envelope the backend itself returns
 * (BACKEND_PLAN.md §9), so route handlers don't each reconstruct it
 * (and don't accidentally JSON.stringify an Error instance directly —
 * `message` isn't an enumerable own property, so it silently drops). */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ code: err.code, message: err.message, details: err.details }, { status: err.status });
  }
  return NextResponse.json({ code: "UNKNOWN_ERROR", message: "Unexpected server error" }, { status: 500 });
}
