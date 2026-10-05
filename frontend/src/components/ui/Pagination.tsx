import { cn } from "@/lib/cn";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Which page buttons to draw: always the first and last, the current page
 * and its neighbours, with `null` marking a gap ("…"). Keeps the row to at
 * most 7 items however many pages there are, so it fits a phone screen. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const current = Math.min(Math.max(page, 1), pageCount);
  const keep = new Set([1, pageCount, current - 1, current, current + 1]);
  // Near either end, show a run of four so the row doesn't change width.
  if (current <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (current >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((n) => keep.add(n));
  const shown = [...keep].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  shown.forEach((n, i) => {
    if (i > 0 && n - shown[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const pages = pageWindow(page, pageCount);

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="h-9 w-9 rounded-full border border-ink text-body-sm disabled:opacity-40"
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-body-sm text-ink-muted" aria-hidden>
            …
          </span>
        ) : (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={cn(
            "h-9 w-9 rounded-full text-body-sm",
            p === page ? "bg-ink text-white" : "border border-ink text-ink hover:bg-surface-low"
          )}
          aria-current={p === page ? "page" : undefined}
        >
          {p}
        </button>
        )
      )}
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className="h-9 w-9 rounded-full border border-ink text-body-sm disabled:opacity-40"
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
