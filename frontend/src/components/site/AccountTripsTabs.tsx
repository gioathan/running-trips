"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import type { Booking } from "@/types/api";

const STATUS_CHIP_VARIANT: Record<Booking["status"], "status" | "highlight" | "editorial" | "outline"> = {
  pending: "outline",
  awaiting_payment: "outline",
  confirmed: "editorial",
  cancelled: "outline",
  refunded: "outline",
};

export function AccountTripsTabs({ status, bookings }: { status: "upcoming" | "past"; bookings: Booking[] }) {
  const t = useTranslations("account");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div>
      <div className="flex rounded-full bg-surface-low p-1 sm:w-fit">
        {(["upcoming", "past"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => router.push(`${pathname}?status=${value}`)}
            className={cn(
              "flex-1 rounded-full px-6 py-2 text-label-lg uppercase sm:flex-none",
              status === value ? "bg-white shadow-hard" : "text-ink-muted"
            )}
          >
            {t(value)}
          </button>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.id} className="flex items-center gap-4 p-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-low">
                {booking.trip.cover_image_url && (
                  <Image src={booking.trip.cover_image_url} alt={booking.trip.title} fill className="object-cover" sizes="64px" />
                )}
              </div>
              <div className="flex-1">
                <Link href={`/trips/${booking.trip.slug}`} className="text-headline-sm hover:text-primary">
                  {booking.trip.title}
                </Link>
                <p className="text-body-sm text-ink-muted">
                  {booking.trip.start_date} · {booking.participant_count} {t("participants")}
                </p>
              </div>
              <Chip variant={STATUS_CHIP_VARIANT[booking.status]}>{t(`status.${booking.status}`)}</Chip>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
