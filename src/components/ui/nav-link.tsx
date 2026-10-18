"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Link that highlights when the current path matches (exact for `exact`, prefix otherwise). */
export function NavLink({
  href,
  exact,
  className,
  activeClassName = "bg-surface-2 text-fg",
  children,
}: {
  href: string;
  exact?: boolean;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className={cn(className, active && activeClassName)} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

/** Horizontal tab bar for sub-sections (e.g. pipeline: sales / investors / partners). */
export function Tabs({ items }: { items: { href: string; label: string; exact?: boolean }[] }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((i) => (
        <NavLink
          key={i.href}
          href={i.href}
          exact={i.exact ?? true}
          className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted hover:text-fg"
          activeClassName="!border-accent !text-fg font-medium"
        >
          {i.label}
        </NavLink>
      ))}
    </div>
  );
}
