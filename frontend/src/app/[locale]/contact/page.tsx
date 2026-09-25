import { setRequestLocale, getTranslations } from "next-intl/server";
import { backendFetch } from "@/lib/api";
import { SectionList } from "@/components/site/Section";
import { ContactForm } from "@/components/site/ContactForm";
import type { PageContent } from "@/types/api";

export const revalidate = 60;

export default async function ContactPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const content = await backendFetch<PageContent>(`/content/pages/contact?locale=${locale}`, {
    next: { revalidate: 60 },
  }).catch(() => ({ slug: "contact", sections: [] }) as PageContent);

  return (
    <div className="py-10 md:py-16">
      <h1 className="text-headline-lg-mobile md:text-headline-lg">{t("pageTitle")}</h1>
      <p className="mt-4 max-w-[560px] text-body-lg text-ink-muted">{t("pageSubtitle")}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <SectionList sections={content.sections} />
        </div>
        <div>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
