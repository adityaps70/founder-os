"use client";
import Link from "next/link";
import { useRef } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

export function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: { name: string; slug: string; plan: string };
  workspaces: { name: string; slug: string }[];
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-fg">
          {current.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">{current.name}</span>
          <span className="block text-[11px] capitalize text-faint">{current.plan} plan</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-faint" />
      </summary>
      <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-line bg-surface p-1 shadow-lg">
        <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-faint">Companies</p>
        {workspaces.map((w) => (
          <Link
            key={w.slug}
            href={`/w/?ws=${w.slug}`}
            onClick={() => ref.current?.removeAttribute("open")}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2"
          >
            <span className="flex-1 truncate">{w.name}</span>
            {w.slug === current.slug && <Check className="h-4 w-4 text-accent" />}
          </Link>
        ))}
        <div className="my-1 h-px bg-line" />
        <Link href="/onboarding/" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg">
          <Plus className="h-4 w-4" /> Add company
        </Link>
      </div>
    </details>
  );
}
