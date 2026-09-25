import { ButtonLink } from "@/components/ui/Button";
import type { CtaBannerData } from "./types";

export function CtaBanner({ data }: { data: CtaBannerData }) {
  return (
    <section className="rounded-md border border-ink bg-surface px-8 py-16 text-center">
      {data.eyebrow && <p className="text-label-lg text-ink-muted">{data.eyebrow}</p>}
      <h2 className="mx-auto mt-4 max-w-[640px] text-headline-lg-mobile md:text-headline-lg">{data.headline}</h2>
      {data.body && <p className="mx-auto mt-4 max-w-[520px] text-body-lg text-ink-muted">{data.body}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
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
    </section>
  );
}
