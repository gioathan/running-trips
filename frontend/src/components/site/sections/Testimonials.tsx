import Image from "next/image";
import { Card } from "@/components/ui/Card";
import type { TestimonialsData } from "./types";

export function Testimonials({ data }: { data: TestimonialsData }) {
  return (
    <section className="py-10 md:py-16">
      {data.eyebrow && <p className="text-label-lg text-ink-muted">{data.eyebrow}</p>}
      {data.headline && <h2 className="mt-2 text-headline-lg-mobile md:text-headline-lg">{data.headline}</h2>}
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {data.items.map((item, i) => (
          <Card key={i} className="p-6">
            <p className="text-body-lg">“{item.quote}”</p>
            <div className="mt-6 flex items-center gap-3">
              {item.avatarUrl ? (
                <Image src={item.avatarUrl} alt={item.name} width={40} height={40} className="rounded-full" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-surface-low" aria-hidden />
              )}
              <div>
                <p className="text-body-md font-bold">{item.name}</p>
                {item.role && <p className="text-body-sm text-ink-muted">{item.role}</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
