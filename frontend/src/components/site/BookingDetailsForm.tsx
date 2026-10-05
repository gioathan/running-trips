"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, NativeSelect } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Spinner } from "@/components/ui/Feedback";
import { E164_PATTERN } from "@/lib/phone";
import type { Gender, ParticipantIn, ShirtSize } from "@/types/api";

// Same rules as the backend (bookings/schemas.py) — checked here first so
// the customer sees which field is wrong instead of a generic error.
const LATIN_NAME = /^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ .'-]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHIRT_SIZES: ShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL"];
const GENDERS: Gender[] = ["female", "male", "other"];

interface ParticipantValues {
  full_name: string;
  date_of_birth: string;
  gender: Gender | "";
  nationality: string;
  shirt_size: ShirtSize | "";
}

export interface BookingDetailsValues {
  contact_email: string;
  contact_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  participants: ParticipantValues[];
}

/** What POST /bookings takes, minus the trip ids the caller adds. */
export interface BookingDetails {
  contact_email: string;
  contact_phone: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  participants: ParticipantIn[];
}

const EMPTY_PARTICIPANT: ParticipantValues = { full_name: "", date_of_birth: "", gender: "", nationality: "", shirt_size: "" };

export function emptyBookingDetails(): BookingDetailsValues {
  return {
    contact_email: "",
    contact_phone: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    participants: [{ ...EMPTY_PARTICIPANT }],
  };
}

/**
 * The details step of checkout: who to contact about the booking, and each
 * participant as the race organiser and hotel need them (name in Latin
 * characters, date of birth, gender). `prefill` seeds the contact block and
 * participant 1 from the signed-in user's account.
 */
export function BookingDetailsForm({
  participantCount,
  prefill,
  onSubmit,
}: {
  participantCount: number;
  prefill: BookingDetailsValues;
  onSubmit: (details: BookingDetails) => Promise<void>;
}) {
  const t = useTranslations("checkout");
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookingDetailsValues>({
    defaultValues: {
      ...prefill,
      participants: Array.from({ length: participantCount }, (_, i) =>
        i === 0 ? prefill.participants[0] : { ...EMPTY_PARTICIPANT }
      ),
    },
  });
  const { fields } = useFieldArray({ control, name: "participants" });
  const today = new Date().toISOString().slice(0, 10);

  const submit = handleSubmit((values) =>
    onSubmit({
      contact_email: values.contact_email.trim(),
      contact_phone: values.contact_phone,
      emergency_contact_name: values.emergency_contact_name.trim() || null,
      emergency_contact_phone: values.emergency_contact_phone || null,
      participants: values.participants.map((p) => ({
        full_name: p.full_name.trim(),
        date_of_birth: p.date_of_birth,
        gender: p.gender as Gender,
        nationality: p.nationality.trim() || null,
        shirt_size: p.shirt_size || null,
      })),
    })
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="text-label-md uppercase text-ink-muted">{t("contactDetails")}</legend>
        <div>
          <Label htmlFor="contact_email">{t("contactEmail")}</Label>
          <Input
            id="contact_email"
            type="email"
            autoComplete="email"
            {...register("contact_email", {
              required: t("errors.required"),
              pattern: { value: EMAIL, message: t("errors.email") },
            })}
          />
          <p className="mt-1 text-body-sm text-ink-muted">{t("contactEmailHint")}</p>
          <FieldError>{errors.contact_email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="contact_phone">{t("contactPhone")}</Label>
          <Controller
            control={control}
            name="contact_phone"
            rules={{
              required: t("errors.required"),
              pattern: { value: E164_PATTERN, message: t("errors.phone") },
            }}
            render={({ field }) => (
              <PhoneInput id="contact_phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
          <FieldError>{errors.contact_phone?.message}</FieldError>
        </div>
      </fieldset>

      {fields.map((field, index) => {
        const fieldErrors = errors.participants?.[index];
        return (
          <fieldset key={field.id} className="space-y-3 border-t border-ink/10 pt-2">
            <legend className="text-label-md uppercase text-ink-muted">
              {t("participant")} {index + 1}
            </legend>
            <div>
              <Label htmlFor={`full_name_${index}`}>{t("fullName")}</Label>
              <Input
                id={`full_name_${index}`}
                autoComplete={index === 0 ? "name" : "off"}
                {...register(`participants.${index}.full_name` as const, {
                  required: t("errors.required"),
                  validate: (value) => {
                    const name = value.trim().replace(/\s+/g, " ");
                    if (!LATIN_NAME.test(name)) return t("errors.nameLatin");
                    if (!name.includes(" ")) return t("errors.nameSurname");
                    return true;
                  },
                })}
              />
              <p className="mt-1 text-body-sm text-ink-muted">{t("fullNameHint")}</p>
              <FieldError>{fieldErrors?.full_name?.message}</FieldError>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`dob_${index}`}>{t("dateOfBirth")}</Label>
                <Input
                  id={`dob_${index}`}
                  type="date"
                  min="1900-01-01"
                  max={today}
                  {...register(`participants.${index}.date_of_birth` as const, {
                    required: t("errors.required"),
                    validate: (value) => (value >= "1900-01-01" && value < today) || t("errors.dateOfBirth"),
                  })}
                />
                <FieldError>{fieldErrors?.date_of_birth?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor={`gender_${index}`}>{t("gender")}</Label>
                <NativeSelect
                  id={`gender_${index}`}
                  {...register(`participants.${index}.gender` as const, { required: t("errors.required") })}
                >
                  <option value="">{t("select")}</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {t(`genders.${g}`)}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError>{fieldErrors?.gender?.message}</FieldError>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`nationality_${index}`}>{t("nationality")}</Label>
                <Input id={`nationality_${index}`} {...register(`participants.${index}.nationality` as const)} />
              </div>
              <div>
                <Label htmlFor={`shirt_${index}`}>{t("shirtSize")}</Label>
                <NativeSelect id={`shirt_${index}`} {...register(`participants.${index}.shirt_size` as const)}>
                  <option value="">{t("select")}</option>
                  {SHIRT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </fieldset>
        );
      })}

      <fieldset className="space-y-3 border-t border-ink/10 pt-2">
        <legend className="text-label-md uppercase text-ink-muted">{t("emergencyContact")}</legend>
        <div>
          <Label htmlFor="emergency_contact_name">{t("emergencyName")}</Label>
          <Input id="emergency_contact_name" {...register("emergency_contact_name")} />
        </div>
        <div>
          <Label htmlFor="emergency_contact_phone">{t("emergencyPhone")}</Label>
          <Controller
            control={control}
            name="emergency_contact_phone"
            rules={{ validate: (value) => !value || E164_PATTERN.test(value) || t("errors.phone") }}
            render={({ field }) => (
              <PhoneInput id="emergency_contact_phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
          <FieldError>{errors.emergency_contact_phone?.message}</FieldError>
        </div>
      </fieldset>

      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Spinner /> : t("continueToPayment")}
      </Button>
    </form>
  );
}
