import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/seo";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { backendFetch, qs } from "@/lib/api";
import { redirect } from "@/i18n/navigation";
import { TripCard } from "@/components/site/TripCard";
import { FilterBar } from "@/components/site/FilterBar";
import { UrlPagination } from "@/components/site/UrlPagination";
import { EmptyState } from "@/components/ui/Feedback";
import { CtaBanner } from "@/components/site/sections/CtaBanner";
import { StatsBand } from "@/components/site/sections/StatsBand";
import type { Page, RaceCategory, TripListItem, TripStats } from "@/types/api";

export const revalidate = 60;

interface SearchParams {
  status?: string;
  category?: string;
  q?: string;
  page?: string;
}

/** The filters as URL query, leaving out the defaults. */
function queryOf(f: { status: string; category?: string; q?: string }): Record<string, string> {
  return {
    ...(f.status === "past" ? { status: "past" } : {}),
    ...(f.category ? { category: f.category } : {}),
    ...(f.q ? { q: f.q } : {}),
  };
}

const MAX_PAGE = 500;
const MAX_SEARCH_LENGTH = 80;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "seo" });
  return {
    title: t("tripsTitle"),
    description: t("tripsDescription"),
    alternates: localizedAlternates(locale, "/trips"),
  };
}

export default async function TripsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: SearchParams;
}) {
  setRequestLocale(locale);
  const t = await getTranslations("trips");

  const status = searchParams.status === "past" ? "past" : "upcoming";
  const page = Math.min(Math.max(Math.trunc(Number(searchParams.page)) || 1, 1), MAX_PAGE);
  const q = searchParams.q?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;

  const [categories, stats] = await Promise.all([
    backendFetch<RaceCategory[]>(`/race-categories${qs({ locale })}`, { next: { revalidate: 300 } }),
    backendFetch<TripStats>("/trips/stats", { next: { revalidate: 60 } }),
  ]);
  // Only real categories reach the API (and the cache key).
  const category = categories.some((c) => c.slug === searchParams.category) ? searchParams.category : undefined;

  // Cache the listings everyone sees. Free-text searches are different for
  // every visitor: caching them would let anyone fill the data cache with
  // one entry per made-up search term, so those go straight to the API.
  const tripsPage = await backendFetch<Page<TripListItem>>(
    `/trips${qs({ status, category, q, page, page_size: 12, locale })}`,
    q ? { cache: "no-store" } : { next: { revalidate: 60 } }
  );

  // A page number past the end (an old link, or trips removed since) would
  // show "no trips match" although there are trips — go to the last real page.
  const lastPage = Math.max(1, Math.ceil(tripsPage.total / tripsPage.page_size));
  if (page > lastPage) {
    redirect({ href: { pathname: "/trips", query: { ...queryOf({ status, category, q }), page: lastPage } }, locale });
  }

  return (
    <div className="py-10 md:py-16">
      <h1 className="text-headline-lg-mobile md:text-headline-lg">{t("pageTitle")}</h1>
      <p className="mt-4 max-w-[560px] text-body-lg text-ink-muted">{t("pageSubtitle")}</p>

      <div className="mt-8">
        <FilterBar categories={categories} status={status} category={category} q={q} />
      </div>

      <p className="mt-6 text-body-sm text-ink-muted">{t("resultsCount", { count: tripsPage.total })}</p>

      {tripsPage.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tripsPage.items.map((trip) => (
            <TripCard key={trip.id} trip={trip} locale={locale} />
          ))}
        </div>
      )}

      <div className="mt-12">
        <UrlPagination page={tripsPage.page} pageSize={tripsPage.page_size} total={tripsPage.total} />
      </div>

      <div className="mt-16">
        <StatsBand
          data={{
            items: [
              { value: `${stats.races_organized}+`, label: t("bannerStat1Label") },
              { value: String(stats.countries), label: t("bannerStat2Label") },
            ],
          }}
        />
      </div>
      <div className="mt-8">
        <CtaBanner
          data={{
            eyebrow: t("bannerEyebrow"),
            headline: t("bannerHeadline"),
            body: t("bannerBody"),
            primaryCta: { label: t("bannerCta"), href: "/contact" },
          }}
        />
      </div>
    </div>
  );
}
