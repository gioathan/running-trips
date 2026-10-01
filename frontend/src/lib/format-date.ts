/** Formats a trip's [start, end] ISO date pair into a compact human range,
 * e.g. "12–16 Jun 2026" (same month) or "28 Jun – 2 Jul 2026" (spanning
 * months), localized to the given locale. */
export function formatDateRange(startIso: string, endIso: string, locale: string): string {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);

  const year = end.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  const day = (d: Date) => d.getDate();
  const month = (d: Date) => d.toLocaleDateString(locale, { month: "short" });

  if (sameMonth) {
    return `${day(start)}–${day(end)} ${month(end)} ${year}`;
  }
  return `${day(start)} ${month(start)} – ${day(end)} ${month(end)} ${year}`;
}
