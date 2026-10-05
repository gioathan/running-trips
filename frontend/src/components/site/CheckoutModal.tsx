"use client";

import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Feedback";
import { apiFetch, ApiError } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { errorMessageKey } from "@/lib/error-messages";
import { useAuth } from "@/lib/auth-context";
import { E164_PATTERN } from "@/lib/phone";
import {
  BookingDetailsForm,
  emptyBookingDetails,
  type BookingDetails,
  type BookingDetailsValues,
} from "./BookingDetailsForm";
import type { CreateIntentResponse, Booking, Gender, ShirtSize, TravelProfile, UserPublic } from "@/types/api";

const SHIRT_SIZES: ShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: number;
  tripCategoryId: number;
  participantCount: number;
  pricePerPerson: number;
}

function PaymentStep({ clientSecret, bookingId, onSuccess }: { clientSecret: string; bookingId: number; onSuccess: () => void }) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPay = async () => {
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    setError(null);
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/${locale}/account?booking=${bookingId}` },
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message ?? t("paymentFailed"));
      setIsSubmitting(false);
      return;
    }
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <PaymentElement />
      {error && <FieldError>{error}</FieldError>}
      <Button type="button" variant="primary" className="w-full" onClick={onPay} disabled={!stripe || isSubmitting}>
        {isSubmitting ? <Spinner /> : t("pay")}
      </Button>
    </div>
  );
}

export function CheckoutModal({ open, onOpenChange, tripId, tripCategoryId, participantCount, pricePerPerson }: CheckoutModalProps) {
  const t = useTranslations("checkout");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [step, setStep] = useState<"participants" | "payment" | "external" | "success">("participants");
  // Set when the site is in external-payment mode: the booking is recorded
  // and the customer pays through this link instead of Stripe.
  const [externalBooking, setExternalBooking] = useState<Booking | null>(null);
  const [intent, setIntent] = useState<CreateIntentResponse | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const locale = useLocale();
  // The booker is usually participant 1: start from their account and saved
  // travel profile instead of a blank form. null = still loading.
  const [prefill, setPrefill] = useState<BookingDetailsValues | null>(null);

  useEffect(() => {
    if (!open || prefill) return;
    const base = emptyBookingDetails();
    base.contact_email = user?.email ?? "";
    base.participants[0].full_name = user?.full_name ?? "";

    // Neither lookup is essential — whatever fails just isn't prefilled.
    Promise.all([
      apiFetch<UserPublic>("/users/me").catch(() => null),
      apiFetch<TravelProfile>("/users/me/travel-profile").catch(() => null),
    ]).then(([account, profile]) => {
      const validPhone = (value: string | null | undefined) => (value && E164_PATTERN.test(value) ? value : "");
      const shirt = (profile?.shirt_size ?? "").toUpperCase();
      setPrefill({
        ...base,
        contact_phone: validPhone(account?.phone),
        emergency_contact_name: profile?.emergency_contact_name ?? "",
        emergency_contact_phone: validPhone(profile?.emergency_contact_phone),
        participants: [
          {
            ...base.participants[0],
            date_of_birth: profile?.date_of_birth ?? "",
            gender: "" as Gender | "",
            nationality: profile?.nationality ?? "",
            shirt_size: (SHIRT_SIZES.includes(shirt as ShirtSize) ? shirt : "") as ShirtSize | "",
          },
        ],
      });
    });
  }, [open, prefill, user]);

  const handleDetails = async (details: BookingDetails) => {
    setError(null);
    try {
      const booking = await apiFetch<Booking>("/bookings", {
        method: "POST",
        body: JSON.stringify({ trip_id: tripId, trip_category_id: tripCategoryId, ...details }),
      });
      setBookingId(booking.id);
      if (booking.payment_method === "external") {
        setExternalBooking(booking);
        setStep("external");
        return;
      }
      const createdIntent = await apiFetch<CreateIntentResponse>("/payments/create-intent", {
        method: "POST",
        body: JSON.stringify({ booking_id: booking.id }),
      });
      setIntent(createdIntent);
      setStep("payment");
    } catch (err) {
      setError(err instanceof ApiError ? tErr(errorMessageKey(err.code)) : tErr("generic"));
    }
  };

  // The booking is already saved either way — My Trips shows it with its
  // payment link.
  const goToAccount = () => {
    onOpenChange(false);
    router.push("/account");
  };

  const handleSuccess = () => {
    setStep("success");
    setTimeout(() => {
      onOpenChange(false);
      router.push("/account");
    }, 1500);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("modalTitle")}>
      <p className="mb-6 text-body-md text-ink-muted">
        {t("totalDue", { total: ((pricePerPerson * participantCount * 100) / 100).toFixed(2) })}
      </p>
      {error && <FieldError>{error}</FieldError>}
      {step === "participants" &&
        (prefill ? (
          <BookingDetailsForm participantCount={participantCount} prefill={prefill} onSubmit={handleDetails} />
        ) : (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ))}
      {step === "payment" && intent && bookingId && (
        <Elements stripe={getStripe()} options={{ clientSecret: intent.client_secret }}>
          <PaymentStep clientSecret={intent.client_secret} bookingId={bookingId} onSuccess={handleSuccess} />
        </Elements>
      )}
      {step === "external" && externalBooking?.payment_url && (
        <div className="space-y-6">
          <div>
            <p className="text-headline-sm">{t("externalHeadline")}</p>
            <p className="mt-2 text-body-md text-ink-muted">
              {t("externalBody", {
                id: externalBooking.id,
                due: externalBooking.payment_due_at
                  ? new Date(externalBooking.payment_due_at).toLocaleDateString(locale, { dateStyle: "long" })
                  : "",
              })}
            </p>
          </div>
          {/* A real link (not window.open after an await) so popup blockers don't swallow it. */}
          <a
            href={externalBooking.payment_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={goToAccount}
            className="flex h-12 w-full items-center justify-center rounded-full bg-primary px-8 text-label-lg uppercase text-ink transition-shadow hover:shadow-hard"
          >
            {t("externalCta")}
          </a>
          <Button type="button" variant="ghost" className="w-full" onClick={goToAccount}>
            {t("externalLater")}
          </Button>
        </div>
      )}
      {step === "success" && <p className="text-body-lg">{t("success")}</p>}
    </Modal>
  );
}
