export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h1 className="text-headline-lg">{title}</h1>
      <div className="mt-8 rounded-md border border-dashed border-ink/30 p-10 text-center">
        <p className="text-body-lg">Not built yet.</p>
        <p className="mt-2 text-body-md text-ink-muted">{note}</p>
      </div>
    </div>
  );
}
