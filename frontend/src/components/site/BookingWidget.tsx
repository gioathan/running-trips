"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useAuth } from "@/lib/auth-context";
import { useLoginModal } from "@/lib/login-modal-context";
import { CheckoutModal } from "./CheckoutModal";
import type { TripCategory } from "@/types/api";

export function BookingWidget({
  tripId,
  categories,
  isFull,
}: {
  tripId: number;
  categories: TripCategory[];
  isFull: boolean;
}) {
  const t = useTranslations("tripDetail");
  const { user } = useAuth();
  const { open: openLoginModal } = useLoginModal();
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id);
  const [count, setCount] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId]
  );
  const total = (selectedCategory?.price ?? 0) * count;

  const handleBookNow = () => {
    if (isFull) return;
    if (!user) {
      openLoginModal({ tab: "login", onSuccess: () => setCheckoutOpen(true) });
      return;
    }
    setCheckoutOpen(true);
  };

  if (categories.length === 0) return null;

  return (
    <Card className="sticky top-6 p-6">
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

      {isFull ? (
        <Chip variant="highlight" className="mt-6 w-full justify-center py-3">
          {t("full")}
        </Chip>
      ) : (
        <Button variant="primary" className="mt-6 w-full" onClick={handleBookNow}>
          {t("bookNow")}
        </Button>
      )}

      {selectedCategory && (
        <CheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          tripId={tripId}
          tripCategoryId={selectedCategory.id}
          participantCount={count}
          pricePerPerson={selectedCategory.price}
        />
      )}
    </Card>
  );
}
