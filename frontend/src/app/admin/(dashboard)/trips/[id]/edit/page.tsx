import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { backendFetch, ApiError } from "@/lib/api";
import { ADMIN_ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { TripForm } from "@/components/admin/TripForm";
import { TripImagesManager } from "@/components/admin/TripImagesManager";
import { TripInclusionsManager } from "@/components/admin/TripInclusionsManager";
import type { RaceCategory, TripAdmin } from "@/types/api";

export const dynamic = "force-dynamic";

export default async function EditTripPage({ params: { id } }: { params: { id: string } }) {
  const accessToken = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? "";
  const headers = { Authorization: `Bearer ${accessToken}` };

  let trip: TripAdmin;
  try {
    trip = await backendFetch<TripAdmin>(`/admin/trips/${id}`, { headers, cache: "no-store" });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const raceCategories = await backendFetch<RaceCategory[]>("/race-categories", { headers, cache: "no-store" });

  return (
    <div>
      <h1 className="text-headline-lg">Edit trip</h1>
      <div className="mt-8 space-y-8">
        <TripForm trip={trip} raceCategories={raceCategories} />
        <TripImagesManager tripId={trip.id} images={trip.images} />
        <TripInclusionsManager tripId={trip.id} inclusions={trip.inclusions} />
      </div>
    </div>
  );
}
