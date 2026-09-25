"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { RaceCategory } from "@/types/api";

interface FilterBarProps {
  categories: RaceCategory[];
  status: "upcoming" | "past";
  category?: string;
  q?: string;
}

export function FilterBar({ categories, status, category, q }: FilterBarProps) {
  const t = useTranslations("trips");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // any filter change resets pagination
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-full bg-surface-low p-1">
          {(["upcoming", "past"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => updateParams({ status: value })}
              className={cn(
                "rounded-full px-6 py-2 text-label-lg uppercase",
                status === value ? "bg-white shadow-hard" : "text-ink-muted"
              )}
            >
              {t(value)}
            </button>
          ))}
        </div>
        <input
          type="search"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParams({ q: e.currentTarget.value || undefined });
          }}
          className="w-full max-w-[360px] rounded-full border border-ink bg-white px-5 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateParams({ category: undefined })}
          className={cn(
            "rounded-full border px-4 py-1 text-label-md uppercase",
            !category ? "border-ink bg-ink text-white" : "border-ink/30 text-ink-muted"
          )}
        >
          {t("allDistances")}
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => updateParams({ category: c.slug })}
            className={cn(
              "rounded-full border px-4 py-1 text-label-md uppercase",
              category === c.slug ? "border-ink bg-ink text-white" : "border-ink/30 text-ink-muted"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
