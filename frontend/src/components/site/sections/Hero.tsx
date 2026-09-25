import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import type { HeroData } from "./types";

export function Hero({ data }: { data: HeroData }) {
  return (
    <section className="grid gap-10 py-10 md:grid-cols-2 md:items-center md:py-16">
      <div>
        {data.eyebrow && <p className="text-label-lg text-ink-muted">{data.eyebrow}</p>}
        <h1 className="mt-4 text-headline-xl-mobile md:text-headline-xl">{data.headline}</h1>
        {data.body && <p className="mt-6 max-w-[560px] text-body-lg text-ink-muted">{data.body}</p>}
        <div className="mt-8 flex flex-wrap gap-4">
          {data.primaryCta && (
            <ButtonLink href={data.primaryCta.href} variant="primary">
              {data.primaryCta.label}
            </ButtonLink>
          )}
          {data.secondaryCta && (
            <ButtonLink href={data.secondaryCta.href} variant="ghost">
              {data.secondaryCta.label}
            </ButtonLink>
          )}
        </div>
        {data.stats && data.stats.length > 0 && (
          <div className="mt-10 flex gap-8 rounded-md border border-ink bg-surface p-6">
            {data.stats.map((stat, i) => (
              <div key={i}>
                <p className="text-metric-display">{stat.value}</p>
                <p className="mt-1 text-label-sm text-ink-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {data.imageUrl && (
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md border border-ink">
          <Image src={data.imageUrl} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
        </div>
      )}
    </section>
  );
}
