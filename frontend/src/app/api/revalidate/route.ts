import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/** Called by the backend right after an admin content save
 * (FRONTEND_PLAN.md §9) so the change shows up immediately instead of
 * waiting out the ISR window. Body: { secret, path }. */
export async function POST(req: NextRequest) {
  const { secret, path } = await req.json();

  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid revalidate secret" }, { status: 401 });
  }
  if (!path || typeof path !== "string") {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "path is required" }, { status: 400 });
  }

  revalidatePath(path);
  return NextResponse.json({ revalidated: true, path });
}
