"use client";

import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/lib/toast-context";
import { apiFetch, ApiError } from "@/lib/api";
import { errorMessageKey } from "@/lib/error-messages";
import { E164_PATTERN } from "@/lib/phone";
import type { UserPublic } from "@/types/api";

interface FormValues {
  full_name: string;
  phone: string;
}

export function BasicInfoForm({ initial }: { initial: UserPublic }) {
  const t = useTranslations("profile");
  const tErr = useTranslations("errors");
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // Start from what's saved. The phone used to start blank every time, so
    // saving anything on this card erased the number on the account.
    defaultValues: { full_name: initial.full_name ?? "", phone: initial.phone ?? "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: values.full_name.trim() || null, phone: values.phone || null }),
      });
      showToast(t("saveSuccess"));
    } catch (err) {
      showToast(err instanceof ApiError ? tErr(errorMessageKey(err.code)) : tErr("generic"), "error");
    }
  });

  return (
    <Card className="p-8">
      <h2 className="text-headline-sm">{t("basicInfo")}</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {/* The sign-in address: shown so it's clear which account this is, not editable here. */}
          <p className="mb-1 text-label-md uppercase text-ink-muted">{t("email")}</p>
          <p className="break-all rounded-md border border-ink/20 bg-surface-low px-[17px] py-[10px] text-body-lg text-ink-muted">
            {initial.email}
          </p>
          <p className="mt-1 text-body-sm text-ink-muted">{t("emailHint")}</p>
        </div>
        <div>
          <Label htmlFor="full_name">{t("fullName")}</Label>
          <Input id="full_name" autoComplete="name" maxLength={255} {...register("full_name")} />
        </div>
        <div>
          <Label htmlFor="phone">{t("phone")}</Label>
          {/* Country code + number, stored the way the booking form expects it. */}
          <Controller
            control={control}
            name="phone"
            rules={{ validate: (value) => !value || E164_PATTERN.test(value) || t("phoneInvalid") }}
            render={({ field }) => <PhoneInput id="phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
          />
          <FieldError>{errors.phone?.message}</FieldError>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
