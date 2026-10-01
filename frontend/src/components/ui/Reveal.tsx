"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useInView } from "@/lib/use-in-view";

/** Wraps a section in a fade + slide-up reveal that plays once it scrolls
 * into view (mirrors the reference site's per-section entrance animation). */
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={cn(
        "motion-safe:transition motion-safe:duration-700 motion-safe:ease-out",
        inView ? "opacity-100 translate-y-0" : "motion-safe:opacity-0 motion-safe:translate-y-6",
        className
      )}
    >
      {children}
    </div>
  );
}
