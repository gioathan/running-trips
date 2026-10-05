import { redirect } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { backendFetch } from "@/lib/api";
import { requireUser } from "@/lib/auth-server";
import { ProfileForm } from "@/components/site/ProfileForm";
import { BasicInfoForm } from "@/components/site/BasicInfoForm";
import { ButtonLink } from "@/components/ui/Button";
import type { TravelProfile } from "@/types/api";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const tNav = await getTranslations("nav");
  const session = await requireUser();
  if (!session) {
    redirect({ href: "/", locale });
    return null;
  }

  const travelProfile = await backendFetch<TravelProfile>("/users/me/travel-profile", {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });

  return (
    <div className="py-10 md:py-16">
      {/* Same width as the cards below, so the button lines up with their edge. */}
      <div className="flex max-w-[720px] flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="text-headline-lg-mobile md:text-headline-lg">{t("pageTitle")}</h1>
        <ButtonLink href="/account" variant="secondary" size="sm">
          {tNav("myTrips")}
        </ButtonLink>
      </div>
      <p className="mt-2 max-w-[560px] text-body-md text-ink-muted">{t("pageSubtitle")}</p>
      <div className="mt-8 max-w-[720px] space-y-8">
        <BasicInfoForm initial={session.user} />
        <ProfileForm initial={travelProfile} />
      </div>
    </div>
  );
}
