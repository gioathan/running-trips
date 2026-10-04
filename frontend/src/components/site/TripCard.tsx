import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DecorativeSparkline } from "@/components/ui/DecorativeSparkline";
import { formatDateRange } from "@/lib/format-date";
import type { TripListItem } from "@/types/api";

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function TripCard({ trip, locale }: { trip: TripListItem; locale: string }) {
  const t = useTranslations("trips");
  const prices = trip.categories.map((c) => c.price).filter((p) => p > 0);
  const fromPrice = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <Card className="overflow-hidden rounded-2xl shadow-soft-hover">
      <div className="relative">
        <Link href={`/trips/${trip.slug}`} className="block">
          <div className="relative aspect-[4/3] w-full bg-surface-low">
            {trip.cover_image_url && (
              <Image src={trip.cover_image_url} alt={trip.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            )}
            <div className="absolute left-4 top-4 flex gap-2">
              {trip.is_featured && <Chip variant="editorial">{t("featured")}</Chip>}
              {trip.is_full && <Chip variant="highlight">{t("full")}</Chip>}
            </div>
            {fromPrice !== null && (
              <span className="absolute bottom-4 right-4 rounded-full bg-ink px-4 py-1.5 text-label-md text-white shadow-hard">
                {t("fromPrice", { price: fromPrice })}
              </span>
            )}
          </div>
        </Link>

        <div className="p-6">
          <Link href={`/trips/${trip.slug}`} className="block">
            <p className="text-label-sm text-ink-muted">
              {trip.duration_label} · {formatDateRange(trip.start_date, trip.end_date, locale)}
            </p>
            <h3 className="mt-1 text-headline-md">{trip.title}</h3>
            {trip.location_city && (
              <p className="mt-1 text-body-md text-ink-muted">
                {trip.location_city}
                {trip.location_country ? `, ${trip.location_country}` : ""}
              </p>
            )}
            {trip.summary && <p className="mt-3 text-body-md text-ink-muted line-clamp-2">{trip.summary}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {trip.categories.map((c) => (
                <Chip key={c.id} variant="status">
                  {c.race_category.name}
                </Chip>
              ))}
            </div>
            {trip.inclusion_labels.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-body-sm text-ink-muted">
                {trip.inclusion_labels.slice(0, 3).map((label, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckIcon />
                    {label}
                  </li>
                ))}
              </ul>
            )}
            {/* Decorative course-elevation flavor \u2014 not real data, purely visual */}
            <DecorativeSparkline seed={trip.slug} className="mt-4 h-6 w-full text-primary/60" />
          </Link>

          <div className="mt-4 flex items-center gap-3">
            <Link
              href={`/trips/${trip.slug}`}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-primary px-6 text-label-lg uppercase text-ink transition-shadow hover:shadow-hard"
            >
              {t("viewTrip")}
            </Link>
            {trip.is_full && (
              <Link
                href={{ pathname: "/contact", query: { tripId: trip.id } }}
                aria-label={t("notifyWhenAvailable")}
                title={t("notifyWhenAvailable")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink text-ink-muted hover:border-ink hover:text-ink"
              >
                <BellIcon />
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
