import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";
import type { TestimonialsData } from "./types";

export function Testimonials({ data }: { data: TestimonialsData }) {
  return (
    <section className="py-10 md:py-16">
      <Reveal>
        {data.eyebrow && (
          <p className="flex items-center gap-2 text-label-lg text-ink-muted">
            <span className="h-[2px] w-5 bg-primary" aria-hidden />
            {data.eyebrow}
          </p>
        )}
        {data.headline && <h2 className="mt-3 text-headline-lg-mobile md:text-headline-lg">{data.headline}</h2>}
      </Reveal>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {data.items.map((item, i) => {
          const dark = i % 2 === 1;
          return (
            <Reveal key={i} delayMs={i * 80}>
              {/* `cn` is plain clsx (no tailwind-merge) so `bg-ink` alone can lose
                  to the default `bg-surface` depending on stylesheet order —
                  `!` forces the override regardless of class order. */}
              <div
                className={cn(
                  "flex h-full flex-col rounded-2xl border p-8 shadow-soft transition-transform duration-300 hover:-translate-y-1",
                  dark ? "!border-ink !bg-ink !text-white" : "border-ink/10 bg-surface"
                )}
              >
                <p className={cn("text-headline-xl leading-none", dark ? "text-accent" : "text-primary/40")} aria-hidden>
                  &ldquo;
                </p>
                <p className="mt-4 flex-1 text-body-lg">{item.quote}</p>
                <div className="mt-8 flex items-center gap-3">
                  {item.avatarUrl ? (
                    <Image src={item.avatarUrl} alt={item.name} width={44} height={44} className="rounded-full" />
                  ) : (
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-label-md",
                        dark ? "bg-accent text-ink" : "bg-primary/20 text-ink"
                      )}
                      aria-hidden
                    >
                      {item.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="text-body-md font-bold">{item.name}</p>
                    {item.role && (
                      <p
                        className={cn(
                          "mt-0.5 inline-block rounded-full px-2 py-0.5 text-label-sm uppercase",
                          dark ? "bg-white/10 text-white/70" : "bg-surface-low text-ink-muted"
                        )}
                      >
                        {item.role}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

