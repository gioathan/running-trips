"use client";

import { useEffect, useState } from "react";

/** Extracts the numeric part of labels like "1,200", "40+", "15" so the
 * rest of the string (prefix/suffix, thousands separator) can be re-applied
 * after animating. Returns null when no number is found (non-numeric stat). */
function parseNumeric(raw: string): { prefix: string; value: number; suffix: string; separator: "," | "." | "" } | null {
  const match = raw.match(/^(\D*)([\d.,]+)(\D*)$/);
  if (!match) return null;
  const [, prefix, digits, suffix] = match;
  const separator = digits.includes(",") ? "," : digits.includes(".") ? "." : "";
  const value = Number(digits.replace(/[.,]/g, ""));
  if (Number.isNaN(value)) return null;
  return { prefix, value, suffix, separator };
}

function format(value: number, separator: "," | "." | "") {
  return separator ? value.toLocaleString("en-US").replaceAll(",", separator) : String(value);
}

/** Animates a stat string's numeric portion from 0 up to its target once
 * `active` becomes true (driven by `useInView`), preserving any non-numeric
 * prefix/suffix (e.g. "40+", "1,200"). Falls back to the raw label when it
 * has no parseable number. */
export function useCountUp(label: string, active: boolean, durationMs = 1200): string {
  const parsed = parseNumeric(label);
  const [display, setDisplay] = useState(parsed ? format(0, parsed.separator) : label);

  useEffect(() => {
    if (!parsed || !active) return;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(format(Math.round(parsed.value * eased), parsed.separator));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `parsed` is derived fresh each render from `label`
  }, [active, label, durationMs]);

  if (!parsed) return label;
  return `${parsed.prefix}${display}${parsed.suffix}`;
}
