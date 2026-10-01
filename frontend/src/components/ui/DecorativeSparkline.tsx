/** Deterministic, cosmetic-only "elevation profile" squiggle seeded by a
 * string (e.g. trip slug) — NOT real course-elevation data, since the
 * backend has no such field. Purely decorative flavor for trip cards. */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 0xffffffff;
  };
}

export function DecorativeSparkline({ seed, className }: { seed: string; className?: string }) {
  const rand = seededRandom(seed);
  const width = 120;
  const height = 32;
  const points = Array.from({ length: 8 }, (_, i) => {
    const x = (i / 7) * width;
    const y = height - 4 - rand() * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" aria-hidden>
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
