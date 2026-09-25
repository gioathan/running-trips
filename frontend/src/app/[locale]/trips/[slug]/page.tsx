import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { backendFetch, ApiError, qs } from "@/lib/api";
import { Chip } from "@/components/ui/Chip";
import { BookingWidget } from "@/components/site/BookingWidget";
import type { TripDetail } from "@/types/api";

export const revalidate = 60;

async function getTrip(slug: string, locale: string): Promise<TripDetail> {
  try {
    return await backendFetch<TripDetail>(`/trips/${slug}${qs({ locale })}`, { next: { revalidate: 60 } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export default async function TripDetailPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(locale);
  const trip = await getTrip(slug, locale);

  return (
    <div className="py-10 md:py-16">
      <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="flex flex-wrap gap-2">
            {trip.categories.map((c) => (
              <Chip key={c.id} variant="status">
                {c.race_category.name}
              </Chip>
            ))}
            {trip.is_full && <Chip variant="highlight">Full</Chip>}
          </div>
          <h1 className="mt-4 text-headline-lg-mobile md:text-headline-lg">{trip.title}</h1>
          <p className="mt-2 text-body-lg text-ink-muted">
            {trip.duration_label}
            {trip.location_city ? ` · ${trip.location_city}${trip.location_country ? `, ${trip.location_country}` : ""}` : ""}
          </p>

          {trip.images.length > 0 && (
            <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {trip.images.map((url, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-md border border-ink first:col-span-2 first:row-span-2 first:aspect-square">
                  <Image src={url} alt="" fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
                </div>
              ))}
            </div>
          )}

          {trip.description && (
            <div className="mt-10 max-w-[720px] whitespace-pre-line text-body-lg text-ink-muted">{trip.description}</div>
          )}

          {trip.inclusion_labels.length > 0 && (
            <div className="mt-10">
              <h2 className="text-headline-sm">Included</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {trip.inclusion_labels.map((label, i) => (
                  <li key={i} className="flex items-start gap-2 text-body-md text-ink-muted">
                    <span aria-hidden>✓</span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <BookingWidget tripId={trip.id} categories={trip.categories} isFull={trip.is_full} />
        </div>
      </div>
    </div>
  );
}
