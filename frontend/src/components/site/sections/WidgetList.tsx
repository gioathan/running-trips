import { Card } from "@/components/ui/Card";
import type { WidgetListData } from "./types";

export function WidgetList({ data }: { data: WidgetListData }) {
  return (
    <section className="py-10 md:py-16">
      {data.eyebrow && <p className="text-label-lg text-ink-muted">{data.eyebrow}</p>}
      <h2 className="mt-2 text-headline-lg-mobile md:text-headline-lg">{data.headline}</h2>
      {data.body && <p className="mt-4 max-w-[640px] text-body-lg text-ink-muted">{data.body}</p>}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item, i) => (
          <Card key={i} className="p-6">
            {item.icon && <div className="mb-4 h-12 w-12 rounded-full bg-surface-low" aria-hidden />}
            <h3 className="text-headline-sm">{item.title}</h3>
            <p className="mt-2 text-body-md text-ink-muted">{item.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
