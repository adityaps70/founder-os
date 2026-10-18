import Link from "next/link";
import { cn } from "@/lib/utils";

/** Tab bar driven by an explicit `active` key (the pipeline lives in a query param). */
export function PipelineTabs({ slug, active }: { slug: string; active: string }) {
  const base = `/w/${slug}/pipeline`;
  const items = [
    { key: "sales", label: "Sales", href: `${base}?p=sales` },
    { key: "investors", label: "Fundraising", href: `${base}?p=investors` },
    { key: "partners", label: "Partnerships", href: `${base}?p=partners` },
    { key: "contacts", label: "Contacts", href: `${base}/contacts` },
  ];
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === active ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
            i.key === active ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}
