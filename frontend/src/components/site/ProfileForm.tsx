"use client";

import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/lib/toast-context";
import { apiFetch, ApiError } from "@/lib/api";
import { errorMessageKey } from "@/lib/error-messages";
import type { TravelProfile } from "@/types/api";

interface ProfileFormValues {
  date_of_birth: string;
  nationality: string;
  passport_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  shirt_size: string;
}

export function ProfileForm({ initial }: { initial: TravelProfile }) {
  const t = useTranslations("profile");
  const tErr = useTranslations("errors");
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProfileFormValues>({
    defaultValues: {
      date_of_birth: initial.date_of_birth ?? "",
      nationality: initial.nationality ?? "",
      passport_number: initial.passport_number ?? "",
      emergency_contact_name: initial.emergency_contact_name ?? "",
      emergency_contact_phone: initial.emergency_contact_phone ?? "",
      shirt_size: initial.shirt_size ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch("/users/me/travel-profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...values,
          date_of_birth: values.date_of_birth || null,
        }),
      });
      showToast(t("saveSuccess"));
    } catch (err) {
      showToast(err instanceof ApiError ? tErr(errorMessageKey(err.code)) : tErr("generic"), "error");
    }
  });

  return (
    <Card className="p-8">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="dob">{t("dateOfBirth")}</Label>
          <Input id="dob" type="date" {...register("date_of_birth")} />
        </div>
        <div>
          <Label htmlFor="nationality">{t("nationality")}</Label>
          <Input id="nationality" {...register("nationality")} />
        </div>
        <div>
          <Label htmlFor="passport">{t("passportNumber")}</Label>
          <Input id="passport" {...register("passport_number")} />
        </div>
        <div>
          <Label htmlFor="shirt">{t("shirtSize")}</Label>
          <Input id="shirt" placeholder="M" {...register("shirt_size")} />
        </div>
        <div>
          <Label htmlFor="ec_name">{t("emergencyContactName")}</Label>
          <Input id="ec_name" {...register("emergency_contact_name")} />
        </div>
        <div>
          <Label htmlFor="ec_phone">{t("emergencyContactPhone")}</Label>
          <Input id="ec_phone" {...register("emergency_contact_phone")} />
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
