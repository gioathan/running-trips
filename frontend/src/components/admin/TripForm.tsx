"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import * as Tabs from "@radix-ui/react-tabs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { adminApiFetch, ApiError } from "@/lib/api";
import type { RaceCategory, TripAdmin } from "@/types/api";

interface CategoryRow {
  race_category_id: string;
  price: string;
  capacity: string;
}

interface FormValues {
  slug: string;
  cover_image_url: string;
  location_city: string;
  location_country: string;
  start_date: string;
  end_date: string;
  capacity: string;
  is_full_override: boolean;
  is_featured: boolean;
  status: "draft" | "published" | "archived";
  en_title: string;
  en_summary: string;
  en_description: string;
  en_duration_label: string;
  el_title: string;
  el_summary: string;
  el_description: string;
  el_duration_label: string;
  categories: CategoryRow[];
}

function toDefaults(trip: TripAdmin | undefined): FormValues {
  return {
    slug: trip?.slug ?? "",
    cover_image_url: trip?.cover_image_url ?? "",
    location_city: trip?.location_city ?? "",
    location_country: trip?.location_country ?? "",
    start_date: trip?.start_date ?? "",
    end_date: trip?.end_date ?? "",
    capacity: trip?.capacity != null ? String(trip.capacity) : "",
    is_full_override: trip?.is_full_override ?? false,
    is_featured: trip?.is_featured ?? false,
    status: trip?.status ?? "draft",
    en_title: trip?.translations.en?.title ?? "",
    en_summary: trip?.translations.en?.summary ?? "",
    en_description: trip?.translations.en?.description ?? "",
    en_duration_label: trip?.translations.en?.duration_label ?? "",
    el_title: trip?.translations.el?.title ?? "",
    el_summary: trip?.translations.el?.summary ?? "",
    el_description: trip?.translations.el?.description ?? "",
    el_duration_label: trip?.translations.el?.duration_label ?? "",
    categories: trip?.categories.map((c) => ({
      race_category_id: String(c.race_category.id),
      price: String(c.price),
      capacity: c.capacity != null ? String(c.capacity) : "",
    })) ?? [],
  };
}

export function TripForm({ trip, raceCategories }: { trip?: TripAdmin; raceCategories: RaceCategory[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: toDefaults(trip) });
  const { fields, append, remove } = useFieldArray({ control, name: "categories" });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const payload = {
      slug: values.slug,
      cover_image_url: values.cover_image_url || null,
      location_city: values.location_city || null,
      location_country: values.location_country || null,
      start_date: values.start_date,
      end_date: values.end_date,
      capacity: values.capacity ? Number(values.capacity) : null,
      is_full_override: values.is_full_override,
      is_featured: values.is_featured,
      status: values.status,
      translations: [
        {
          locale: "en",
          title: values.en_title,
          summary: values.en_summary || null,
          description: values.en_description || null,
          duration_label: values.en_duration_label || null,
        },
        {
          locale: "el",
          title: values.el_title,
          summary: values.el_summary || null,
          description: values.el_description || null,
          duration_label: values.el_duration_label || null,
        },
      ],
      categories: values.categories
        .filter((c) => c.race_category_id)
        .map((c) => ({
          race_category_id: Number(c.race_category_id),
          price: Number(c.price),
          capacity: c.capacity ? Number(c.capacity) : null,
        })),
    };

    try {
      if (trip) {
        await adminApiFetch(`/admin/trips/${trip.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        router.refresh();
      } else {
        const created = await adminApiFetch<TripAdmin>("/admin/trips", { method: "POST", body: JSON.stringify(payload) });
        router.push(`/admin/trips/${created.id}/edit`);
      }
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  });

  const categoryOptions = raceCategories.map((c) => ({ value: String(c.id), label: c.name }));

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <Card className="p-6">
        <h2 className="text-headline-sm">Basics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" required {...register("slug", { required: true })} />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={[
                    { value: "draft", label: "Draft" },
                    { value: "published", label: "Published" },
                    { value: "archived", label: "Archived" },
                  ]}
                />
              )}
            />
          </div>
          <div>
            <Label htmlFor="location_city">City</Label>
            <Input id="location_city" {...register("location_city")} />
          </div>
          <div>
            <Label htmlFor="location_country">Country</Label>
            <Input id="location_country" {...register("location_country")} />
          </div>
          <div>
            <Label htmlFor="start_date">Start date</Label>
            <Input id="start_date" type="date" required {...register("start_date", { required: true })} />
          </div>
          <div>
            <Label htmlFor="end_date">End date</Label>
            <Input id="end_date" type="date" required {...register("end_date", { required: true })} />
          </div>
          <div>
            <Label htmlFor="capacity">Capacity (whole trip, optional)</Label>
            <Input id="capacity" type="number" min={0} {...register("capacity")} />
          </div>
          <div>
            <Label htmlFor="cover_image_url">Cover image URL</Label>
            <Input id="cover_image_url" {...register("cover_image_url")} />
          </div>
        </div>
        <div className="mt-4 flex gap-6">
          <Controller
            name="is_full_override"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-body-md">
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                Force &quot;Full&quot;
              </label>
            )}
          />
          <Controller
            name="is_featured"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-body-md">
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                Featured on homepage
              </label>
            )}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-headline-sm">Content</h2>
        <Tabs.Root defaultValue="en" className="mt-4">
          <Tabs.List className="flex w-fit rounded-full bg-surface-low p-1">
            <Tabs.Trigger value="en" className="rounded-full px-6 py-2 text-label-lg uppercase data-[state=active]:bg-white data-[state=active]:shadow-hard">
              EN
            </Tabs.Trigger>
            <Tabs.Trigger value="el" className="rounded-full px-6 py-2 text-label-lg uppercase data-[state=active]:bg-white data-[state=active]:shadow-hard">
              EL
            </Tabs.Trigger>
          </Tabs.List>
          {(["en", "el"] as const).map((locale) => (
            <Tabs.Content key={locale} value={locale} className="mt-4 space-y-4">
              <div>
                <Label htmlFor={`${locale}_title`}>Title</Label>
                <Input id={`${locale}_title`} required {...register(`${locale}_title`, { required: true })} />
              </div>
              <div>
                <Label htmlFor={`${locale}_summary`}>Summary (card view)</Label>
                <Input id={`${locale}_summary`} maxLength={300} {...register(`${locale}_summary`)} />
              </div>
              <div>
                <Label htmlFor={`${locale}_duration_label`}>Duration label (optional override)</Label>
                <Input id={`${locale}_duration_label`} placeholder="e.g. 6 DAYS / 5 STAGES" {...register(`${locale}_duration_label`)} />
              </div>
              <div>
                <Label htmlFor={`${locale}_description`}>Full description</Label>
                <Textarea id={`${locale}_description`} rows={6} {...register(`${locale}_description`)} />
              </div>
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-sm">Race categories &amp; pricing</h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => append({ race_category_id: "", price: "", capacity: "" })}>
            Add category
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-end gap-3">
              <div>
                <Label>Category</Label>
                <Controller
                  name={`categories.${index}.race_category_id`}
                  control={control}
                  render={({ field: f }) => <Select value={f.value} onValueChange={f.onChange} options={categoryOptions} placeholder="Select" />}
                />
              </div>
              <div>
                <Label>Price (EUR)</Label>
                <Input type="number" step="0.01" min={0} {...register(`categories.${index}.price` as const, { required: true })} />
              </div>
              <div>
                <Label>Capacity (optional)</Label>
                <Input type="number" min={0} {...register(`categories.${index}.capacity` as const)} />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                Remove
              </Button>
            </div>
          ))}
          {fields.length === 0 && <p className="text-body-sm text-ink-muted">No categories yet.</p>}
        </div>
      </Card>

      {serverError && <FieldError>{serverError}</FieldError>}
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {trip ? "Save changes" : "Create trip"}
      </Button>
    </form>
  );
}
