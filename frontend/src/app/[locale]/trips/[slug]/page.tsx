import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { localizedAlternates } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { backendFetch, ApiError, qs } from "@/lib/api";
import { Chip } from "@/components/ui/Chip";
import { Reveal } from "@/components/ui/Reveal";
import { BookingWidget } from "@/components/site/BookingWidget";
import { TripGallery } from "@/components/site/TripGallery";
import { TripCard } from "@/components/site/TripCard";
import { formatDateRange } from "@/lib/format-date";
import type { Page, TripCommentPublic, TripDetail, TripListItem } from "@/types/api";

export const revalidate = 60;

async function getTrip(slug: string, locale: string): Promise<TripDetail> {
  try {
    return await backendFetch<TripDetail>(`/trips/${slug}${qs({ locale })}`, { next: { revalidate: 60 } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

const COMMENTS_SHOWN = 12;

async function getComments(slug: string): Promise<Page<TripCommentPublic> | null> {
  // Non-essential — the trip page still renders if this fails.
  return backendFetch<Page<TripCommentPublic>>(`/trips/${slug}/comments${qs({ page_size: COMMENTS_SHOWN })}`, {
    next: { revalidate: 60 },
  }).catch(() => null);
}

const RELATED_SHOWN = 3;

/** The "More trips" row: upcoming trips that can still be booked (not full),
 * minus this one. Featured trips (the admin's home-page picks) if there are
 * any; otherwise ordinary upcoming trips, so the row isn't left empty just
 * because nothing is featured. */
async function getRelatedTrips(trip: TripDetail, locale: string): Promise<TripListItem[]> {
  const bookableUpcoming = (featured: boolean) =>
    backendFetch<Page<TripListItem>>(
      // More than we show: this trip and any full ones are dropped below.
      `/trips${qs({ status: "upcoming", featured: featured || undefined, page_size: 12, locale })}`,
      { next: { revalidate: 300 } }
    )
      .then((page) => page.items.filter((t) => t.id !== trip.id && !t.is_full).slice(0, RELATED_SHOWN))
      .catch(() => [] as TripListItem[]);

  const featured = await bookableUpcoming(true);
  return featured.length > 0 ? featured : bookableUpcoming(false);
}

export async function generateMetadata({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const trip = await getTrip(slug, locale); // same request as the page's — deduped by Next's fetch cache
  const description = trip.meta_description || trip.summary || undefined;
  const images = trip.cover_image_url ? [{ url: trip.cover_image_url, alt: trip.title }] : undefined;
  return {
    title: trip.title,
    description,
    alternates: localizedAlternates(locale, `/trips/${trip.slug}`),
    openGraph: { title: trip.title, description, images },
    twitter: { card: images ? "summary_large_image" : "summary", title: trip.title, description },
  };
}

export default async function TripDetailPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(locale);
  const [trip, comments] = await Promise.all([getTrip(slug, locale), getComments(slug)]);
  const related = await getRelatedTrips(trip, locale);
  const t = await getTranslations("tripDetail");
  // Mirrors the backend's create_booking check (no bookings once the trip
  // has started); compared as ISO date strings, both YYYY-MM-DD.
  const isBookable = trip.start_date >= new Date().toISOString().slice(0, 10);

  return (
    <div className="py-10 md:py-16">
      <div className="flex flex-wrap gap-2">
        {trip.categories.map((c) => (
          <Chip key={c.id} variant="status">
            {c.race_category.name}
          </Chip>
        ))}
        {trip.is_full && <Chip variant="highlight">{t("full")}</Chip>}
      </div>
      <h1 className="mt-4 text-headline-lg-mobile md:text-headline-lg">{trip.title}</h1>
      <p className="mt-2 text-body-lg text-ink-muted">
        {formatDateRange(trip.start_date, trip.end_date, locale)}
        {" · "}
        {trip.duration_label}
        {trip.location_city ? ` · ${trip.location_city}${trip.location_country ? `, ${trip.location_country}` : ""}` : ""}
      </p>

      {/* Grid starts at the gallery so the sticky price card's top aligns with the images, not the title */}
      <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[2fr_1fr] lg:gap-10">
        <div>
          {trip.images.length > 0 && (
            <Reveal>
              <TripGallery images={trip.images} />
            </Reveal>
          )}

          {trip.description && (
            <Reveal className="mt-10 max-w-[720px] whitespace-pre-line text-body-lg text-ink-muted">{trip.description}</Reveal>
          )}

          {trip.inclusion_labels.length > 0 && (
            <Reveal className="mt-10">
              <h2 className="text-headline-sm">{t("included")}</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {trip.inclusion_labels.map((label, i) => (
                  <li key={i} className="flex items-start gap-2 text-body-md text-ink-muted">
                    <span aria-hidden>✓</span>
                    {label}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {comments && comments.total > 0 && (
            <Reveal className="mt-10">
              <h2 className="text-headline-sm">{t("commentsHeadline")}</h2>
              <p className="mt-1 text-body-sm text-ink-muted">{t("commentsCount", { count: comments.total })}</p>
              <ul className="mt-4 space-y-4">
                {comments.items.map((comment) => (
                  <li key={comment.id} className="rounded-md border border-ink/10 bg-white p-4">
                    <p className="whitespace-pre-line text-body-md">{comment.body}</p>
                    <p className="mt-2 text-label-sm uppercase text-ink-muted">
                      {comment.author_name} ·{" "}
                      {new Date(comment.created_at).toLocaleDateString(locale, { month: "short", year: "numeric" })}
                    </p>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>

        {/* First on phones (race choice under the title), sidebar from lg up. */}
        <div className="order-first lg:order-none">
          <BookingWidget tripId={trip.id} categories={trip.categories} isFull={trip.is_full} isBookable={isBookable} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-headline-md">{t("relatedHeadline")}</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <TripCard key={item.id} trip={item} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
