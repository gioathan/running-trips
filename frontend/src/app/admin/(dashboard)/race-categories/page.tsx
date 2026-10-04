import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { RaceCategoryManager } from "@/components/admin/RaceCategoryManager";
import type { RaceCategoryAdmin } from "@/types/api";

export const dynamic = "force-dynamic";

export default async function AdminRaceCategoriesPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const categories = await backendFetch<RaceCategoryAdmin[]>("/admin/race-categories", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return <RaceCategoryManager categories={categories} />;
}
