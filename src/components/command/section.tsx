import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A dashboard card with a title, optional "view all" link and optional extra action. */
export function Section({
  title,
  description,
  href,
  linkLabel = "View all",
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title={title}
        description={description}
        action={
          <div className="flex items-center gap-1">
            {action}
            {href && (
              <Link href={href} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg">
                {linkLabel} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        }
      />
      <div className="flex-1">{children}</div>
    </Card>
  );
}

/** Small muted message used for empty card bodies. */
export function CardEmpty({ children, cta }: { children: React.ReactNode; cta?: React.ReactNode }) {
  return (
    <div className="px-4 py-6 text-center">
      <p className="text-xs text-muted">{children}</p>
      {cta && <div className="mt-3 flex justify-center">{cta}</div>}
    </div>
  );
}
