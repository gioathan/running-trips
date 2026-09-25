import { cn } from "@/lib/cn";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

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
      {pages.map((p) => (
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
      ))}
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
