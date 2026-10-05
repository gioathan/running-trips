import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { AnimatedStat } from "@/components/ui/AnimatedStat";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";
import type { HeroData } from "./types";

export function Hero({ data }: { data: HeroData }) {
  const [badgeStat, ...restStats] = data.stats ?? [];

  return (
    <section className="grid gap-10 py-10 md:grid-cols-2 md:items-center md:py-16">
      <Reveal>
        {data.eyebrow && (
          <span className="inline-flex rounded-full bg-ink px-4 py-1.5 text-label-md text-white">{data.eyebrow}</span>
        )}
        <h1 className="mt-4 text-headline-xl-mobile md:text-headline-xl">{data.headline}</h1>
        {data.body && <p className="mt-6 max-w-[560px] text-body-lg text-ink-muted">{data.body}</p>}
        {/* Tighter on phones, where the two buttons wrap onto separate lines. */}
        <div className="mt-8 flex flex-wrap gap-2 sm:gap-4">
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
        {!data.statCards && restStats.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-6 rounded-2xl border border-ink bg-surface p-6 md:gap-8">
            {restStats.map((stat, i) => (
              <div key={i}>
                <AnimatedStat value={stat.value} className="text-metric-display" />
                <p className="mt-1 text-label-sm text-ink-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </Reveal>

      {data.statCards ? (
        <Reveal delayMs={150} className="grid grid-cols-2 gap-4">
          {data.statCards.map((card, i) => (
            <div
              key={i}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-ink p-6",
                card.variant === "dark-highlight" ? "col-span-2 bg-ink text-white sm:col-span-1" : "bg-surface",
                i === 0 && "col-span-2 sm:col-span-1"
              )}
            >
              {card.badge && (
                <span
                  className={cn(
                    "absolute right-4 top-4 rounded-full px-3 py-1 text-label-sm uppercase",
                    card.variant === "dark-highlight" ? "bg-accent text-ink" : "bg-surface-low text-ink-muted"
                  )}
                >
                  {card.badge}
                </span>
              )}
              <p className={cn("text-label-sm uppercase", card.variant === "dark-highlight" ? "text-white/70" : "text-ink-muted")}>
                {card.title}
              </p>
              <AnimatedStat
                value={card.value}
                className={cn("mt-2 block text-metric-display", card.variant === "dark-highlight" && "text-accent")}
              />
              {card.sublabel && (
                <p className={cn("mt-1 text-body-sm", card.variant === "dark-highlight" ? "text-white/70" : "text-ink-muted")}>
                  {card.sublabel}
                </p>
              )}
            </div>
          ))}
        </Reveal>
      ) : (
        data.imageUrl && (
          <Reveal delayMs={150} className="relative mb-6 md:mb-0">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-ink">
              <Image src={data.imageUrl} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            </div>
            {badgeStat && (
              <div className="absolute -bottom-6 -left-4 flex flex-col items-center rounded-full border border-ink bg-surface px-6 py-4 text-center shadow-soft md:-left-8">
                <p className="text-headline-md">{badgeStat.value}</p>
                <p className="mt-0.5 text-label-sm text-ink-muted">{badgeStat.label}</p>
              </div>
            )}
          </Reveal>
        )
      )}
    </section>
  );
}

