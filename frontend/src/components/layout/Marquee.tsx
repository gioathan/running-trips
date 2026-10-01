import { cn } from "@/lib/cn";

const DEFAULT_ITEMS = [
  "Berlin Marathon",
  "Lisbon Half",
  "Madrid 10K",
  "Vienna Marathon",
  "Guaranteed Bibs",
  "4-Star Hotels",
  "Airport Transfers",
];

/** Decorative, infinitely auto-scrolling pill strip under the header. Caller
 * (LocaleLayout) supplies real race/city names from upcoming trips; falls
 * back to static marketing copy if no items are given. Duplicates its
 * content once so the CSS loop is seamless. */
export function Marquee({ items = DEFAULT_ITEMS, className }: { items?: string[]; className?: string }) {
  return (
    <div className={cn("group overflow-hidden bg-ink py-2", className)} aria-hidden>
      <div className="flex w-max motion-safe:animate-marquee motion-safe:group-hover:[animation-play-state:paused]">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="mx-4 whitespace-nowrap text-label-md uppercase text-footer-fg">
            {item}
            <span className="ml-4 text-accent">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
