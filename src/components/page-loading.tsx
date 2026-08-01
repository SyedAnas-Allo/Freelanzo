export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6" aria-busy="true">
      <div className="h-7 w-2/5 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
