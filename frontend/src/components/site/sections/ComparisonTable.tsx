"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";
import type { ComparisonTableData } from "./types";

function ColumnCard({
  label,
  rows,
  columnIndex,
  dark,
}: {
  label: string;
  rows: ComparisonTableData["rows"];
  columnIndex: 0 | 1;
  dark: boolean;
}) {
  return (
    <div className={cn("rounded-md border border-ink p-6", dark && "border-ink bg-ink text-white")}>
      <h3 className="text-headline-sm">{label}</h3>
      <ul className="mt-4 divide-y divide-ink/10">
        {rows.map((row, i) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <span aria-hidden className={dark ? "text-accent" : "text-ink-muted"}>
              {dark ? "✓" : "–"}
            </span>
            <div>
              <p className="text-body-md font-bold">{row.feature}</p>
              <p className={cn("text-body-sm", dark ? "text-white/70" : "text-ink-muted")}>{row.values[columnIndex]}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComparisonTable({ data }: { data: ComparisonTableData }) {
  const [activeColumn, setActiveColumn] = useState<0 | 1>(1);

  return (
    <section className="py-10 md:py-16">
      <Reveal>
        {data.headline && <h2 className="mb-8 text-headline-lg-mobile md:text-headline-lg">{data.headline}</h2>}

        {/* Mobile: segmented toggle swaps which column is shown */}
        <div className="mb-4 flex rounded-full bg-surface-low p-1 md:hidden">
          {data.columnLabels.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveColumn(i as 0 | 1)}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-label-lg uppercase transition-colors",
                activeColumn === i ? "bg-white shadow-hard" : "text-ink-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="md:hidden">
          <ColumnCard label={data.columnLabels[activeColumn]} rows={data.rows} columnIndex={activeColumn} dark={activeColumn === 1} />
        </div>

        {/* Desktop: both columns side by side */}
        <div className="hidden gap-6 md:grid md:grid-cols-2">
          <ColumnCard label={data.columnLabels[0]} rows={data.rows} columnIndex={0} dark={false} />
          <ColumnCard label={data.columnLabels[1]} rows={data.rows} columnIndex={1} dark />
        </div>
      </Reveal>
    </section>
  );
}
