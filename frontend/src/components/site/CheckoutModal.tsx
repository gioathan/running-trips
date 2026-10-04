"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Feedback";
import { apiFetch, ApiError } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { errorMessageKey } from "@/lib/error-messages";
import { useAuth } from "@/lib/auth-context";
import type { CreateIntentResponse, Booking, TravelProfile } from "@/types/api";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: number;
  tripCategoryId: number;
  participantCount: number;
  pricePerPerson: number;
}

interface ParticipantForm {
  full_name: string;
  nationality?: string;
  shirt_size?: string;
}

function ParticipantsStep({
  participantCount,
  prefill,
  onSubmit,
}: {
  participantCount: number;
  /** Participant 1's starting values — the signed-in user's own details. */
  prefill: ParticipantForm;
  onSubmit: (participants: ParticipantForm[]) => void;
}) {
  const t = useTranslations("checkout");
  const { control, register, handleSubmit } = useForm<{ participants: ParticipantForm[] }>({
    defaultValues: {
      participants: Array.from({ length: participantCount }, (_, i) => (i === 0 ? prefill : { full_name: "" })),
    },
  });
  const { fields } = useFieldArray({ control, name: "participants" });

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values.participants))} className="space-y-6">
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-3 border-b border-ink/10 pb-6 last:border-0">
          <p className="text-label-md uppercase text-ink-muted">
            {t("participant")} {index + 1}
          </p>
          <div>
            <Label htmlFor={`full_name_${index}`}>{t("fullName")}</Label>
            <Input id={`full_name_${index}`} required {...register(`participants.${index}.full_name` as const, { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`nationality_${index}`}>{t("nationality")}</Label>
              <Input id={`nationality_${index}`} {...register(`participants.${index}.nationality` as const)} />
            </div>
            <div>
              <Label htmlFor={`shirt_${index}`}>{t("shirtSize")}</Label>
              <Input id={`shirt_${index}`} placeholder="M" {...register(`participants.${index}.shirt_size` as const)} />
            </div>
          </div>
        </div>
      ))}
      <Button type="submit" variant="primary" className="w-full">
        {t("continueToPayment")}
      </Button>
    </form>
  );
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
  const [step, setStep] = useState<"participants" | "payment" | "success">("participants");
  const [intent, setIntent] = useState<CreateIntentResponse | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  // Participant 1 is usually the person booking: start from their name and
  // saved travel profile instead of a blank form. null = still loading.
  const [prefill, setPrefill] = useState<ParticipantForm | null>(null);

  useEffect(() => {
    if (!open || prefill) return;
    const base: ParticipantForm = { full_name: user?.full_name ?? "" };
    apiFetch<TravelProfile>("/users/me/travel-profile")
      .then((profile) =>
        setPrefill({ ...base, nationality: profile.nationality ?? "", shirt_size: profile.shirt_size ?? "" })
      )
      .catch(() => setPrefill(base)); // not essential — fall back to just the name
  }, [open, prefill, user]);

  const handleParticipants = async (participants: ParticipantForm[]) => {
    setError(null);
    try {
      const booking = await apiFetch<Booking>("/bookings", {
        method: "POST",
        body: JSON.stringify({ trip_id: tripId, trip_category_id: tripCategoryId, participants }),
      });
      setBookingId(booking.id);
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
          <ParticipantsStep participantCount={participantCount} prefill={prefill} onSubmit={handleParticipants} />
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
      {step === "success" && <p className="text-body-lg">{t("success")}</p>}
    </Modal>
  );
}
