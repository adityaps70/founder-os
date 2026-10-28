export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-48 rounded-lg bg-surface-2" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
