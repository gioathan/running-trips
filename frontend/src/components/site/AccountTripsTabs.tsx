"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import { formatDateRange } from "@/lib/format-date";
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
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div>
      <div className="flex rounded-full bg-surface-low p-1 sm:w-fit">
        {(["upcoming", "past"] as const).map((value) => (
          <button
            key={value}
            type="button"
            // replace: switching tabs shouldn't add a Back-button step
            onClick={() => router.replace(`${pathname}?status=${value}`, { scroll: false })}
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
            <Card key={booking.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-low">
                {booking.trip.cover_image_url && (
                  <Image src={booking.trip.cover_image_url} alt={booking.trip.title} fill className="object-cover" sizes="64px" />
                )}
              </div>
              <div className="flex-1">
                {booking.trip.deleted ? (
                  // The trip was deleted: the booking stays in the customer's
                  // history, but its page is gone, so no link.
                  <>
                    <p className="text-headline-sm">{booking.trip.title}</p>
                    <p className="text-label-sm uppercase text-ink-muted">{t("tripRemoved")}</p>
                  </>
                ) : (
                  <Link href={`/trips/${booking.trip.slug}`} className="text-headline-sm hover:text-primary">
                    {booking.trip.title}
                  </Link>
                )}
                <p className="text-body-sm text-ink-muted">
                  {formatDateRange(booking.trip.start_date, booking.trip.end_date, locale)} · {booking.participant_count}{" "}
                  {t("participants")}
                </p>
              </div>
              <Chip variant={STATUS_CHIP_VARIANT[booking.status]}>{t(`status.${booking.status}`)}</Chip>
              {booking.payment_url && (
                // Own full-width row (the card wraps) so it doesn't squeeze the title on phones.
                <div className="flex basis-full flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-ink/10 pt-3">
                  <p className="text-body-sm text-ink-muted">
                    {t("bookingRef", { id: booking.id })}
                    {booking.payment_due_at &&
                      ` · ${t("paymentDue", {
                        due: new Date(booking.payment_due_at).toLocaleDateString(locale, { dateStyle: "medium" }),
                      })}`}
                  </p>
                  <a
                    href={booking.payment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-label-md uppercase text-ink underline hover:text-primary"
                  >
                    {t("completePayment")}
                  </a>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
