import { setRequestLocale, getTranslations } from "next-intl/server";
import { backendFetch } from "@/lib/api";
import { SectionList } from "@/components/site/Section";
import { TripCard } from "@/components/site/TripCard";
import type { Page, PageContent, TripListItem } from "@/types/api";

export const revalidate = 60; // public marketing content — short ISR window + on-demand revalidation (FRONTEND_PLAN.md §9)

async function getHomeContent(locale: string) {
  try {
    return await backendFetch<PageContent>(`/content/pages/home?locale=${locale}`, { next: { revalidate: 60 } });
  } catch {
    return { slug: "home", sections: [] } satisfies PageContent;
  }
}

async function getFeaturedTrips(locale: string) {
  try {
    const page = await backendFetch<Page<TripListItem>>(`/trips?featured=true&page_size=3&locale=${locale}`, {
      next: { revalidate: 60 },
    });
    return page.items;
  } catch {
    return [];
  }
}

export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const [content, featuredTrips] = await Promise.all([getHomeContent(locale), getFeaturedTrips(locale)]);

  // Featured trips are dynamic trip data, not admin-authored CMS copy, so
  // they're not a content_sections row — rendered in a fixed slot right
  // after the first two sections (hero + brand-philosophy widget_list),
  // matching the page order found in the Figma reference.
  const [before, after] = [content.sections.slice(0, 2), content.sections.slice(2)];

  return (
    <div>
      <SectionList sections={before} />

      {featuredTrips.length > 0 && (
        <section className="py-10 md:py-16">
          <h2 className="text-headline-lg-mobile md:text-headline-lg">{t("featuredTripsHeadline")}</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {featuredTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}

      <SectionList sections={after} />
    </div>
  );
}
