import { cn } from "@/lib/utils";

export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "purple";

const tones: Record<Tone, string> = {
  gray: "bg-surface-2 text-muted",
  blue: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  red: "bg-red-500/10 text-red-700 dark:text-red-300",
  purple: "bg-accent-soft text-accent",
};

export function Badge({ tone = "gray", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
