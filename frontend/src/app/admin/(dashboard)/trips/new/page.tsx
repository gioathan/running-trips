import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { TripForm } from "@/components/admin/TripForm";
import type { RaceCategory } from "@/types/api";

export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const raceCategories = await backendFetch<RaceCategory[]>("/race-categories", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return (
    <div>
      <h1 className="text-headline-lg">New trip</h1>
      <div className="mt-8">
        <TripForm raceCategories={raceCategories} />
      </div>
    </div>
  );
}
