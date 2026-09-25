import type { ComparisonTableData } from "./types";

export function ComparisonTable({ data }: { data: ComparisonTableData }) {
  return (
    <section className="py-10 md:py-16">
      {data.headline && <h2 className="mb-8 text-headline-lg-mobile md:text-headline-lg">{data.headline}</h2>}
      <div className="overflow-x-auto rounded-md border border-ink">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-ink">
              <th className="px-4 py-4 text-label-md uppercase text-ink-muted" />
              <th className="px-4 py-4 text-label-md uppercase text-ink-muted">{data.columnLabels[0]}</th>
              <th className="px-4 py-4 text-label-md uppercase text-ink-muted">{data.columnLabels[1]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {data.rows.map((row, i) => (
              <tr key={i}>
                <td className="px-4 py-4 text-body-md font-bold">{row.feature}</td>
                <td className="px-4 py-4 text-body-md text-ink-muted">{row.values[0]}</td>
                <td className="px-4 py-4 text-body-md text-ink-muted">{row.values[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
