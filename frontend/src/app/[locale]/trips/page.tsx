import { setRequestLocale, getTranslations } from "next-intl/server";
import { backendFetch, qs } from "@/lib/api";
import { TripCard } from "@/components/site/TripCard";
import { FilterBar } from "@/components/site/FilterBar";
import { UrlPagination } from "@/components/site/UrlPagination";
import { EmptyState } from "@/components/ui/Feedback";
import type { Page, RaceCategory, TripListItem } from "@/types/api";

export const revalidate = 60;

interface SearchParams {
  status?: string;
  category?: string;
  q?: string;
  page?: string;
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
  const page = Number(searchParams.page) || 1;

  const [tripsPage, categories] = await Promise.all([
    backendFetch<Page<TripListItem>>(
      `/trips${qs({ status, category: searchParams.category, q: searchParams.q, page, page_size: 12, locale })}`,
      { next: { revalidate: 60 } }
    ),
    backendFetch<RaceCategory[]>(`/race-categories${qs({ locale })}`, { next: { revalidate: 300 } }),
  ]);

  return (
    <div className="py-10 md:py-16">
      <h1 className="text-headline-lg-mobile md:text-headline-lg">{t("pageTitle")}</h1>
      <p className="mt-4 max-w-[560px] text-body-lg text-ink-muted">{t("pageSubtitle")}</p>

      <div className="mt-8">
        <FilterBar categories={categories} status={status} category={searchParams.category} q={searchParams.q} />
      </div>

      <p className="mt-6 text-body-sm text-ink-muted">{t("resultsCount", { count: tripsPage.total })}</p>

      {tripsPage.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tripsPage.items.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}

      <div className="mt-12">
        <UrlPagination page={tripsPage.page} pageSize={tripsPage.page_size} total={tripsPage.total} />
      </div>
    </div>
  );
}
