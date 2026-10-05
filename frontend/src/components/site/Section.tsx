import sanitizeHtml from "sanitize-html";
import type { ContentSection } from "@/types/api";
import { Hero } from "./sections/Hero";
import { WidgetList } from "./sections/WidgetList";
import { StatsBand } from "./sections/StatsBand";
import { Testimonials } from "./sections/Testimonials";
import { ComparisonTable } from "./sections/ComparisonTable";
import { Steps } from "./sections/Steps";
import { CtaBanner } from "./sections/CtaBanner";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { Reveal } from "@/components/ui/Reveal";
import type {
  CtaBannerData,
  FaqData,
  HeroData,
  RichtextData,
  StatsBandData,
  StepsData,
  ComparisonTableData,
  TestimonialsData,
  WidgetListData,
} from "./sections/types";

/** Dispatches a CMS `content_sections` row (BACKEND_PLAN.md §4's
 * content_sections.type catalogue) to its renderer. Every marketing page
 * (Home, Services, ...) is just a `GET /content/pages/{slug}` response
 * mapped through this — no page-specific backend or frontend code needed
 * for a new stack of the same section types. */
export function Section({ section }: { section: ContentSection }) {
  switch (section.type) {
    case "hero":
      return <Hero data={section.data as unknown as HeroData} />;
    case "widget_list":
      return <WidgetList data={section.data as unknown as WidgetListData} />;
    case "stats_band":
      return <StatsBand data={section.data as unknown as StatsBandData} />;
    case "testimonials":
      return <Testimonials data={section.data as unknown as TestimonialsData} />;
    case "faq": {
      const data = section.data as unknown as FaqData;
      if (data.layout === "grid") {
        return (
          <Reveal>
            <section className="py-10 md:py-16">
              {data.eyebrow && <p className="text-label-lg text-ink-muted">{data.eyebrow}</p>}
              {data.headline && <h2 className="mt-2 mb-6 text-headline-lg-mobile md:text-headline-lg">{data.headline}</h2>}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((item, i) => (
                  <div key={i} className="rounded-md border border-ink bg-surface p-6">
                    <p className="text-metric-display text-primary">{String(i + 1).padStart(2, "0")}</p>
                    <h3 className="mt-2 text-headline-sm">{item.question}</h3>
                    <p className="mt-2 text-body-md text-ink-muted">{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        );
      }
      return (
        <Reveal>
          <section className="py-10 md:py-16">
            {data.eyebrow && <p className="text-label-lg text-ink-muted">{data.eyebrow}</p>}
            {data.headline && <h2 className="mt-2 mb-6 text-headline-lg-mobile md:text-headline-lg">{data.headline}</h2>}
            <FaqAccordion items={data.items} />
          </section>
        </Reveal>
      );
    }
    case "comparison_table":
      return <ComparisonTable data={section.data as unknown as ComparisonTableData} />;
    case "steps":
      return <Steps data={section.data as unknown as StepsData} />;
    case "cta_banner":
      return <CtaBanner data={section.data as unknown as CtaBannerData} />;
    case "richtext": {
      const data = section.data as unknown as RichtextData;
      // Admin-authored, but sanitized anyway: if an admin account is ever
      // compromised, this field shouldn't be a way to plant scripts on the
      // public site. Allows formatting, links and images; strips the rest.
      const html = sanitizeHtml(data.html ?? "", {
        allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "h1", "h2"],
        allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "width", "height"] },
        allowedSchemes: ["http", "https", "mailto", "tel"],
      });
      // eslint-disable-next-line react/no-danger -- sanitized above
      return <section className="prose max-w-none py-10" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    default:
      return null;
  }
}

export function SectionList({ sections }: { sections: ContentSection[] }) {
  return (
    <>
      {sections
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((section) => (
          <Section key={section.id} section={section} />
        ))}
    </>
  );
}
