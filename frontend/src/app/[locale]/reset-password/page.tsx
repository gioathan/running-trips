"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { apiFetch, ApiError } from "@/lib/api";
import { errorMessageKey } from "@/lib/error-messages";

interface FormValues {
  new_password: string;
}

export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const tErr = useTranslations("errors");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, ...values }) });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? tErr(errorMessageKey(err.code)) : tErr("generic"));
    }
  });

  return (
    <div className="mx-auto max-w-[440px] py-16">
      <h1 className="text-headline-lg-mobile">{t("pageTitle")}</h1>
      <Card className="mt-8 p-8">
        {done ? (
          <div>
            <p className="text-body-lg">{t("success")}</p>
            <Link href="/" className="mt-4 inline-block text-body-md underline">
              {t("backToHome")}
            </Link>
          </div>
        ) : !token ? (
          <p className="text-body-md text-error">{t("invalidLink")}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="new_password">{t("newPasswordLabel")}</Label>
              <Input id="new_password" type="password" required minLength={8} {...register("new_password", { required: true, minLength: 8 })} />
            </div>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
              {t("submit")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
