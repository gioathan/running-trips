import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { backendFetch, qs } from "@/lib/api";
import { SITE_URL, localizedPath } from "@/lib/seo";
import type { Page, TripListItem } from "@/types/api";

export const revalidate = 3600;

const STATIC_PATHS = ["/", "/trips", "/services", "/contact"];
const PAGE_SIZE = 100; // backend max

async function allTripSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  // The public listing has no "all" filter — upcoming + past together cover
  // every published trip.
  for (const status of ["upcoming", "past"] as const) {
    for (let page = 1; ; page++) {
      const res = await backendFetch<Page<TripListItem>>(`/trips${qs({ status, page, page_size: PAGE_SIZE })}`, {
        next: { revalidate },
      });
      slugs.push(...res.items.map((t) => t.slug));
      if (page * PAGE_SIZE >= res.total) break;
    }
  }
  return slugs;
}

function entry(path: string): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}${localizedPath(routing.defaultLocale, path)}`,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}${localizedPath(l, path)}`])),
    },
  };
}

/** Locale-aware sitemap (FRONTEND_PLAN.md §10): one entry per page, with
 * every locale's URL as an hreflang alternate. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // If the API is unreachable, still serve the static pages rather than a 500.
  const slugs = await allTripSlugs().catch(() => []);
  return [...STATIC_PATHS, ...slugs.map((slug) => `/trips/${slug}`)].map(entry);
}
