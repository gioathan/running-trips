import type { StepsData } from "./types";

export function Steps({ data }: { data: StepsData }) {
  return (
    <section className="py-10 md:py-16">
      {data.eyebrow && <p className="text-label-lg text-ink-muted">{data.eyebrow}</p>}
      {data.headline && <h2 className="mt-2 text-headline-lg-mobile md:text-headline-lg">{data.headline}</h2>}
      <ol className="mt-10 grid gap-8 md:grid-cols-3">
        {data.items.map((item, i) => (
          <li key={i}>
            <p className="text-metric-display text-primary">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="mt-2 text-headline-sm">{item.title}</h3>
            <p className="mt-2 text-body-md text-ink-muted">{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
