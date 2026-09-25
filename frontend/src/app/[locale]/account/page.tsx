import { redirect } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { backendFetch, qs } from "@/lib/api";
import { requireUser } from "@/lib/auth-server";
import { AccountTripsTabs } from "@/components/site/AccountTripsTabs";
import type { Booking, Page } from "@/types/api";

// Identity/booking data — never cached (BACKEND_PLAN.md's Next.js caching split).
export const dynamic = "force-dynamic";

export default async function AccountPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { status?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("account");
  const session = await requireUser();
  if (!session) redirect({ href: "/", locale });

  const status = searchParams.status === "past" ? "past" : "upcoming";
  const bookings = await backendFetch<Page<Booking>>(`/users/me/bookings${qs({ status, page_size: 20, locale })}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });

  return (
    <div className="py-10 md:py-16">
      <h1 className="text-headline-lg-mobile md:text-headline-lg">{t("pageTitle")}</h1>
      <p className="mt-2 text-body-md text-ink-muted">{t("greeting", { name: session.user.full_name ?? session.user.email })}</p>

      <div className="mt-8">
        <AccountTripsTabs status={status} bookings={bookings.items} />
      </div>
    </div>
  );
}
