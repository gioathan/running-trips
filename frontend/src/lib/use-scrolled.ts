"use client";

import { useEffect, useState } from "react";

/** True once the page has scrolled past `threshold` — drives the header's
 * condensed state. Uses hysteresis (separate enter/exit points) so a finger
 * resting right at the threshold doesn't toggle it. Whatever reacts to this
 * must not change the page's height or scroll position in response (the
 * Header is `fixed` over a constant spacer for exactly that reason). */
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
