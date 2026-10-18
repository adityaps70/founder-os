import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "good" | "bad" | "neutral";
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-4", className)}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
      {hint && (
        <p className={cn("mt-1 text-xs", tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-faint")}>{hint}</p>
      )}
    </div>
  );
}
