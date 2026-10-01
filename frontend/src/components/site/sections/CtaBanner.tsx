import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import type { CtaBannerData } from "./types";

export function CtaBanner({ data }: { data: CtaBannerData }) {
  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-3xl border border-ink bg-ink px-8 py-16 text-center text-white sm:py-20">
        {/* Decorative glow blobs — purely cosmetic, sit behind the content. */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-accent/20 blur-3xl" aria-hidden />
        <div className="relative">
          {data.eyebrow && (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-label-md uppercase ring-1 ring-white/15">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              {data.eyebrow}
            </span>
          )}
          <h2 className="mx-auto mt-4 max-w-[640px] text-headline-lg-mobile md:text-headline-xl">{data.headline}</h2>
          {data.body && <p className="mx-auto mt-4 max-w-[520px] text-body-lg text-white/70">{data.body}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {data.primaryCta && (
              <ButtonLink href={data.primaryCta.href} variant="highlight" className="group hover:shadow-[0_0_0_4px_rgba(212,255,63,0.2)]">
                {data.primaryCta.label}
                <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
                  →
                </span>
              </ButtonLink>
            )}
            {data.secondaryCta && (
              <ButtonLink href={data.secondaryCta.href} variant="ghost" className="border-white/30 text-white hover:bg-white/10">
                {data.secondaryCta.label}
              </ButtonLink>
            )}
          </div>
        </div>
      </section>
    </Reveal>
  );
}

