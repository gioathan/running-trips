import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/** Absolute origin of the public site — needed for canonical/hreflang URLs,
 * Open Graph images, and the sitemap. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** `path` is locale-less, e.g. "/" or "/trips/madrid-10k". */
export function localizedPath(locale: string, path: string): string {
  return `/${locale}${path === "/" ? "" : path}`;
}

/** Canonical URL for this locale plus hreflang alternates for every locale
 * (FRONTEND_PLAN.md §10). Slugs are shared across locales, so the same path
 * works under each prefix. */
export function localizedAlternates(locale: string, path: string): Metadata["alternates"] {
  return {
    canonical: localizedPath(locale, path),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, localizedPath(l, path)])),
      "x-default": localizedPath(routing.defaultLocale, path),
    },
  };
}
