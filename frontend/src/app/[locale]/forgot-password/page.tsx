"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";

interface FormValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = handleSubmit(async (values) => {
    // Always show the same success state, whether or not the email exists —
    // mirrors the backend's own "don't leak account existence" behavior.
    await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify(values) }).catch(() => {});
    setSubmitted(true);
  });

  return (
    <div className="mx-auto max-w-[440px] py-16">
      <h1 className="text-headline-lg-mobile">{t("pageTitle")}</h1>
      <Card className="mt-8 p-8">
        {submitted ? (
          <p className="text-body-lg">{t("checkYourEmail")}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input id="email" type="email" required {...register("email", { required: true })} />
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
              {t("submit")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
