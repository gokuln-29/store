/** Placeholder for account and admin pages (a heading and a list) while they load. */
export function PanelSkeleton() {
  return (
    <div className="grid gap-4 p-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-2 grid gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
