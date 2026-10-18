"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";

/** Wraps the sidebar in a slide-down panel on small screens; closes on navigation. */
export function MobileNav({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [path]);
  return (
    <details ref={ref} className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur lg:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <Menu className="h-5 w-5 text-muted" />
        <span className="truncate text-sm font-semibold">{title}</span>
      </summary>
      <div className="max-h-[80vh] overflow-y-auto border-t border-line">{children}</div>
    </details>
  );
}
