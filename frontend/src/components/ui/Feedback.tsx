export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-md border border-dashed border-ink/30 py-16 text-center">
      <p className="text-headline-sm">{title}</p>
      {description && <p className="mt-2 text-body-md text-ink-muted">{description}</p>}
    </div>
  );
}
