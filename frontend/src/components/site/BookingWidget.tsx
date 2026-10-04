"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth-context";
import { useLoginModal } from "@/lib/login-modal-context";
import { CheckoutModal } from "./CheckoutModal";
import type { TripCategory } from "@/types/api";

/**
 * Desktop (lg+): a sticky card in the sidebar column. Below lg: a fixed bar
 * pinned above the mobile bottom nav (price + CTA) that opens the same
 * controls in a bottom sheet (FRONTEND_PLAN.md §7). One set of state drives
 * both, and the checkout modal is rendered once.
 */
export function BookingWidget({
  tripId,
  categories,
  isFull,
  isBookable,
}: {
  tripId: number;
  categories: TripCategory[];
  isFull: boolean;
  /** False once the trip has started — the backend rejects bookings then too. */
  isBookable: boolean;
}) {
  const t = useTranslations("tripDetail");
  const tTrips = useTranslations("trips");
  const { user } = useAuth();
  const { open: openLoginModal } = useLoginModal();
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id);
  const [count, setCount] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId]
  );
  const total = (selectedCategory?.price ?? 0) * count;
  const fromPrice = Math.min(...categories.map((c) => c.price));

  const handleBookNow = () => {
    if (isFull || !isBookable) return;
    setSheetOpen(false); // never stack the checkout/login dialog on top of the sheet
    if (!user) {
      openLoginModal({ tab: "login", onSuccess: () => setCheckoutOpen(true) });
      return;
    }
    setCheckoutOpen(true);
  };

  if (categories.length === 0) return null;

  const status = !isBookable ? (
    <Chip variant="status" className="w-full justify-center py-3">
      {t("bookingClosed")}
    </Chip>
  ) : isFull ? (
    <Chip variant="highlight" className="w-full justify-center py-3">
      {t("full")}
    </Chip>
  ) : null;

  const controls = (
    <>
      <p className="text-label-md uppercase text-ink-muted">{t("selectCategory")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategoryId(c.id)}
            className={
              c.id === selectedCategory?.id
                ? "rounded-full border border-ink bg-ink px-4 py-1 text-label-md uppercase text-white"
                : "rounded-full border border-ink/30 px-4 py-1 text-label-md uppercase text-ink-muted"
            }
          >
            {c.race_category.name} — €{c.price}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-label-md uppercase text-ink-muted">{t("participants")}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            className="h-8 w-8 rounded-full border border-ink"
            aria-label={t("decrease")}
          >
            −
          </button>
          <span className="w-6 text-center">{count}</span>
          <button
            type="button"
            onClick={() => setCount((c) => Math.min(selectedCategory?.capacity ?? 20, c + 1))}
            className="h-8 w-8 rounded-full border border-ink"
            aria-label={t("increase")}
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-4">
        <p className="text-body-md text-ink-muted">{t("total")}</p>
        <p className="text-headline-md">€{total.toFixed(2)}</p>
      </div>

      <div className="mt-6">
        {status ?? (
          <Button variant="primary" className="w-full" onClick={handleBookNow}>
            {t("bookNow")}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* top-20 clears the sticky header's shrunk height so none of the card hides behind it */}
      <Card className="sticky top-20 hidden p-6 lg:block">{controls}</Card>

      {/* bottom-16 sits on top of MobileBottomNav (h-16, below md); from md up there's no bottom nav */}
      <div
        data-mobile-booking-bar
        className="fixed inset-x-0 bottom-16 z-30 flex items-center justify-between gap-4 border-t border-ink/10 bg-white px-4 py-3 shadow-hard md:bottom-0 lg:hidden"
      >
        <p className="text-label-lg uppercase">{tTrips("fromPrice", { price: fromPrice })}</p>
        {status ? (
          <div className="w-40">{status}</div>
        ) : (
          <Button variant="primary" size="sm" onClick={() => setSheetOpen(true)}>
            {t("bookNow")}
          </Button>
        )}
      </div>
      <Modal open={sheetOpen} onOpenChange={setSheetOpen} title={t("bookNow")} variant="sheet">
        {controls}
      </Modal>

      {selectedCategory && (
        <CheckoutModal
          // Keyed on the selection: changing race or headcount starts a fresh
          // checkout, while closing and reopening with the same selection
          // resumes the existing booking/PaymentIntent instead of creating a
          // new booking each time.
          key={`${selectedCategory.id}-${count}`}
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          tripId={tripId}
          tripCategoryId={selectedCategory.id}
          participantCount={count}
          pricePerPerson={selectedCategory.price}
        />
      )}
    </>
  );
}
