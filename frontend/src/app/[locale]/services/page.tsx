import { setRequestLocale } from "next-intl/server";
import { backendFetch } from "@/lib/api";
import { SectionList } from "@/components/site/Section";
import type { PageContent } from "@/types/api";

export const revalidate = 60;

export default async function ServicesPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const content = await backendFetch<PageContent>(`/content/pages/services?locale=${locale}`, {
    next: { revalidate: 60 },
  }).catch(() => ({ slug: "services", sections: [] }) as PageContent);

  return (
    <div className="py-10 md:py-16">
      <SectionList sections={content.sections} />
    </div>
  );
}
