import type { SVGProps } from "react";
import { DecorativeSparkline } from "@/components/ui/DecorativeSparkline";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";
import type { WidgetListData, WidgetListItem, WidgetMini } from "./types";

type IconProps = SVGProps<SVGSVGElement>;

// Shared stroke-icon defaults so each icon only needs to define its path.
function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

const RouteIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="6" r="2" />
    <path d="M5 16c0-5 2-6 6-6h2c4 0 4-2 4-2" />
  </Icon>
);

const HotelIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 19V7" />
    <path d="M3 19h18" />
    <path d="M3 13h18v6" />
    <path d="M7 13v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <circle cx="6" cy="9.5" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

const GroupIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <circle cx="17" cy="9" r="2.25" />
    <path d="M15.75 13.25A4.5 4.5 0 0 1 20.5 17.5" />
  </Icon>
);

const BibIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4.5" y="6" width="15" height="14" rx="2" />
    <circle cx="8" cy="6" r="1.4" />
    <circle cx="16" cy="6" r="1.4" />
    <path d="M9 13h6M9 16.5h4" />
  </Icon>
);

const BusIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="4.5" width="17" height="12" rx="2" />
    <path d="M3.5 11h17" />
    <path d="M7 17v2.5M17 17v2.5" />
    <circle cx="7.5" cy="19.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="19.5" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

const CoachIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="13.5" r="6.5" />
    <path d="M12 10v3.5l2.5 1.5" />
    <path d="M9.5 3.5h5M12 3.5V7" />
  </Icon>
);

const ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  route: RouteIcon,
  hotel: HotelIcon,
  group: GroupIcon,
  bib: BibIcon,
  bus: BusIcon,
  coach: CoachIcon,
};

function MiniWidget({ mini }: { mini: WidgetMini }) {
  switch (mini.kind) {
    case "sparkline":
      return (
        <div className="rounded-lg bg-surface-low p-4">
          <p className="text-label-sm uppercase text-ink-muted">{mini.label}</p>
          <DecorativeSparkline seed={mini.seed} className="mt-2 h-8 w-full text-primary" />
        </div>
      );
    case "progress":
      return (
        <div className="rounded-lg bg-ink p-4 text-white">
          <p className="text-label-sm uppercase text-white/70">{mini.label}</p>
          <div className="mt-2 h-2 rounded-full bg-white/20">
            <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, mini.percent))}%` }} />
          </div>
          <p className="mt-2 text-body-sm">{mini.value}</p>
        </div>
      );
    case "statGrid":
      return (
        <div className="grid grid-cols-2 gap-2">
          {mini.items.map((item, i) => (
            <div key={i} className="rounded-lg bg-surface-low px-3 py-2 text-center">
              <p className="text-label-md">{item.value}</p>
              <p className="text-label-sm text-ink-muted">{item.label}</p>
            </div>
          ))}
        </div>
      );
    case "badgeRow":
      return (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {mini.badges.map((badge, i) => (
            <span key={i} className="rounded-full border border-ink/15 bg-surface-low px-3 py-1 text-label-sm uppercase text-ink-muted">
              {badge}
            </span>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function WidgetRow({ item, index }: { item: WidgetListItem; index: number }) {
  const IconCmp = item.icon ? ICONS[item.icon] : undefined;

  return (
    <Reveal delayMs={index * 70} className="border-t border-ink/10 first:border-t-0">
      <div className="group flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:gap-8">
        {IconCmp && (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-low text-ink transition-colors duration-300 group-hover:bg-ink group-hover:text-accent">
            <IconCmp className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            {item.numberLabel && <span className="text-label-md text-ink-muted/50 tabular-nums">{item.numberLabel}</span>}
            <h3 className="text-headline-sm transition-colors duration-300 group-hover:text-primary sm:text-headline-md">{item.title}</h3>
          </div>
          <p className="mt-2 max-w-[480px] text-body-md text-ink-muted sm:text-body-lg">{item.body}</p>
        </div>
        {item.mini && <div className="sm:w-[240px] sm:shrink-0">{<MiniWidget mini={item.mini} />}</div>}
      </div>
    </Reveal>
  );
}

export function WidgetList({ data }: { data: WidgetListData }) {
  return (
    <section className="py-10 md:py-16">
      <Reveal>
        {data.eyebrow && (
          <p className="flex items-center gap-2 text-label-lg text-ink-muted">
            <span className="h-[2px] w-5 bg-primary" aria-hidden />
            {data.eyebrow}
          </p>
        )}
        <h2 className="mt-3 text-headline-lg-mobile md:text-headline-lg">{data.headline}</h2>
        {data.body && <p className="mt-4 max-w-[640px] text-body-lg text-ink-muted">{data.body}</p>}
      </Reveal>
      <div className={cn("mt-10 rounded-2xl border border-ink/10 bg-surface px-6 sm:px-8")}>
        {data.items.map((item, i) => (
          <WidgetRow key={i} item={item} index={i} />
        ))}
      </div>
    </section>
  );
}

