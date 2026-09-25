import type { ReactNode } from "react";

export interface AdminColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
}

export function AdminDataTable<T extends { id: number }>({ columns, rows }: { columns: AdminColumn<T>[]; rows: T[] }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-body-md text-ink-muted">No results.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-ink bg-white">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-ink/10">
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-3 text-label-sm uppercase text-ink-muted">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-low">
              {columns.map((col) => (
                <td key={col.header} className="px-4 py-3 text-body-md">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
