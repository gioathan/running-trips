"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label, Textarea, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth-context";
import { useLoginModal } from "@/lib/login-modal-context";
import { useToast } from "@/lib/toast-context";
import { apiFetch, ApiError } from "@/lib/api";
import { errorMessageKey } from "@/lib/error-messages";

interface ContactFormValues {
  message: string;
}

const INQUIRY_TYPES = ["general", "booking", "custom_trip", "press"] as const;

export function ContactForm() {
  const t = useTranslations("contact");
  const tErr = useTranslations("errors");
  const { user } = useAuth();
  const { open: openLoginModal } = useLoginModal();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const tripIdParam = searchParams.get("tripId");
  const tripId = tripIdParam ? Number(tripIdParam) : undefined;
  const [inquiryType, setInquiryType] = useState<(typeof INQUIRY_TYPES)[number]>(tripId ? "booking" : "general");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>();

  if (!user) {
    return (
      <Card className="rounded-2xl p-8 text-center">
        <p className="text-headline-sm">{t("signInToSend")}</p>
        <Button variant="primary" className="mt-6" onClick={() => openLoginModal({ tab: "login" })}>
          {t("logInCta")}
        </Button>
      </Card>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch("/contact", {
        method: "POST",
        body: JSON.stringify({ inquiry_type: inquiryType, trip_id: tripId ?? null, message: values.message }),
      });
      showToast(t("sendSuccess"));
      reset();
    } catch (err) {
      showToast(err instanceof ApiError ? tErr(errorMessageKey(err.code)) : tErr("generic"), "error");
    }
  });

  return (
    <Card className="rounded-2xl p-8">
      <h2 className="text-headline-sm">{t("formHeadline")}</h2>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {tripId && (
          <div className="rounded-full bg-surface-low px-4 py-2 text-label-md uppercase text-ink-muted">{t("regardingTrip", { id: tripId })}</div>
        )}
        <div>
          <Label htmlFor="inquiry-type">{t("inquiryType")}</Label>
          <Select
            value={inquiryType}
            onValueChange={(v) => setInquiryType(v as (typeof INQUIRY_TYPES)[number])}
            options={INQUIRY_TYPES.map((v) => ({ value: v, label: t(`inquiryTypes.${v}`) }))}
          />
        </div>
        <div>
          <Label htmlFor="message">{t("message")}</Label>
          <Textarea id="message" required {...register("message", { required: true })} />
          <FieldError>{errors.message ? t("messageRequired") : undefined}</FieldError>
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {t("send")}
        </Button>
      </form>
    </Card>
  );
}
