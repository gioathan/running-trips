import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/seo";
import type { SVGProps } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { backendFetch } from "@/lib/api";
import { SectionList } from "@/components/site/Section";
import { ContactForm } from "@/components/site/ContactForm";
import { Card } from "@/components/ui/Card";
import type { PageContent } from "@/types/api";
import type { WidgetListData } from "@/components/site/sections/types";

export const revalidate = 60;

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

// Contact-info items come from the CMS in a fixed order (email, phone, office) —
// map by position rather than title so it still works translated into Greek.
const CONTACT_ICONS: ((props: IconProps) => React.JSX.Element)[] = [
  (props) => (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </Icon>
  ),
  (props) => (
    <Icon {...props}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </Icon>
  ),
  (props) => (
    <Icon {...props}>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Icon>
  ),
];

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "seo" });
  return {
    title: t("contactTitle"),
    description: t("contactDescription"),
    alternates: localizedAlternates(locale, "/contact"),
  };
}

export default async function ContactPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const content = await backendFetch<PageContent>(`/content/pages/contact?locale=${locale}`, {
    next: { revalidate: 60 },
  }).catch(() => ({ slug: "contact", sections: [] }) as PageContent);

  const [infoSection, ...restSections] = content.sections.slice().sort((a, b) => a.sort_order - b.sort_order);
  const infoItems = (infoSection?.data as unknown as WidgetListData | undefined)?.items ?? [];

  return (
    <div className="py-10 md:py-16">
      <p className="flex items-center gap-2 text-label-lg text-ink-muted">
        <span className="h-[2px] w-5 bg-primary" aria-hidden />
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 text-headline-lg-mobile md:text-headline-lg">{t("pageTitle")}</h1>
      <p className="mt-4 max-w-[560px] text-body-lg text-ink-muted">{t("pageSubtitle")}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          {infoItems.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {infoItems.map((item, i) => {
                const IconCmp = CONTACT_ICONS[i];
                return (
                  <Card key={item.title} className="rounded-2xl border-ink/10 p-5">
                    {IconCmp && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-low text-ink">
                        <IconCmp className="h-5 w-5" />
                      </div>
                    )}
                    <h3 className="mt-4 text-headline-sm">{item.title}</h3>
                    <p className="mt-1 text-body-sm text-ink-muted">{item.body}</p>
                  </Card>
                );
              })}
            </div>
          )}
          <SectionList sections={restSections} />
        </div>
        <div>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
