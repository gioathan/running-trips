import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { TripListItem } from "@/types/api";

export function TripCard({ trip }: { trip: TripListItem }) {
  return (
    <Card className="overflow-hidden shadow-hard-hover">
      <Link href={`/trips/${trip.slug}`} className="block">
        <div className="relative aspect-[4/3] w-full bg-surface-low">
          {trip.cover_image_url && (
            <Image src={trip.cover_image_url} alt={trip.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
          )}
          <div className="absolute left-4 top-4 flex gap-2">
            {trip.is_featured && <Chip variant="editorial">Featured</Chip>}
            {trip.is_full && <Chip variant="highlight">Full</Chip>}
          </div>
        </div>
        <div className="p-6">
          <p className="text-label-sm text-ink-muted">{trip.duration_label}</p>
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
            <ul className="mt-4 space-y-1 text-body-sm text-ink-muted">
              {trip.inclusion_labels.slice(0, 3).map((label, i) => (
                <li key={i}>· {label}</li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </Card>
  );
}
