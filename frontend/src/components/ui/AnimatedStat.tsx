"use client";

import { cn } from "@/lib/cn";
import { useCountUp } from "@/lib/use-count-up";
import { useInView } from "@/lib/use-in-view";

/** A stat value (e.g. "1,200", "40+") that counts up from 0 once scrolled
 * into view — used in Hero stat cards, StatsBand, and marketing banners. */
export function AnimatedStat({ value, className }: { value: string; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const display = useCountUp(value, inView);

  return (
    <span ref={ref} className={cn(className)}>
      {display}
    </span>
  );
}
