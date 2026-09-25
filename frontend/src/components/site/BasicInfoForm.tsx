"use client";

import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/lib/toast-context";
import { apiFetch, ApiError } from "@/lib/api";
import { errorMessageKey } from "@/lib/error-messages";
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
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: { full_name: initial.full_name ?? "", phone: "" } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch("/users/me", { method: "PATCH", body: JSON.stringify(values) });
      showToast(t("saveSuccess"));
    } catch (err) {
      showToast(err instanceof ApiError ? tErr(errorMessageKey(err.code)) : tErr("generic"), "error");
    }
  });

  return (
    <Card className="p-8">
      <h2 className="text-headline-sm">{t("basicInfo")}</h2>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="full_name">{t("fullName")}</Label>
          <Input id="full_name" {...register("full_name")} />
        </div>
        <div>
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" type="tel" {...register("phone")} />
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
