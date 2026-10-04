import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/seo";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { backendFetch } from "@/lib/api";
import { SectionList } from "@/components/site/Section";
import type { PageContent } from "@/types/api";

export const revalidate = 60;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "seo" });
  return {
    title: t("servicesTitle"),
    description: t("servicesDescription"),
    alternates: localizedAlternates(locale, "/services"),
  };
}

export default async function ServicesPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const content = await backendFetch<PageContent>(`/content/pages/services?locale=${locale}`, {
    next: { revalidate: 60 },
  }).catch(() => ({ slug: "services", sections: [] }) as PageContent);

  return (
    <div>
      <SectionList sections={content.sections} />
    </div>
  );
}
