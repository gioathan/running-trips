"use client";

import { useEffect, useState } from "react";

/** True once the page has scrolled past `threshold` — drives the header's
 * condensed/sticky-shrink state. Uses hysteresis (separate enter/exit points)
 * so the shrink-induced height change can't flip the state back and forth. */
export function useScrolled(threshold = 24): boolean {
  const [scrolled, setScrolled] = useState(false);
  const exitThreshold = Math.max(threshold - 16, 0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled((prev) => (prev ? window.scrollY > exitThreshold : window.scrollY > threshold));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, exitThreshold]);

  return scrolled;
}
