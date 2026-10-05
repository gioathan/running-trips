"use client";

import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, NativeSelect } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/lib/toast-context";
import { apiFetch, ApiError } from "@/lib/api";
import { errorMessageKey } from "@/lib/error-messages";
import { E164_PATTERN } from "@/lib/phone";
import type { ShirtSize, TravelProfile } from "@/types/api";

// The same choices as the booking form, so what's saved here can be reused there.
const SHIRT_SIZES: ShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

interface ProfileFormValues {
  date_of_birth: string;
  nationality: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  shirt_size: string;
}

export function ProfileForm({ initial }: { initial: TravelProfile }) {
  const t = useTranslations("profile");
  const tErr = useTranslations("errors");
  const { showToast } = useToast();
  const savedShirt = (initial.shirt_size ?? "").toUpperCase();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    defaultValues: {
      date_of_birth: initial.date_of_birth ?? "",
      nationality: initial.nationality ?? "",
      emergency_contact_name: initial.emergency_contact_name ?? "",
      emergency_contact_phone: initial.emergency_contact_phone ?? "",
      shirt_size: SHIRT_SIZES.includes(savedShirt as ShirtSize) ? savedShirt : "",
    },
  });
  const today = new Date().toISOString().slice(0, 10);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch("/users/me/travel-profile", {
        method: "PATCH",
        // Empty fields are saved as "not set", not as empty text.
        body: JSON.stringify({
          date_of_birth: values.date_of_birth || null,
          nationality: values.nationality.trim() || null,
          emergency_contact_name: values.emergency_contact_name.trim() || null,
          emergency_contact_phone: values.emergency_contact_phone || null,
          shirt_size: values.shirt_size || null,
        }),
      });
      showToast(t("saveSuccess"));
    } catch (err) {
      showToast(err instanceof ApiError ? tErr(errorMessageKey(err.code)) : tErr("generic"), "error");
    }
  });

  return (
    <Card className="p-8">
      <h2 className="text-headline-sm">{t("travelDetails")}</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="dob">{t("dateOfBirth")}</Label>
          <Input
            id="dob"
            type="date"
            min="1900-01-01"
            max={today}
            {...register("date_of_birth", {
              validate: (value) => !value || (value >= "1900-01-01" && value < today) || t("dateOfBirthInvalid"),
            })}
          />
          <FieldError>{errors.date_of_birth?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="nationality">{t("nationality")}</Label>
          <Input id="nationality" maxLength={100} {...register("nationality")} />
        </div>
        <div>
          <Label htmlFor="shirt">{t("shirtSize")}</Label>
          <NativeSelect id="shirt" {...register("shirt_size")}>
            <option value="">{t("select")}</option>
            {SHIRT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="ec_name">{t("emergencyContactName")}</Label>
          <Input id="ec_name" maxLength={255} {...register("emergency_contact_name")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="ec_phone">{t("emergencyContactPhone")}</Label>
          <Controller
            control={control}
            name="emergency_contact_phone"
            rules={{ validate: (value) => !value || E164_PATTERN.test(value) || t("phoneInvalid") }}
            render={({ field }) => (
              <PhoneInput id="ec_phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} className="sm:max-w-[calc(50%-0.5rem)]" />
            )}
          />
          <FieldError>{errors.emergency_contact_phone?.message}</FieldError>
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
