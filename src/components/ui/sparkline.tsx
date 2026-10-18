/** Tiny inline trend line. Values are plotted left→right, oldest first. */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return <svg width={width} height={height} className={className} aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((v - min) / span) * (height - 6);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.5} fill="var(--accent)" />
    </svg>
  );
}

/** Simple vertical bar chart (e.g. monthly income vs expense). */
export function BarChart({
  data,
  height = 140,
  format = (n: number) => String(n),
}: {
  data: { label: string; a: number; b?: number }[];
  height?: number;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b ?? 0]));
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end justify-center gap-1">
            <div className="w-1/2 max-w-5 rounded-t bg-accent" style={{ height: `${(d.a / max) * 100}%` }} title={format(d.a)} />
            {d.b !== undefined && (
              <div className="w-1/2 max-w-5 rounded-t bg-faint/50" style={{ height: `${(d.b / max) * 100}%` }} title={format(d.b)} />
            )}
          </div>
          <span className="truncate text-[10px] text-faint">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
