import type { StatsBandData } from "./types";

export function StatsBand({ data }: { data: StatsBandData }) {
  return (
    <section className="flex flex-wrap justify-center gap-10 rounded-md border border-ink bg-surface px-8 py-10">
      {data.items.map((item, i) => (
        <div key={i} className="text-center">
          <p className="text-metric-display">{item.value}</p>
          <p className="mt-1 text-label-sm text-ink-muted">{item.label}</p>
        </div>
      ))}
    </section>
  );
}
